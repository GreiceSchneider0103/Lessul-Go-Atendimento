import { requireCurrentUser } from "@/lib/auth/require-user";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { CANAIS_MARKETPLACE, EMPRESAS, MOTIVOS, STATUS_RECLAMACAO, STATUS_TICKET } from "@/config/domains";
import { TicketListResponse } from "@/lib/contracts";
import { listTickets } from "@/lib/services/tickets-service";
import { ticketFiltersSchema } from "@/lib/validation/ticket";
import { formatDateBR, formatEnumLabel } from "@/lib/formatters/display";
import { prisma } from "@/lib/db/prisma";

async function getTickets(query: Record<string, string | undefined>, user: Awaited<ReturnType<typeof requireCurrentUser>>): Promise<{ data: TicketListResponse["data"]; pagination: TicketListResponse["pagination"]; error: string | null }> {
  const parsed = ticketFiltersSchema.safeParse(query);
  if (!parsed.success) {
    return { data: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 0 }, error: "Filtros inválidos" };
  }

  try {
    const payload = await listTickets(parsed.data, user);
    return {
      data: payload.data,
      pagination: payload.pagination,
      error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar tickets";
    return { data: [], pagination: { total: 0, page: 1, pageSize: 20, totalPages: 0 }, error: message };
  }
}

function buildTicketHref(query: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, value);
  });
  params.set("page", String(page));
  if (!params.get("pageSize")) params.set("pageSize", "20");
  return `/tickets?${params.toString()}`;
}

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireCurrentUser();
  const query = await searchParams;
  const normalizedQuery: Record<string, string | undefined> = {
    ...query,
    page: query.page ?? "1",
    pageSize: query.pageSize ?? "20",
    includeConcluidos: query.includeConcluidos ?? "false"
  };

  const [result, users] = await Promise.all([
    getTickets(normalizedQuery, user),
    prisma.usuario.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } })
  ]);

  const currentPage = result.pagination.page;
  const totalPages = Math.max(result.pagination.totalPages, 1);
  const pagesWindow = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])).filter((item) => item >= 1 && item <= totalPages);

  return (
    <section className="page">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1>Lista de tickets</h1>
          <p className="muted">Visualização operacional com filtros, paginação e status de SLA.</p>
        </div>
        <Link href="/tickets/new" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>Criar ticket</Link>
      </div>

      <form className="panel form-grid cols-4" method="GET">
        <input name="search" placeholder="Busca por cliente, venda, produto" defaultValue={normalizedQuery.search} />
        <input name="sku" placeholder="SKU" defaultValue={normalizedQuery.sku} />
        <select name="canalMarketplace" defaultValue={normalizedQuery.canalMarketplace ?? ""}>
          <option value="">Todos os marketplaces</option>
          {CANAIS_MARKETPLACE.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}
        </select>
        <select name="empresa" defaultValue={normalizedQuery.empresa ?? ""}>
          <option value="">Todas as empresas</option>
          {EMPRESAS.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}
        </select>
        <select name="statusTicket" defaultValue={normalizedQuery.statusTicket ?? ""}>
          <option value="">Todos os status de ticket</option>
          {STATUS_TICKET.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}</select>
        <select name="statusReclamacao" defaultValue={normalizedQuery.statusReclamacao ?? ""}>
          <option value="">Todos os status de reclamação</option>
          {STATUS_RECLAMACAO.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}</select>
        <select name="motivo" defaultValue={normalizedQuery.motivo ?? ""}>
          <option value="">Todos os motivos</option>
          {MOTIVOS.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}</select>
        <select name="responsavelId" defaultValue={normalizedQuery.responsavelId ?? ""}>
          <option value="">Todos os responsáveis</option>
          {users.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
        <select name="criadoPorId" defaultValue={normalizedQuery.criadoPorId ?? ""}>
          <option value="">Todos os criadores</option>
          {users.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
        <input name="startDate" type="date" defaultValue={normalizedQuery.startDate} />
        <input name="endDate" type="date" defaultValue={normalizedQuery.endDate} />
        <select name="orderBy" defaultValue={normalizedQuery.orderBy ?? "criadoEm"}>
          <option value="criadoEm">Criado em</option>
          <option value="dataReclamacao">Data reclamação</option>
          <option value="custosTotais">Custos</option>
          <option value="prazoConclusao">Prazo</option>
        </select>
        <select name="orderDir" defaultValue={normalizedQuery.orderDir ?? "desc"}>
          <option value="desc">Mais recentes primeiro</option>
          <option value="asc">Mais antigos primeiro</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input style={{ width: 16, height: 16 }} type="checkbox" name="includeConcluidos" value="true" defaultChecked={normalizedQuery.includeConcluidos === "true"} />
          Incluir concluídos
        </label>
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={normalizedQuery.pageSize ?? "20"} />
        <button type="submit" className="btn btn-secondary">Aplicar filtros</button>
      </form>

      {result.error ? <div className="alert alert-error">{result.error}</div> : null}

      <div className="panel table-wrap">
        {!result.data.length ? (
          <div className="empty-state">Nenhum ticket encontrado para os filtros atuais.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nome do cliente</th>
                <th>SKU</th>
                <th>Marketplace</th>
                <th>Empresa</th>
                <th>Motivo</th>
                <th>Status ticket</th>
                <th>Status reclamação</th>
                <th>Prazo</th>
                <th>SLA</th>
                <th>Custos totais</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((item) => (
                <tr key={item.id}>
                  <td><Link href={`/tickets/${item.id}`}>{item.nomeCliente}</Link></td>
                  <td>{item.sku}</td>
                  <td><StatusBadge value={item.canalMarketplace} /></td>
                  <td><StatusBadge value={item.empresa} /></td>
                  <td><StatusBadge value={item.motivo} /></td>
                  <td><StatusBadge value={item.statusTicket} /></td>
                  <td><StatusBadge value={item.statusReclamacao} /></td>
                  <td>{formatDateBR(item.prazoConclusao as unknown as string)}</td>
                  <td><StatusBadge value={item.slaStatus} /></td>
                  <td>{Number(item.custosTotais).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
        <strong>Paginação:</strong> página {result.pagination.page} de {totalPages} • total {result.pagination.total}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Link className="btn btn-secondary" aria-disabled={currentPage <= 1} href={buildTicketHref(normalizedQuery, Math.max(currentPage - 1, 1))}>Anterior</Link>
          {pagesWindow.map((pageNumber) => (
            <Link
              key={pageNumber}
              className={`btn ${pageNumber === currentPage ? "btn-primary" : "btn-secondary"}`}
              href={buildTicketHref(normalizedQuery, pageNumber)}
            >
              {pageNumber}
            </Link>
          ))}
          <Link className="btn btn-secondary" aria-disabled={currentPage >= totalPages} href={buildTicketHref(normalizedQuery, Math.min(currentPage + 1, totalPages))}>Próxima</Link>
        </div>
      </div>
    </section>
  );
}
