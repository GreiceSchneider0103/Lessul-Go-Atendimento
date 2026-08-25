"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { formatDateTimeBR } from "@/lib/formatters/display";

type TokenRow = {
  id: string;
  label: string | null;
  createdAt: string | Date;
  lastUsedAt: string | Date | null;
  revokedAt: string | Date | null;
};

type Props = {
  initialTokens: TokenRow[];
};

export function ExtensionTokenManager({ initialTokens }: Props) {
  const [tokens, setTokens] = useState(initialTokens);
  const [label, setLabel] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/extension/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() || undefined })
      });
      const body = await response.json();

      if (!response.ok) throw new Error(body?.message ?? "Falha ao gerar token");

      setNewToken(body.data.token);
      setCopied(false);
      setLabel("");

      const listResponse = await fetch("/api/extension/tokens");
      const listBody = await listResponse.json();
      if (listResponse.ok) setTokens(listBody.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar token");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revogar este token? A extensão conectada a ele deixará de funcionar.")) return;

    try {
      const response = await fetch(`/api/extension/tokens/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body?.message ?? "Falha ao revogar token");
      }
      setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, revokedAt: new Date().toISOString() } : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao revogar token");
    }
  }

  async function handleCopy() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      <article className="card">
        <strong className="text-sm font-bold text-slate-800">Gerar novo token</strong>
        <p className="muted" style={{ marginTop: 4, marginBottom: 12 }}>
          Cole o token gerado nas opções da extensão do Chrome. Ele é exibido apenas uma vez.
        </p>

        {newToken ? (
          <div className="alert alert-error" style={{ background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <code style={{ fontSize: 12.5, wordBreak: "break-all" }}>{newToken}</code>
            <button type="button" className="btn btn-secondary" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        ) : null}

        <div className="filters-inline-row" style={{ marginTop: 12 }}>
          <label style={{ flex: 1 }}>
            <input
              type="text"
              placeholder="Rótulo (opcional, ex.: notebook do atendimento)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
            {loading ? "Gerando..." : "Gerar token"}
          </button>
        </div>

        {error ? <p className="field-error">{error}</p> : null}
      </article>

      <article className="card">
        <strong className="text-sm font-bold text-slate-800">Tokens ativos</strong>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Rótulo</th>
                <th>Criado em</th>
                <th>Último uso</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tokens.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">Nenhum token gerado ainda.</td>
                </tr>
              ) : (
                tokens.map((token) => (
                  <tr key={token.id}>
                    <td>{token.label ?? "—"}</td>
                    <td>{formatDateTimeBR(token.createdAt)}</td>
                    <td>{token.lastUsedAt ? formatDateTimeBR(token.lastUsedAt) : "Nunca usado"}</td>
                    <td>
                      {token.revokedAt ? (
                        <span className="badge badge-danger">Revogado</span>
                      ) : (
                        <span className="badge badge-success">Ativo</span>
                      )}
                    </td>
                    <td>
                      {!token.revokedAt && (
                        <button type="button" className="btn btn-danger" onClick={() => handleRevoke(token.id)}>
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
