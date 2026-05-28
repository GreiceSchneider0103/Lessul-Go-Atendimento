import { prisma } from "@/lib/db/prisma";
import { getCurrentApiUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { withApiHandler } from "@/lib/http";
import { userCreateSchema, userUpdateSchema } from "@/lib/validation/user";
import { registerUserAudit } from "@/lib/audit/user-audit";
import { AppError } from "@/lib/errors";
import { Prisma } from "@prisma/client";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { EMPRESAS } from "@/config/domains"; // Importar o enum EMPRESAS

export async function GET() {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "user.manage");
    const data = await prisma.Usuario.findMany({ // Alterado para "Usuario"
      orderBy: { criadoEm: "desc" },
      include: { usuario_empresas: true }, // Incluir a nova relação
    });
    return { data, pagination: { total: data.length, page: 1, pageSize: data.length, totalPages: 1 }, meta: { resource: "users" } };
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const actor = await getCurrentApiUser();
    assertPermission(actor.perfil, "user.manage");

    if (!hasSupabaseAdminEnv())
      throw new AppError("Configuração de usuário admin do Supabase ausente", 503, "SUPABASE_ADMIN_NOT_CONFIGURED");

    const payload = createUserSchema.parse(await request.json());

    const existingInternal = await prisma.Usuario.findUnique({ where: { email: payload.email } }); // Alterado para "Usuario"
    if (existingInternal) throw new AppError("Já existe usuário interno com este e-mail", 409, "USER_ALREADY_EXISTS");

    const adminClient = createSupabaseAdminClient();

    let authUserId: string | null = null;
    const listed = await adminClient.auth.admin.listUsers();
    const existingAuth = listed.data?.users?.find((u) => u.email?.toLowerCase() === payload.email.toLowerCase()); // Alterado para "Usuario"

    if (existingAuth) {
      authUserId = existingAuth.id;
    } else if (payload.enviarConvite) {
      const invited = await adminClient.auth.admin.inviteUserByEmail(payload.email, {
        data: { nome: payload.nome, perfil: payload.perfil, empresaVinculada: payload.empresasVinculadas?.[0] ?? null }, // Manter campo legado
      });
      if (invited.error || !invited.data.user?.id)
        throw new AppError(invited.error?.message ?? "Falha ao convidar usuário", 400, "SUPABASE_INVITE_ERROR");
      authUserId = invited.data.user.id;
    } else {
      const createdAuth = await adminClient.auth.admin.createUser({
        email: payload.email,
        password: payload.senhaTemporaria!,
        email_confirm: true,
        user_metadata: { nome: payload.nome, perfil: payload.perfil, empresaVinculada: payload.empresasVinculadas?.[0] ?? null }, // Manter campo legado
      });
      if (createdAuth.error || !createdAuth.data.user?.id)
        throw new AppError(createdAuth.error?.message ?? "Falha ao criar usuário no Supabase Auth", 400, "SUPABASE_CREATE_USER_ERROR");
      authUserId = createdAuth.data.user.id;
    }

    const created = await prisma.Usuario.create({ // Alterado para "Usuario"
      data: {
        authUserId,
        nome: payload.nome,
        email: payload.email,
        perfil: payload.perfil,
        empresaVinculada: payload.empresasVinculadas?.[0] ?? null, // Manter campo legado
        ativo: payload.ativo ?? true
        ,
        usuario_empresas: {
          create: payload.empresasVinculadas.map((empresa) => ({
            empresa: empresa,
            role: "MEMBER", // Role padrão, pode ser expandido futuramente
          })),
        },
      }
      ,
      include: {
        usuario_empresas: true,
      },
    });

    await registerUserAudit({ targetUserId: created.id, actor, action: "CREATE", after: created as unknown as Prisma.JsonObject });
    return { data: created };
  });
}

export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const actor = await getCurrentApiUser();
    assertPermission(actor.perfil, "user.manage");

    const url = new URL(request.url);
    const userId = url.pathname.split('/').pop(); // Assumindo que userId é a última parte da URL

    if (!userId) {
      throw new AppError("ID do usuário não fornecido", 400, "USER_ID_MISSING");
    }

    const payload = userUpdateSchema.parse(await request.json());

    const existingUser = await prisma.Usuario.findUnique({ // Alterado para "Usuario"
      where: { id: userId },
      include: { usuario_empresas: true },
    });

    if (!existingUser) {
      throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
    }

    // Lógica para atualizar empresas vinculadas
    const currentCompanies = existingUser.usuario_empresas.map((ue) => ue.empresa);
    const companiesToConnect = payload.empresasVinculadas?.filter((empresa) => !currentCompanies.includes(empresa)) || [];
    const companiesToDisconnect = currentCompanies.filter((empresa) => !payload.empresasVinculadas?.includes(empresa));

    const updated = await prisma.Usuario.update({ // Alterado para "Usuario"
      where: { id: userId },
      data: {
        nome: payload.nome,
        email: payload.email,
        perfil: payload.perfil,
        ativo: payload.ativo,
        empresaVinculada: payload.empresasVinculadas?.[0] ?? null, // Manter campo legado
        usuario_empresas: {
          deleteMany: companiesToDisconnect.map((empresa) => ({
            usuario_id: userId,
            empresa: empresa,
          })),
          create: companiesToConnect.map((empresa) => ({
            empresa: empresa,
            role: "MEMBER",
          })),
        },
      },
      include: {
        usuario_empresas: true,
      },
    });

    await registerUserAudit({
      targetUserId: updated.id,
      actor,
      action: "UPDATE",
      before: existingUser as unknown as Prisma.JsonObject,
      after: updated as unknown as Prisma.JsonObject,
    });

    return { data: updated };
  });
}
