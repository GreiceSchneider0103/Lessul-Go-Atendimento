import { prisma } from "@/lib/db/prisma";
import { getCurrentApiUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { withApiHandler } from "@/lib/http";
import { userCreateSchema, userUpdateSchema } from "@/lib/validation/user";
import { registerUserAudit } from "@/lib/audit/user-audit";
import { AppError } from "@/lib/errors";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { Empresa, Perfil, Prisma } from "@prisma/client";

type UsuarioEmpresaRow = {
  id: string;
  usuario_id: string;
  empresa: Empresa;
  role: string | null;
  created_at: Date;
};

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

type UpdateUserPayload = {
  id?: string;
  nome?: string;
  email?: string;
  perfil?: Perfil;
  empresaVinculada?: Empresa | null;
  empresasVinculadas?: Empresa[];
  senhaTemporaria?: string;
  enviarConvite?: boolean;
  ativo?: boolean;
};

type RawDb = Pick<typeof prisma, "$queryRaw" | "$executeRaw">;

function isEmpresa(value: unknown): value is Empresa {
  return typeof value === "string" && Object.values(Empresa).includes(value as Empresa);
}

function normalizeEmpresas(payload: {
  empresaVinculada?: unknown;
  empresasVinculadas?: unknown;
}): Empresa[] {
  const empresas = new Set<Empresa>();

  if (Array.isArray(payload.empresasVinculadas)) {
    for (const empresa of payload.empresasVinculadas) {
      if (isEmpresa(empresa)) {
        empresas.add(empresa);
      }
    }
  }

  if (isEmpresa(payload.empresaVinculada)) {
    empresas.add(payload.empresaVinculada);
  }

  return Array.from(empresas);
}

async function getUsuarioEmpresas(db: RawDb, usuarioIds: string[]) {
  if (usuarioIds.length === 0) {
    return [] as UsuarioEmpresaRow[];
  }

  return db.$queryRaw<UsuarioEmpresaRow[]>`
    SELECT 
      "id",
      "usuario_id",
      "empresa",
      "role",
      "created_at"
    FROM "usuario_empresas"
    WHERE "usuario_id" IN (${Prisma.join(usuarioIds)})
    ORDER BY "created_at" ASC
  `;
}

async function replaceUsuarioEmpresas(db: RawDb, usuarioId: string, empresas: Empresa[]) {
  await db.$executeRaw`
    DELETE FROM "usuario_empresas"
    WHERE "usuario_id" = ${usuarioId}
  `;

  for (const empresa of empresas) {
    await db.$executeRaw`
      INSERT INTO "usuario_empresas" ("usuario_id", "empresa", "role")
      VALUES (${usuarioId}, ${empresa}::"Empresa", ${"MEMBER"})
      ON CONFLICT ("usuario_id", "empresa") DO NOTHING
    `;
  }
}

function attachEmpresasToUsuarios<T extends { id: string; empresaVinculada?: Empresa | null }>(
  usuarios: T[],
  vinculos: UsuarioEmpresaRow[]
) {
  const vinculosPorUsuario = new Map<string, UsuarioEmpresaRow[]>();

  for (const vinculo of vinculos) {
    const atuais = vinculosPorUsuario.get(vinculo.usuario_id) ?? [];
    atuais.push(vinculo);
    vinculosPorUsuario.set(vinculo.usuario_id, atuais);
  }

  return usuarios.map((usuario) => {
    const usuarioEmpresas = vinculosPorUsuario.get(usuario.id) ?? [];

    const empresasVinculadas =
      usuarioEmpresas.length > 0
        ? usuarioEmpresas.map((item) => item.empresa)
        : usuario.empresaVinculada
          ? [usuario.empresaVinculada]
          : [];

    return {
      ...usuario,
      usuario_empresas: usuarioEmpresas,
      empresasVinculadas
    };
  });
}

function getTargetUserId(request: Request, body: unknown): string | null {
  const url = new URL(request.url);

  const queryId = url.searchParams.get("id") || url.searchParams.get("userId");
  if (queryId) {
    return queryId;
  }

  const bodyId =
    typeof body === "object" &&
    body !== null &&
    "id" in body &&
    typeof (body as { id?: unknown }).id === "string"
      ? (body as { id: string }).id
      : null;

  if (bodyId) {
    return bodyId;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  if (lastSegment && lastSegment !== "users") {
    return lastSegment;
  }

  return null;
}

export async function GET() {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "user.manage");

    const usuarios = await prisma.usuario.findMany({
      orderBy: { criadoEm: "desc" }
    });

    const vinculos = await getUsuarioEmpresas(
      prisma,
      usuarios.map((usuario) => usuario.id)
    );

    const data = attachEmpresasToUsuarios(usuarios, vinculos);

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

export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const actor = await getCurrentApiUser();
    assertPermission(actor.perfil, "user.manage");

    const rawBody = await request.json();
    const userId = getTargetUserId(request, rawBody);

    if (!userId) {
      throw new AppError("ID do usuário não fornecido", 400, "USER_ID_MISSING");
    }

    const payload = userUpdateSchema.parse(rawBody) as UpdateUserPayload;
    const shouldUpdateEmpresas =
      Object.prototype.hasOwnProperty.call(payload, "empresasVinculadas") ||
      Object.prototype.hasOwnProperty.call(payload, "empresaVinculada");

    const existingUser = await prisma.usuario.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
    }

    const existingVinculos = await getUsuarioEmpresas(prisma, [userId]);
    const existingUserWithCompanies = attachEmpresasToUsuarios([existingUser], existingVinculos)[0];

    const empresasVinculadas = shouldUpdateEmpresas
      ? normalizeEmpresas(payload)
      : existingUserWithCompanies.empresasVinculadas;

    const empresaLegada = shouldUpdateEmpresas
      ? empresasVinculadas[0] ?? null
      : undefined;

    const updatedWithCompanies = await prisma.$transaction(async (tx) => {
      const updated = await tx.usuario.update({
        where: { id: userId },
        data: {
          nome: payload.nome,
          email: payload.email,
          perfil: payload.perfil,
          ativo: payload.ativo,
          empresaVinculada: empresaLegada
        }
      });

      if (shouldUpdateEmpresas) {
        await replaceUsuarioEmpresas(tx, userId, empresasVinculadas);
      }

      const vinculos = await getUsuarioEmpresas(tx, [updated.id]);
      return attachEmpresasToUsuarios([updated], vinculos)[0];
    });

    await registerUserAudit({
      targetUserId: updatedWithCompanies.id,
      actor,
      action: "UPDATE",
      before: existingUserWithCompanies as unknown as Prisma.JsonObject,
      after: updatedWithCompanies as unknown as Prisma.JsonObject
    });

    return { data: updatedWithCompanies };
  });
}