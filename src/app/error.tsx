"use client";

import { AlertTriangle } from "lucide-react";

// This is the segment-level error boundary (not global-error.tsx), so it
// renders inside the existing root layout's <html>/<body> — wrapping it in
// its own <html>/<body> here breaks that nesting and is why this never
// rendered as the intended styled card, falling back to Next's default
// error screen instead.
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <section className="card m-6 max-w-lg">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[10px] bg-red-50 text-red-600">
        <AlertTriangle size={20} strokeWidth={2.25} />
      </div>
      <h1 className="mb-1 text-xl font-bold">Erro inesperado</h1>
      <p className="muted mb-4">{error.message}</p>
      <button className="btn btn-primary" onClick={() => reset()}>Tentar novamente</button>
    </section>
  );
}
