"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";
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

  // Native HTML5 drag-and-drop (draggable/onDragStart/onDrop above) never
  // fires from touch input at all — there's no touch equivalent in that
  // spec — so phones/tablets fall back silently to the status <select>.
  // This adds a parallel touch-drag path alongside it: touchstart doesn't
  // engage immediately (a plain tap must still reach links/selects inside
  // the card), only once the finger has moved past a small threshold.
  const [touchDragId, setTouchDragId] = useState<string | null>(null);
  const [touchOverStatus, setTouchOverStatus] = useState<string | null>(null);
  const touchStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const TOUCH_DRAG_THRESHOLD = 10;

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

  function onCardTouchStart(ticketId: string, event: ReactTouchEvent) {
    const touch = event.touches[0];
    touchStartRef.current = { id: ticketId, x: touch.clientX, y: touch.clientY };
  }

  function onCardTouchMove(event: ReactTouchEvent) {
    const pending = touchStartRef.current;
    if (!pending) return;

    const touch = event.touches[0];
    const distance = Math.hypot(touch.clientX - pending.x, touch.clientY - pending.y);

    if (touchDragId !== pending.id) {
      if (distance < TOUCH_DRAG_THRESHOLD) return;
      setTouchDragId(pending.id);
    }

    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const column = target instanceof Element ? target.closest<HTMLElement>("[data-kanban-status]") : null;
    setTouchOverStatus(column?.dataset.kanbanStatus ?? null);
  }

  async function onCardTouchEnd() {
    const pending = touchStartRef.current;
    touchStartRef.current = null;

    const draggedId = touchDragId;
    const targetStatus = touchOverStatus;
    setTouchDragId(null);
    setTouchOverStatus(null);

    if (!pending || !draggedId || !targetStatus) return;

    const dragged = items.find((item) => item.id === draggedId);
    if (!dragged || dragged.statusTicket === targetStatus) return;

    await move(dragged.id, targetStatus);
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
                data-kanban-status={status}
                className={`kanban-column${touchOverStatus === status ? " kanban-column-drag-over" : ""}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropColumn(status)}
              >
                <div className="kanban-column-head" style={{ background: toneByStatus[status] ?? "#64748b" }}>
                  <strong className="text-sm font-bold">{formatEnumLabel(status)}</strong>
                  <div className="mt-1 text-xs opacity-90">{columnItems.length} tickets</div>
                </div>

                <div className="kanban-column-body">
                  {columnItems.length === 0 ? <div className="empty-state">Arraste tickets para esta coluna</div> : null}
                  {visibleItems.map((ticket) => (
                    <article
                      key={ticket.id}
                      className={`card kanban-card${touchDragId === ticket.id ? " kanban-card-touch-dragging" : ""}`}
                      draggable
                      onDragStart={() => setActiveDragId(ticket.id)}
                      onDragEnd={() => setActiveDragId(null)}
                      onTouchStart={(e) => onCardTouchStart(ticket.id, e)}
                      onTouchMove={onCardTouchMove}
                      onTouchEnd={onCardTouchEnd}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm">{ticket.nomeCliente}</strong>
                        <Link href={`/tickets/${ticket.id}`} className="text-xs font-semibold text-brand-700 hover:underline">
                          Ver
                        </Link>
                      </div>
                      <p className="muted">SKU: {ticket.sku}</p>
                      <p className="muted">{formatEnumLabel(ticket.canalMarketplace)} • {formatEnumLabel(ticket.empresa)}</p>
                      <p className="mt-2 mb-0"><StatusBadge value={ticket.slaStatus ?? "NO_PRAZO"} /></p>
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
