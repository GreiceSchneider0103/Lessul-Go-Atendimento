import { prisma } from "@/lib/db/prisma";
import { getCurrentApiUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { withApiHandler } from "@/lib/http";
import { updateUserSchema } from "@/lib/validation/user";
import { registerUserAudit } from "@/lib/audit/user-audit";
import { AcaoUsuarioAuditoria, Empresa, Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { attachEmpresasToUsuarios, getUsuarioEmpresas, normalizeEmpresas, replaceUsuarioEmpresas } from "@/lib/services/users-service";

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

    const companyFieldsTouched =
      Object.prototype.hasOwnProperty.call(payload, "empresasVinculadas") ||
      Object.prototype.hasOwnProperty.call(payload, "empresaVinculada");

    // Persist the multi-company link table (usuario_empresas), not just the
    // legacy single empresaVinculada column — this is what previously never
    // got written on edit, so company checkbox changes silently didn't stick.
    const shouldWriteEmpresas = companyFieldsTouched || (payload.perfil !== undefined && payload.perfil !== before.perfil);

    let empresasFinal: Empresa[] = [];

    if (perfilFinal === "LOJA") {
      if (companyFieldsTouched) {
        empresasFinal = normalizeEmpresas(payload);
      } else {
        const existingVinculos = await getUsuarioEmpresas(prisma, [id]);
        empresasFinal = attachEmpresasToUsuarios([before], existingVinculos)[0].empresasVinculadas;
      }
    }

    if (perfilFinal === "LOJA" && empresasFinal.length === 0) {
      throw new AppError("Ao menos uma empresa vinculada é obrigatória para perfil LOJA", 400, "LOJA_EMPRESA_REQUIRED");
    }

    const updateData: Prisma.UsuarioUpdateInput = {
      ...(payload.nome !== undefined ? { nome: payload.nome } : {}),
      ...(payload.perfil !== undefined ? { perfil: payload.perfil } : {}),
      ...(payload.ativo !== undefined ? { ativo: payload.ativo } : {}),
      ...(shouldWriteEmpresas ? { empresaVinculada: empresasFinal[0] ?? null } : {})
    };

    try {
      const updatedWithCompanies = await prisma.$transaction(async (tx) => {
        const updated = await tx.usuario.update({ where: { id }, data: updateData });

        if (shouldWriteEmpresas) {
          await replaceUsuarioEmpresas(tx, id, empresasFinal);
        }

        const vinculos = await getUsuarioEmpresas(tx, [id]);
        return attachEmpresasToUsuarios([updated], vinculos)[0];
      });

      await registerUserAudit({
        targetUserId: id,
        actor,
        action: resolveAuditAction(before, payload),
        before: before as unknown as Prisma.JsonObject,
        after: updatedWithCompanies as unknown as Prisma.JsonObject
      });

      return { data: updatedWithCompanies };
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
