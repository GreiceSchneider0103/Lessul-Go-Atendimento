import { requireCurrentUser } from "@/lib/auth/require-user";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { CANAIS_MARKETPLACE, EMPRESAS } from "@/config/domains";
import { ticketFiltersSchema } from "@/lib/validation/ticket";
import { getDashboardData } from "@/lib/services/dashboard-service";
import { formatCurrencyBR, formatEnumLabel } from "@/lib/formatters/display";
import { Layers, AlertTriangle, Clock, Wallet, Banknote, PackageCheck, TrendingUp, type LucideIcon } from "lucide-react";

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

async function getDashboard(query: Record<string, string | undefined>, user: Awaited<ReturnType<typeof requireCurrentUser>>) {
  const parsed = ticketFiltersSchema.partial().safeParse(query);
  if (!parsed.success) {
    return { cards: {}, charts: {} as Record<string, Array<{ name: string; value: number }>>, skuMetrics: [] as Array<Record<string, unknown>>, error: "Filtros inválidos para dashboard" };
  }

  const payload = await getDashboardData(parsed.data, user);
  return { cards: payload.cards, charts: payload.charts, skuMetrics: payload.skuMetrics ?? [], error: null };
}

const cardConfig: Record<string, { label: string; icon: LucideIcon; danger?: boolean; money?: boolean }> = {
  totalTickets: { label: "Total de tickets", icon: Layers },
  ticketsAbertos: { label: "Tickets abertos", icon: Clock },
  ticketsAtrasados: { label: "Tickets atrasados", icon: AlertTriangle, danger: true },
  custoTotal: { label: "Custo total", icon: Wallet, money: true },
  reembolsoTotal: { label: "Valor de reembolso", icon: Banknote, money: true },
  coletaTotal: { label: "Total de coleta, envio ou peças", icon: PackageCheck, money: true },
  recuperadoTotal: { label: "Valor recuperado de marketplaces", icon: TrendingUp, money: true }
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCurrentUser();
  const empresaOptions = user.perfil === "LOJA" ? user.empresasVinculadas : EMPRESAS;
  const query = await searchParams;
  const monthRange = getCurrentMonthRange();
  const normalizedQuery: Record<string, string | undefined> = {
    ...query,
    startDate: query.startDate || monthRange.startDate,
    endDate: query.endDate || monthRange.endDate
  };
  const data = await getDashboard(normalizedQuery, user);

  return (
    <section className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="muted">Indicadores consolidados da operação de atendimento.</p>
      </div>

      <form className="panel flex flex-wrap items-end gap-3" method="GET">
        <div className="min-w-[200px] flex-1">
          <select name="canalMarketplace" defaultValue={normalizedQuery.canalMarketplace ?? ""}>
            <option value="">Todos os marketplaces</option>
            {CANAIS_MARKETPLACE.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}
          </select>
        </div>
        <div className="min-w-[150px] flex-1">
          <select name="empresa" defaultValue={normalizedQuery.empresa ?? ""}>
            <option value="">Todas as empresas</option>
            {empresaOptions.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}
          </select>
        </div>
        <div className="min-w-[150px] flex-1">
          <input name="startDate" type="date" defaultValue={normalizedQuery.startDate} />
        </div>
        <div className="min-w-[150px] flex-1">
          <input name="endDate" type="date" defaultValue={normalizedQuery.endDate} />
        </div>
        <div className="min-w-[100px] flex-1">
          <input name="sku" placeholder="SKU" defaultValue={normalizedQuery.sku} />
        </div>
        <button type="submit" className="btn btn-primary h-[42px]">Filtrar</button>
      </form>

      {data.error ? <div className="alert alert-error">{data.error}</div> : null}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {Object.entries(data.cards).map(([key, value]) => {
          const config = cardConfig[key] ?? { label: key, icon: Layers };
          const Icon = config.icon;
          return (
            <article key={key} className="card flex items-center justify-between gap-3" style={{ minHeight: 92 }}>
              <div>
                <p className="muted">{config.label}</p>
                <p className="metric-value">{config.money ? formatCurrencyBR(Number(value)) : String(value)}</p>
              </div>
              <span
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] ${
                  config.danger ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
                }`}
              >
                <Icon size={19} strokeWidth={2.25} />
              </span>
            </article>
          );
        })}
      </div>

      <DashboardCharts charts={data.charts} />

      <div className="panel table-wrap">
        <h3 className="mb-3 text-[15px] font-bold text-slate-800">Indicadores por SKU</h3>
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Tickets</th>
              <th>Incidência</th>
              <th>Custo</th>
              <th>Abertos</th>
              <th>Concluídos</th>
              <th>Atrasados</th>
              <th>Motivo recorrente</th>
            </tr>
          </thead>
          <tbody>
            {data.skuMetrics.length === 0 ? (
              <tr><td colSpan={8} className="muted">Sem dados para os filtros atuais.</td></tr>
            ) : data.skuMetrics.map((row: any) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.tickets}</td>
                <td>{row.incidencia}%</td>
                <td>{formatCurrencyBR(row.custo)}</td>
                <td>{row.abertos}</td>
                <td>{row.concluidos}</td>
                <td>{row.atrasados}</td>
                <td>{formatEnumLabel(row.motivoTop)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
