<<<<<<< HEAD
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";

async function getDashboard(query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => v && params.set(k, v));
  const response = await fetch(`${process.env.APP_BASE_URL ?? "http://localhost:3000"}/api/dashboard?${params.toString()}`, {
    cache: "no-store"
  });
  return response.json();
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const query = await searchParams;
  const data = await getDashboard(query);
=======
async function getDashboard() {
  const response = await fetch(`${process.env.APP_BASE_URL ?? "http://localhost:3000"}/api/dashboard`, { cache: "no-store" });
  return response.json();
}

export default async function DashboardPage() {
  const data = await getDashboard();
>>>>>>> origin/main
  const cards = data.cards;

  return (
    <section className="grid" style={{ gap: 24 }}>
      <h1>Dashboard gerencial</h1>
<<<<<<< HEAD
      <form className="card" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
        <input name="canalMarketplace" placeholder="Marketplace" defaultValue={query.canalMarketplace} />
        <input name="empresa" placeholder="Empresa" defaultValue={query.empresa} />
        <input name="startDate" type="date" />
        <input name="endDate" type="date" />
        <button type="submit">Filtrar</button>
      </form>
      <div className="grid grid-4">
        {Object.entries(cards ?? {}).map(([key, value]) => (
=======
      <div className="grid grid-4">
        {Object.entries(cards).map(([key, value]) => (
>>>>>>> origin/main
          <article key={key} className="card">
            <strong>{key}</strong>
            <p>{String(value)}</p>
          </article>
        ))}
      </div>
<<<<<<< HEAD
      <DashboardCharts charts={data.charts ?? {}} />
=======
      <div className="card">Gráficos analíticos por marketplace/empresa/motivo serão renderizados com Recharts na próxima fase incremental.</div>
>>>>>>> origin/main
    </section>
  );
}
