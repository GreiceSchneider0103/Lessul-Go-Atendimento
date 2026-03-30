import { requireCurrentUser } from "@/lib/auth/require-user";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { CANAIS_MARKETPLACE, EMPRESAS } from "@/config/domains";
import { ticketFiltersSchema } from "@/lib/validation/ticket";
import { getDashboardData } from "@/lib/services/dashboard-service";
import { formatCurrencyBR, formatEnumLabel } from "@/lib/formatters/display";

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

const cardConfig: Record<string, { label: string; tone: string; icon: string; money?: boolean }> = {
  totalTickets: { label: "Total de tickets", tone: "#2563eb", icon: "◫" },
  ticketsAbertos: { label: "Tickets abertos", tone: "#eab308", icon: "!" },
  ticketsAtrasados: { label: "Tickets atrasados", tone: "#ef4444", icon: "⚠" },
  custoTotal: { label: "Custo total", tone: "#9333ea", icon: "$", money: true },
  reembolsoTotal: { label: "Valor de reembolso", tone: "#16a34a", icon: "$", money: true },
  coletaTotal: { label: "Total de coleta, envio ou peças", tone: "#06b6d4", icon: "✓", money: true }
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCurrentUser();
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

      <form className="panel form-grid cols-4" method="GET">
        <select name="canalMarketplace" defaultValue={normalizedQuery.canalMarketplace ?? ""}>
          <option value="">Todos os marketplaces</option>
          {CANAIS_MARKETPLACE.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}
        </select>
        <select name="empresa" defaultValue={normalizedQuery.empresa ?? ""}>
          <option value="">Todas as empresas</option>
          {EMPRESAS.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}
        </select>
        <input name="startDate" type="date" defaultValue={normalizedQuery.startDate} />
        <input name="endDate" type="date" defaultValue={normalizedQuery.endDate} />
        <input name="sku" placeholder="SKU" defaultValue={normalizedQuery.sku} />
        <button type="submit" className="btn btn-secondary">Filtrar</button>
      </form>

      {data.error ? <div className="alert alert-error">{data.error}</div> : null}

      <div className="grid grid-4">
        {Object.entries(data.cards).map(([key, value]) => {
          const config = cardConfig[key] ?? { label: key, tone: "#2563eb", icon: "●" };
          return (
            <article key={key} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <p className="muted">{config.label}</p>
                <p className="metric-value">{config.money ? formatCurrencyBR(Number(value)) : String(value)}</p>
              </div>
              <span style={{ width: 42, height: 42, borderRadius: 10, background: config.tone, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{config.icon}</span>
            </article>
          );
        })}
      </div>

      <DashboardCharts charts={data.charts} />

      <div className="panel table-wrap">
        <h3>Indicadores por SKU</h3>
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
