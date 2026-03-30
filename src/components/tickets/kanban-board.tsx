"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { STATUS_TICKET } from "@/config/domains";
import { StatusBadge } from "@/components/ui/status-badge";
import { Ticket } from "@prisma/client";
import { formatEnumLabel } from "@/lib/formatters/display";

const toneByStatus: Record<string, string> = {
  ABERTO: "#3b82f6",
  AGUARDANDO_CLIENTE: "#eab308",
  AGUARDANDO_DEVOLUCAO: "#f97316",
  AGUARDANDO_ASSISTENCIA: "#a855f7",
  AGUARDANDO_MARKETPLACE: "#ec4899",
  CONCLUIDO: "#16a34a"
};

const DEFAULT_VISIBLE_CARDS = 10;

function getKanbanStatuses() {
  return [...STATUS_TICKET.filter((status) => status !== "CONCLUIDO"), "CONCLUIDO"];
}

export function KanbanBoard({ initialItems }: { initialItems: Ticket[] }) {
  const [items, setItems] = useState(Array.isArray(initialItems) ? initialItems : []);
  const [error, setError] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [expandedByStatus, setExpandedByStatus] = useState<Record<string, boolean>>({});
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const bottomScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);

  const statuses = useMemo(() => getKanbanStatuses(), []);

  const grouped = useMemo(
    () => statuses.reduce<Record<string, Ticket[]>>((acc, status) => {
      acc[status] = items.filter((ticket) => ticket.statusTicket === status);
      return acc;
    }, {}),
    [items, statuses]
  );

  async function move(ticketId: string, statusTicket: string) {
    setError(null);
    const response = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusTicket })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.message ?? "Falha ao atualizar ticket no kanban");
      return;
    }

    setItems((prev) => prev.map((item) => (item.id === ticketId ? { ...item, statusTicket: statusTicket as Ticket["statusTicket"] } : item)));
  }

  async function onDropColumn(status: string) {
    if (!activeDragId) return;
    const dragged = items.find((item) => item.id === activeDragId);
    setActiveDragId(null);
    if (!dragged || dragged.statusTicket === status) return;
    await move(dragged.id, status);
  }

  function syncScroll(source: "top" | "bottom") {
    if (syncingRef.current) return;
    syncingRef.current = true;

    if (source === "top" && topScrollRef.current && bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }

    if (source === "bottom" && topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }

    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }

  return (
    <div className="kanban-root">
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="kanban-scroll kanban-scroll-top" ref={topScrollRef} onScroll={() => syncScroll("top")}>
        <div className="kanban-scroll-spacer" />
      </div>

      <div className="kanban-scroll" ref={bottomScrollRef} onScroll={() => syncScroll("bottom")}>
        <div className="kanban-columns">
          {statuses.map((status) => {
            const columnItems = grouped[status] ?? [];
            const expanded = Boolean(expandedByStatus[status]);
            const visibleItems = expanded ? columnItems : columnItems.slice(0, DEFAULT_VISIBLE_CARDS);

            return (
              <div
                key={status}
                className="kanban-column"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropColumn(status)}
              >
                <div className="kanban-column-head" style={{ background: toneByStatus[status] ?? "#64748b" }}>
                  <strong>{formatEnumLabel(status)}</strong>
                  <div style={{ opacity: 0.9, marginTop: 4 }}>{columnItems.length} tickets</div>
                </div>

                <div className="kanban-column-body">
                  {columnItems.length === 0 ? <div className="empty-state">Arraste tickets para esta coluna</div> : null}
                  {visibleItems.map((ticket) => (
                    <article
                      key={ticket.id}
                      className="card kanban-card"
                      draggable
                      onDragStart={() => setActiveDragId(ticket.id)}
                      onDragEnd={() => setActiveDragId(null)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <strong>{ticket.nomeCliente}</strong>
                        <Link href={`/tickets/${ticket.id}`}>Ver</Link>
                      </div>
                      <p className="muted">SKU: {ticket.sku}</p>
                      <p className="muted">{formatEnumLabel(ticket.canalMarketplace)} • {formatEnumLabel(ticket.empresa)}</p>
                      <p style={{ margin: "8px 0 0" }}><StatusBadge value={ticket.slaStatus ?? "NO_PRAZO"} /></p>
                      <select defaultValue={ticket.statusTicket} onChange={(e) => move(ticket.id, e.target.value)}>
                        {statuses.map((item) => <option key={item} value={item}>{formatEnumLabel(item)}</option>)}
                      </select>
                    </article>
                  ))}

                  {columnItems.length > DEFAULT_VISIBLE_CARDS ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setExpandedByStatus((prev) => ({ ...prev, [status]: !expanded }))}
                    >
                      {expanded ? "Ver menos" : `Ver mais (${columnItems.length - DEFAULT_VISIBLE_CARDS})`}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
