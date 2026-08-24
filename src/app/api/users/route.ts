import { prisma } from "@/lib/db/prisma";
import { getCurrentApiUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { withApiHandler } from "@/lib/http";
import { userCreateSchema } from "@/lib/validation/user";
import { registerUserAudit } from "@/lib/audit/user-audit";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import {
  attachEmpresasToUsuarios,
  getUsuarioEmpresas,
  listUsuariosComEmpresas,
  normalizeEmpresas,
  replaceUsuarioEmpresas
} from "@/lib/services/users-service";
import { Empresa, Perfil, Prisma } from "@prisma/client";

type CreateUserPayload = {
  nome: string;
  email: string;
  perfil: Perfil;
  empresaVinculada?: Empresa | null;
  empresasVinculadas?: Empresa[];
  senhaTemporaria?: string;
  enviarConvite?: boolean;
  ativo?: boolean;
};

export async function GET() {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "user.manage");

    const data = await listUsuariosComEmpresas();

    return {
      data,
      pagination: {
        total: data.length,
        page: 1,
        pageSize: data.length,
        totalPages: 1
      },
      meta: { resource: "users" }
    };
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const actor = await getCurrentApiUser();
    assertPermission(actor.perfil, "user.manage");

    if (!hasSupabaseAdminEnv()) {
      throw new AppError(
        "Configuração de usuário admin do Supabase ausente",
        503,
        "SUPABASE_ADMIN_NOT_CONFIGURED"
      );
    }

    const payload = userCreateSchema.parse(await request.json()) as CreateUserPayload;
    const empresasVinculadas = normalizeEmpresas(payload);
    const empresaLegada = empresasVinculadas[0] ?? null;

    const existingInternal = await prisma.usuario.findUnique({
      where: { email: payload.email }
    });

    if (existingInternal) {
      throw new AppError("Já existe usuário interno com este e-mail", 409, "USER_ALREADY_EXISTS");
    }

    const adminClient = createSupabaseAdminClient();

    let authUserId: string | null = null;

    const listed = await adminClient.auth.admin.listUsers();
    const existingAuth = listed.data?.users?.find(
      (u) => u.email?.toLowerCase() === payload.email.toLowerCase()
    );

    if (existingAuth) {
      authUserId = existingAuth.id;
    } else if (payload.enviarConvite) {
      const invited = await adminClient.auth.admin.inviteUserByEmail(payload.email, {
        data: {
          nome: payload.nome,
          perfil: payload.perfil,
          empresaVinculada: empresaLegada,
          empresasVinculadas
        }
      });

      if (invited.error || !invited.data.user?.id) {
        throw new AppError(
          invited.error?.message ?? "Falha ao convidar usuário",
          400,
          "SUPABASE_INVITE_ERROR"
        );
      }

      authUserId = invited.data.user.id;
    } else {
      const createdAuth = await adminClient.auth.admin.createUser({
        email: payload.email,
        password: payload.senhaTemporaria!,
        email_confirm: true,
        user_metadata: {
          nome: payload.nome,
          perfil: payload.perfil,
          empresaVinculada: empresaLegada,
          empresasVinculadas
        }
      });

      if (createdAuth.error || !createdAuth.data.user?.id) {
        throw new AppError(
          createdAuth.error?.message ?? "Falha ao criar usuário no Supabase Auth",
          400,
          "SUPABASE_CREATE_USER_ERROR"
        );
      }

      authUserId = createdAuth.data.user.id;
    }

    const createdWithCompanies = await prisma.$transaction(async (tx) => {
      const created = await tx.usuario.create({
        data: {
          authUserId,
          nome: payload.nome,
          email: payload.email,
          perfil: payload.perfil,
          empresaVinculada: empresaLegada,
          ativo: payload.ativo ?? true
        }
      });

      await replaceUsuarioEmpresas(tx, created.id, empresasVinculadas);

      const vinculos = await getUsuarioEmpresas(tx, [created.id]);
      return attachEmpresasToUsuarios([created], vinculos)[0];
    });

    await registerUserAudit({
      targetUserId: createdWithCompanies.id,
      actor,
      action: "CREATE",
      after: createdWithCompanies as unknown as Prisma.JsonObject
    });

    return { data: createdWithCompanies };
  });
}

// Editing an existing user is handled by PATCH /api/users/[id] — see that
// route for the update logic (kept in one place to avoid the two
// implementations drifting apart, which is what caused multi-company saves
// to silently not persist here previously).