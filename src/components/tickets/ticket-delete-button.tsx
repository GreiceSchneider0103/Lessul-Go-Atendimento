"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TicketDeleteButtonProps = {
  ticketId: string;
  redirectTo?: "/tickets";
};

export function TicketDeleteButton({ ticketId, redirectTo = "/tickets" }: TicketDeleteButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const confirmed = window.confirm("Tem certeza que deseja excluir este ticket? Esta ação fará exclusão lógica e removerá o ticket das listagens ativas.");
    if (!confirmed) return;

    setLoading(true);
    setError(null);

    const response = await fetch(`/api/tickets/${ticketId}`, { method: "DELETE" });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body?.message ?? "Não foi possível excluir o ticket.");
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn btn-danger" onClick={onDelete} disabled={loading}>
        {loading ? "Excluindo..." : "Excluir ticket"}
      </button>
      {error ? <p style={{ margin: 0, color: "#b91c1c" }}>{error}</p> : null}
    </>
  );
}
