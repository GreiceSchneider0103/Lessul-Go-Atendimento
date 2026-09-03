import { redirect, notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/require-user";
import { hasPermission } from "@/lib/rbac/permissions";
import { getDevolucaoInternaById } from "@/lib/services/devolucoes-internas-service";
import { DevolucaoInternaForm, type DevolucaoInternaFormValues } from "@/components/devolucoes-internas/devolucao-interna-form";
import { AppError } from "@/lib/errors";

export default async function EditarDevolucaoInternaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();

  if (!hasPermission(user.perfil, "devolucoes_internas.update")) {
    redirect("/devolucoes-internas");
  }

  const { id } = await params;

  let item;
  try {
    item = await getDevolucaoInternaById(id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const initialValues: Partial<DevolucaoInternaFormValues> = {
    codigoVenda: item.codigoVenda,
    cliente: item.cliente,
    canalMarketplace: item.canalMarketplace,
    produto: item.produto,
    sku: item.sku ?? "",
    defeito: item.defeito,
    dataRecebimento: item.dataRecebimento ? item.dataRecebimento.toISOString().slice(0, 10) : "",
    dataRevisao: item.dataRevisao ? item.dataRevisao.toISOString().slice(0, 10) : "",
    solucao: item.solucao ?? "",
    solicitadoReembolso: item.solicitadoReembolso,
    valorRecuperado: Number(item.valorRecuperado),
    observacao: item.observacao ?? ""
  };

  return (
    <section className="page">
      <div className="page-header">
        <h1>Editar registro de devolução</h1>
        <p className="muted">Nº {item.numero} · {item.cliente}</p>
      </div>

      <DevolucaoInternaForm id={id} initialValues={initialValues} />
    </section>
  );
}
