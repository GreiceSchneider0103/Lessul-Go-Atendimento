import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/require-user";
import { hasPermission } from "@/lib/rbac/permissions";
import { DevolucaoInternaForm } from "@/components/devolucoes-internas/devolucao-interna-form";

export default async function NovaDevolucaoInternaPage() {
  const user = await requireCurrentUser();

  if (!hasPermission(user.perfil, "devolucoes_internas.update")) {
    redirect("/devolucoes-internas");
  }

  return (
    <section className="page">
      <div className="page-header">
        <h1>Novo registro de devolução</h1>
        <p className="muted">Controle interno de devoluções recebidas pela Lessul.</p>
      </div>

      <DevolucaoInternaForm />
    </section>
  );
}
