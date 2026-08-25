import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/require-user";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { ExtensionTokenManager } from "@/components/extension/extension-token-manager";

export default async function ExtensaoPage() {
  const user = await requireCurrentUser();

  if (!hasPermission(user.perfil, "ticket.create")) {
    redirect("/dashboard");
  }

  const tokens = await prisma.personalAccessToken.findMany({
    where: { usuarioId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true, revokedAt: true }
  });

  return (
    <section className="page">
      <div className="page-header">
        <h1>Extensão do navegador</h1>
        <p className="muted">Gere um token para conectar a extensão de importação de pedidos do Mercado Livre à sua conta.</p>
      </div>

      <ExtensionTokenManager initialTokens={tokens} />
    </section>
  );
}
