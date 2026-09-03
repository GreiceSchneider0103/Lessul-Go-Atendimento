import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Download, FileSpreadsheet } from "lucide-react";
import { DevolucaoDefeito, DevolucaoSolucao } from "@prisma/client";
import { requireCurrentUser } from "@/lib/auth/require-user";
import { hasPermission } from "@/lib/rbac/permissions";
import { CANAIS_MARKETPLACE } from "@/config/domains";
import { formatCurrencyBR, formatDateBR, formatEnumLabel } from "@/lib/formatters/display";
import { listDevolucoesInternas } from "@/lib/services/devolucoes-internas-service";
import { devolucaoInternaFiltersSchema } from "@/lib/validation/devolucao-interna";
import { DevolucoesInternasTable } from "@/components/devolucoes-internas/devolucoes-internas-table";

const DEFEITOS = Object.values(DevolucaoDefeito);
const SOLUCOES = Object.values(DevolucaoSolucao);

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function DevolucoesInternasPage({ searchParams }: PageProps) {
  const user = await requireCurrentUser();

  if (!hasPermission(user.perfil, "devolucoes_internas.view")) {
    redirect("/dashboard");
  }

  const canManage = hasPermission(user.perfil, "devolucoes_internas.update");
  const query = await searchParams;
  const parsed = devolucaoInternaFiltersSchema.safeParse(query);
  const filters = parsed.success ? parsed.data : {};

  const items = await listDevolucoesInternas(filters);

  const totalRecuperado = items.reduce((acc, item) => acc + Number(item.valorRecuperado), 0);
  const totalReembolsoSolicitado = items.filter((item) => item.solicitadoReembolso).length;

  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => value && params.set(key, String(value)));

  return (
    <section className="page">
      <div className="page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Devoluções Internas</h1>
          <p className="muted">Controle de devoluções recebidas pela Lessul e valores recuperados dos marketplaces.</p>
        </div>

        {canManage ? (
          <Link href="/devolucoes-internas/novo" className="btn btn-primary btn-create-ticket whitespace-nowrap">
            <Plus size={16} strokeWidth={2.5} aria-hidden />
            Novo registro
          </Link>
        ) : null}
      </div>

      <div className="grid grid-3">
        <article className="card">
          <strong className="text-xs font-bold uppercase tracking-wide text-slate-500">Total de registros</strong>
          <p className="metric-value">{items.length}</p>
        </article>
        <article className="card">
          <strong className="text-xs font-bold uppercase tracking-wide text-slate-500">Valor recuperado</strong>
          <p className="metric-value">{formatCurrencyBR(totalRecuperado)}</p>
        </article>
        <article className="card">
          <strong className="text-xs font-bold uppercase tracking-wide text-slate-500">Reembolso solicitado</strong>
          <p className="metric-value">{totalReembolsoSolicitado}</p>
        </article>
      </div>

      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <form action="/devolucoes-internas" method="get" className="flex flex-1 flex-wrap items-end gap-3">
          <label className="min-w-[160px]">
            Data inicial
            <input type="date" name="startDate" defaultValue={filters.startDate ?? ""} />
          </label>
          <label className="min-w-[160px]">
            Data final
            <input type="date" name="endDate" defaultValue={filters.endDate ?? ""} />
          </label>
          <label className="min-w-[160px]">
            Marketplace
            <select name="canalMarketplace" defaultValue={filters.canalMarketplace ?? ""}>
              <option value="">Todos</option>
              {CANAIS_MARKETPLACE.map((item) => (
                <option key={item} value={item}>{formatEnumLabel(item)}</option>
              ))}
            </select>
          </label>
          <label className="min-w-[180px]">
            Defeito
            <select name="defeito" defaultValue={filters.defeito ?? ""}>
              <option value="">Todos</option>
              {DEFEITOS.map((item) => (
                <option key={item} value={item}>{formatEnumLabel(item)}</option>
              ))}
            </select>
          </label>
          <label className="min-w-[200px]">
            Solução
            <select name="solucao" defaultValue={filters.solucao ?? ""}>
              <option value="">Todas</option>
              {SOLUCOES.map((item) => (
                <option key={item} value={item}>{formatEnumLabel(item)}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <button className="btn btn-primary h-[42px]" type="submit">Filtrar</button>
            <Link className="btn btn-link h-[42px] inline-flex items-center" href="/devolucoes-internas">Limpar</Link>
          </div>
        </form>

        <div className="flex gap-2">
          <Link className="btn btn-secondary" href={`/api/devolucoes-internas/export?${params.toString()}&format=csv`}>
            <Download size={15} strokeWidth={2.25} aria-hidden />
            CSV
          </Link>
          <Link className="btn btn-secondary" href={`/api/devolucoes-internas/export?${params.toString()}&format=xlsx`}>
            <FileSpreadsheet size={15} strokeWidth={2.25} aria-hidden />
            XLSX
          </Link>
        </div>
      </div>

      <DevolucoesInternasTable
        canManage={canManage}
        items={items.map((item) => ({
          id: item.id,
          numero: item.numero,
          codigoVenda: item.codigoVenda,
          cliente: item.cliente,
          canalMarketplace: item.canalMarketplace,
          produto: item.produto,
          sku: item.sku,
          defeito: item.defeito,
          dataRecebimento: item.dataRecebimento ? formatDateBR(item.dataRecebimento) : "-",
          solucao: item.solucao,
          solicitadoReembolso: item.solicitadoReembolso,
          valorRecuperado: Number(item.valorRecuperado)
        }))}
      />
    </section>
  );
}
