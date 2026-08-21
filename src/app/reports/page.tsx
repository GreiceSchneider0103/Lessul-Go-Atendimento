import Link from "next/link";
import { Download, FileSpreadsheet, Layers, Wallet, Banknote, PackageCheck, type LucideIcon } from "lucide-react";
import { requireCurrentUser } from "@/lib/auth/require-user";
import { CANAIS_MARKETPLACE, EMPRESAS } from "@/config/domains";
import { ReportsResponse } from "@/lib/contracts";
import { assertPermission } from "@/lib/rbac/permissions";
import { ticketFiltersSchema } from "@/lib/validation/ticket";
import { getReportsData } from "@/lib/services/reports-service";
import { formatCurrencyBR } from "@/lib/formatters/display";

const totalsConfig: Record<string, { label: string; icon: LucideIcon; money?: boolean }> = {
  totalTickets: { label: "Total de tickets", icon: Layers },
  totalCustos: { label: "Custo total", icon: Wallet, money: true },
  totalReembolso: { label: "Valor de reembolso", icon: Banknote, money: true },
  totalColeta: { label: "Total de coleta", icon: PackageCheck, money: true }
};

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

async function getReport(query: Record<string, string | undefined>, user: Awaited<ReturnType<typeof requireCurrentUser>>): Promise<{ totals: ReportsResponse["totals"]; items: ReportsResponse["items"]; meta: ReportsResponse["meta"] | null; error: string | null }> {
  const parsed = ticketFiltersSchema.partial().safeParse(query);
  if (!parsed.success) {
    return { totals: { totalTickets: 0, totalCustos: 0, totalReembolso: 0, totalColeta: 0 }, items: [], meta: null, error: "Filtros inválidos" };
  }

  try {
    const payload = await getReportsData(parsed.data, user);
    return {
      totals: payload.totals,
      items: payload.items,
      meta: payload.meta,
      error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar relatório";
    return { totals: { totalTickets: 0, totalCustos: 0, totalReembolso: 0, totalColeta: 0 }, items: [], meta: null, error: message };
  }
}

function groupBy(items: ReportsResponse["items"], field: keyof ReportsResponse["items"][number]) {
  const map = new Map<string, { tickets: number; custo: number }>();
  items.forEach((item) => {
    const key = String(item[field] ?? "N/D");
    const value = map.get(key) ?? { tickets: 0, custo: 0 };
    value.tickets += 1;
    value.custo += Number(item.custosTotais ?? 0);
    map.set(key, value);
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, ...value }));
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCurrentUser();
  assertPermission(user.perfil, "reports.full");

  const query = await searchParams;
  const monthRange = getCurrentMonthRange();
  const normalizedQuery: Record<string, string | undefined> = {
    ...query,
    startDate: query.startDate || monthRange.startDate,
    endDate: query.endDate || monthRange.endDate
  };
  const data = await getReport(normalizedQuery, user);
  const params = new URLSearchParams();
  Object.entries(normalizedQuery).forEach(([k, v]) => v && params.set(k, v));

  const byMarketplace = groupBy(data.items, "canalMarketplace");
  const byEmpresa = groupBy(data.items, "empresa");
  const byMotivo = groupBy(data.items, "motivo");
  const bySku = groupBy(data.items, "sku");

  return (
    <section className="page">
      <div className="page-header">
        <h1>Relatórios</h1>
        <p className="muted">Visualize estatísticas e exporte dados para análise.</p>
      </div>

      <form
        className="panel grid items-end gap-3"
        method="GET"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))" }}
      >
        <label>
          Data inicial
          <input name="startDate" type="date" defaultValue={normalizedQuery.startDate} />
        </label>
        <label>
          Data final
          <input name="endDate" type="date" defaultValue={normalizedQuery.endDate} />
        </label>
        <label>
          Marketplace
          <select name="canalMarketplace" defaultValue={normalizedQuery.canalMarketplace ?? ""}>
            <option value="">Todos</option>
            {CANAIS_MARKETPLACE.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label>
          Empresa
          <select name="empresa" defaultValue={normalizedQuery.empresa ?? ""}>
            <option value="">Todas</option>
            {EMPRESAS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          SKU
          <input name="sku" placeholder="SKU" defaultValue={normalizedQuery.sku} />
        </label>
        <button type="submit" className="btn btn-primary h-[42px]">Filtrar</button>
      </form>

      {data.error ? <div className="alert alert-error">{data.error}</div> : null}
      {data.meta?.truncated ? (
        <div className="alert" style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}>
          Relatório limitado a {data.meta.limit} itens. Total disponível: {data.meta.totalAvailable}.
        </div>
      ) : null}

      <div className="grid grid-4">
        {Object.entries(data.totals).map(([k, v]) => {
          const config = totalsConfig[k] ?? { label: k, icon: Layers };
          const Icon = config.icon;
          return (
            <article key={k} className="card flex items-center justify-between gap-3">
              <div>
                <p className="muted">{config.label}</p>
                <p className="metric-value">{config.money ? formatCurrencyBR(Number(v)) : String(v)}</p>
              </div>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-600">
                <Icon size={19} strokeWidth={2.25} />
              </span>
            </article>
          );
        })}
      </div>

      <div className="panel flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="m-0 text-[15px] font-bold text-slate-800">Exportar dados</h3>
          <p className="muted mt-1">Baixe os tickets filtrados em planilha para análise externa.</p>
        </div>
        <div className="flex gap-2">
          <Link className="btn btn-secondary" href={`/api/reports/export?${params.toString()}&format=csv`}>
            <Download size={15} strokeWidth={2.25} aria-hidden />
            Exportar CSV
          </Link>
          <Link className="btn btn-primary" href={`/api/reports/export?${params.toString()}&format=xlsx`}>
            <FileSpreadsheet size={15} strokeWidth={2.25} aria-hidden />
            Exportar XLSX
          </Link>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="panel table-wrap">
          <h3 className="mb-3 text-[15px] font-bold text-slate-800">Resumo por Marketplace</h3>
          <table className="table"><thead><tr><th>Marketplace</th><th>Tickets</th><th>Custo Total</th></tr></thead><tbody>
            {byMarketplace.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.tickets}</td><td>{formatCurrencyBR(row.custo)}</td></tr>)}
          </tbody></table>
        </div>

        <div className="panel table-wrap">
          <h3 className="mb-3 text-[15px] font-bold text-slate-800">Resumo por Empresa</h3>
          <table className="table"><thead><tr><th>Empresa</th><th>Tickets</th><th>Custo Total</th></tr></thead><tbody>
            {byEmpresa.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.tickets}</td><td>{formatCurrencyBR(row.custo)}</td></tr>)}
          </tbody></table>
        </div>
      </div>

      <div className="panel table-wrap">
        <h3 className="mb-3 text-[15px] font-bold text-slate-800">Resumo por Motivo</h3>
        <table className="table"><thead><tr><th>Motivo</th><th>Tickets</th><th>Custo Total</th></tr></thead><tbody>
          {byMotivo.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.tickets}</td><td>{formatCurrencyBR(row.custo)}</td></tr>)}
        </tbody></table>
      </div>

      <div className="panel table-wrap">
        <h3 className="mb-3 text-[15px] font-bold text-slate-800">Resumo por SKU</h3>
        <table className="table"><thead><tr><th>SKU</th><th>Tickets</th><th>Custo Total</th></tr></thead><tbody>
          {bySku.map((row) => <tr key={row.name}><td>{row.name}</td><td>{row.tickets}</td><td>{formatCurrencyBR(row.custo)}</td></tr>)}
        </tbody></table>
      </div>
    </section>
  );
}
