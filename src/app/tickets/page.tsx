import { requireCurrentUser } from "@/lib/auth/require-user";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { CANAIS_MARKETPLACE, EMPRESAS, MOTIVOS } from "@/config/domains";
import { TicketListResponse } from "@/lib/contracts";
import { listTickets } from "@/lib/services/tickets-service";
import { ticketFiltersSchema } from "@/lib/validation/ticket";
import { formatEnumLabel } from "@/lib/formatters/display";
import { TicketListTable } from "@/components/tickets/ticket-list-table";

async function getTickets(
  query: Record<string, string | undefined>,
  user: Awaited<ReturnType<typeof requireCurrentUser>>
): Promise<{
  data: TicketListResponse["data"];
  pagination: TicketListResponse["pagination"];
  error: string | null;
}> {
  const parsed = ticketFiltersSchema.safeParse(query);

  if (!parsed.success) {
    return {
      data: [],
      pagination: {
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0
      },
      error: "Filtros inválidos"
    };
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

    return {
      data: [],
      pagination: {
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0
      },
      error: message
    };
  }
}

function buildTicketHref(query: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  });

  params.set("page", String(page));

  if (!params.get("pageSize")) {
    params.set("pageSize", "20");
  }

  return `/tickets?${params.toString()}`;
}

export default async function TicketsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireCurrentUser();
  const query = await searchParams;

  const normalizedQuery: Record<string, string | undefined> = {
    ...query,
    page: query.page ?? "1",
    pageSize: query.pageSize ?? "20",
    includeConcluidos: query.includeConcluidos ?? "false"
  };

  const result = await getTickets(normalizedQuery, user);

  const currentPage = result.pagination.page;
  const totalPages = Math.max(result.pagination.totalPages, 1);
  const pagesWindow = Array.from(new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])).filter(
    (item) => item >= 1 && item <= totalPages
  );

  return (
    <section className="page">
      <div className="page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Lista de tickets</h1>
          <p className="muted">Visualização operacional com filtros, paginação e status de SLA.</p>
        </div>

        <Link href="/tickets/new" className="btn btn-primary btn-create-ticket whitespace-nowrap">
          <Plus size={16} strokeWidth={2.5} aria-hidden />
          Criar ticket
        </Link>
      </div>

      <form
        className="panel grid items-end gap-4"
        method="GET"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
      >
        <div className="col-span-2">
          <label>
            Busca
            <input name="search" placeholder="Cliente, venda, produto" defaultValue={normalizedQuery.search} />
          </label>
        </div>

        <label>
          SKU
          <input name="sku" placeholder="SKU" defaultValue={normalizedQuery.sku} />
        </label>

        <label>
          Marketplace
          <select name="canalMarketplace" defaultValue={normalizedQuery.canalMarketplace ?? ""}>
            <option value="">Todos</option>
            {CANAIS_MARKETPLACE.map((item) => (
              <option key={item} value={item}>
                {formatEnumLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Empresa
          <select name="empresa" defaultValue={normalizedQuery.empresa ?? ""}>
            <option value="">Todas</option>
            {EMPRESAS.map((item) => (
              <option key={item} value={item}>
                {formatEnumLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Motivo
          <select name="motivo" defaultValue={normalizedQuery.motivo ?? ""}>
            <option value="">Todos</option>
            {MOTIVOS.map((item) => (
              <option key={item} value={item}>
                {formatEnumLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Data inicial
          <input name="startDate" type="date" defaultValue={normalizedQuery.startDate} />
        </label>

        <label>
          Data final
          <input name="endDate" type="date" defaultValue={normalizedQuery.endDate} />
        </label>

        <label>
          Ordenar por
          <select name="orderBy" defaultValue={normalizedQuery.orderBy ?? "criadoEm"}>
            <option value="criadoEm">Criação</option>
            <option value="dataReclamacao">Reclamação</option>
            <option value="custosTotais">Custos</option>
            <option value="prazoConclusao">Prazo</option>
          </select>
        </label>

        <div className="flex h-[42px] items-center gap-2">
          <input
            id="includeConcluidos"
            type="checkbox"
            name="includeConcluidos"
            value="true"
            defaultChecked={normalizedQuery.includeConcluidos === "true"}
            className="h-4 w-4 flex-none"
          />
          <label htmlFor="includeConcluidos" className="m-0 text-sm font-medium text-slate-600">
            Incluir concluídos
          </label>
        </div>

        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={normalizedQuery.pageSize ?? "20"} />

        <button type="submit" className="btn btn-primary h-[42px]">
          Aplicar filtros
        </button>
      </form>

      {result.error ? <div className="alert alert-error">{result.error}</div> : null}

      <div className="panel table-wrap">
        <TicketListTable initialItems={result.data} />
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm text-slate-700">
          Página {result.pagination.page} de {totalPages} • total {result.pagination.total}
        </strong>

        <div className="flex flex-wrap items-center gap-2">
          <a
            className="btn btn-secondary"
            aria-disabled={currentPage <= 1}
            href={buildTicketHref(normalizedQuery, Math.max(currentPage - 1, 1))}
          >
            <ChevronLeft size={15} aria-hidden />
            Anterior
          </a>

          {pagesWindow.map((pageNumber) => (
            <a
              key={pageNumber}
              className={`btn ${pageNumber === currentPage ? "btn-primary" : "btn-secondary"}`}
              href={buildTicketHref(normalizedQuery, pageNumber)}
            >
              {pageNumber}
            </a>
          ))}

          <a
            className="btn btn-secondary"
            aria-disabled={currentPage >= totalPages}
            href={buildTicketHref(normalizedQuery, Math.min(currentPage + 1, totalPages))}
          >
            Próxima
            <ChevronRight size={15} aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}