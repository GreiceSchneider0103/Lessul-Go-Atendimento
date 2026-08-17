import { getCurrentApiUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { withApiHandler } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseAdminClient, hasSupabaseAdminEnv } from "@/lib/supabase/admin";
import { getAppBaseUrl } from "@/lib/supabase/config";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const actor = await getCurrentApiUser();
    assertPermission(actor.perfil, "master.manage");

    if (!hasSupabaseAdminEnv()) {
      throw new AppError(
        "Configuração de usuário admin do Supabase ausente",
        503,
        "SUPABASE_ADMIN_NOT_CONFIGURED"
      );
    }

    const { id } = await params;
    const target = await prisma.usuario.findUnique({ where: { id } });

    if (!target) {
      throw new AppError("Usuário não encontrado", 404, "USER_NOT_FOUND");
    }

    const adminClient = createSupabaseAdminClient();
    const redirectTo = `${getAppBaseUrl()}/reset-password`;

    const { error } = await adminClient.auth.resetPasswordForEmail(target.email, { redirectTo });

    if (error) {
      throw new AppError(error.message || "Falha ao enviar e-mail de redefinição de senha", 400, "PASSWORD_RESET_ERROR");
    }

    return { data: { ok: true, email: target.email } };
  });
}
