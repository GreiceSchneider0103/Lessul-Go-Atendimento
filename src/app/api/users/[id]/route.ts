import { prisma } from "@/lib/db/prisma";
import { getCurrentApiUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { withApiHandler } from "@/lib/http";
import { updateUserSchema } from "@/lib/validation/user";
import { registerUserAudit } from "@/lib/audit/user-audit";
import { AcaoUsuarioAuditoria, Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { logError } from "@/lib/logger";

function resolveAuditAction(before: { perfil: string; ativo: boolean }, payload: { perfil?: string; ativo?: boolean }): AcaoUsuarioAuditoria {
  if (payload.perfil && payload.perfil !== before.perfil) return "PROFILE_CHANGE";
  if (payload.ativo !== undefined && payload.ativo !== before.ativo) return "STATUS_CHANGE";
  return "UPDATE";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const actor = await getCurrentApiUser();
    assertPermission(actor.perfil, "user.manage");

    const { id } = await params;
    const payload = updateUserSchema.parse(await request.json());

    const before = await prisma.usuario.findUnique({ where: { id } });
    if (!before) throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");

    const perfilFinal = payload.perfil ?? before.perfil;
    const empresaFinal = payload.empresaVinculada !== undefined ? payload.empresaVinculada : before.empresaVinculada;

    if (perfilFinal === "LOJA" && !empresaFinal) {
      throw new AppError("Empresa vinculada é obrigatória para perfil LOJA", 400, "LOJA_EMPRESA_REQUIRED");
    }

    const updateData: Prisma.UsuarioUpdateInput = {
      ...(payload.nome !== undefined ? { nome: payload.nome } : {}),
      ...(payload.perfil !== undefined ? { perfil: payload.perfil } : {}),
      ...(payload.ativo !== undefined ? { ativo: payload.ativo } : {}),
      empresaVinculada: perfilFinal === "LOJA" ? (empresaFinal ?? null) : null
    };

    try {
      const updated = await prisma.usuario.update({ where: { id }, data: updateData });

      await registerUserAudit({
        targetUserId: id,
        actor,
        action: resolveAuditAction(before, payload),
        before: before as unknown as Prisma.JsonObject,
        after: updated as unknown as Prisma.JsonObject
      });

      return { data: updated };
    } catch (error) {
      logError("Erro ao atualizar usuário", {
        route: "PATCH /api/users/[id]",
        userId: id,
        actorId: actor.id,
        message: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new AppError("Falha ao salvar alterações do usuário", 400, "USER_UPDATE_FAILED");
      }

      throw error;
    }
  });
}
