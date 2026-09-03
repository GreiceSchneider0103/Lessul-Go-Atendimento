"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DevolucaoDefeito, DevolucaoSolucao } from "@prisma/client";
import { CANAIS_MARKETPLACE } from "@/config/domains";
import { formatEnumLabel } from "@/lib/formatters/display";

const DEFEITOS = Object.values(DevolucaoDefeito);
const SOLUCOES = Object.values(DevolucaoSolucao);

export type DevolucaoInternaFormValues = {
  codigoVenda: string;
  cliente: string;
  canalMarketplace: string;
  produto: string;
  sku: string;
  defeito: DevolucaoDefeito;
  dataRecebimento: string;
  dataRevisao: string;
  solucao: DevolucaoSolucao | "";
  solicitadoReembolso: boolean;
  valorRecuperado: number;
  observacao: string;
};

const emptyValues: DevolucaoInternaFormValues = {
  codigoVenda: "",
  cliente: "",
  canalMarketplace: "MERCADO_LIVRE",
  produto: "",
  sku: "",
  defeito: "NENHUM",
  dataRecebimento: "",
  dataRevisao: "",
  solucao: "",
  solicitadoReembolso: false,
  valorRecuperado: 0,
  observacao: ""
};

export function DevolucaoInternaForm({ id, initialValues }: { id?: string; initialValues?: Partial<DevolucaoInternaFormValues> }) {
  const router = useRouter();
  const [values, setValues] = useState<DevolucaoInternaFormValues>({ ...emptyValues, ...initialValues });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof DevolucaoInternaFormValues>(key: K, value: DevolucaoInternaFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const url = id ? `/api/devolucoes-internas/${id}` : "/api/devolucoes-internas";
      const response = await fetch(url, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const issueMessage = Array.isArray(body?.issues)
          ? body.issues.map((issue: { path?: string[]; message?: string }) => `${issue.path?.join(".") ?? "campo"}: ${issue.message ?? "inválido"}`).join(" | ")
          : null;
        setError(issueMessage ?? body.message ?? "Falha ao salvar registro");
        return;
      }

      router.push("/devolucoes-internas");
      router.refresh();
    } catch {
      setError("Falha ao salvar registro.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel ticket-form">
      <section className="ticket-form-section">
        <h3>Dados do pedido</h3>

        <div className="ticket-form-grid">
          <label>
            Código da venda
            <input required value={values.codigoVenda} onChange={(e) => update("codigoVenda", e.target.value)} placeholder="Código da venda" />
          </label>

          <label>
            Cliente
            <input required value={values.cliente} onChange={(e) => update("cliente", e.target.value)} placeholder="Nome do cliente" />
          </label>

          <label>
            Canal / Marketplace
            <select value={values.canalMarketplace} onChange={(e) => update("canalMarketplace", e.target.value)}>
              {CANAIS_MARKETPLACE.map((item) => (
                <option key={item} value={item}>{formatEnumLabel(item)}</option>
              ))}
            </select>
          </label>

          <label>
            Produto
            <input required value={values.produto} onChange={(e) => update("produto", e.target.value)} placeholder="Produto" />
          </label>

          <label>
            SKU
            <input value={values.sku} onChange={(e) => update("sku", e.target.value)} placeholder="SKU" />
          </label>
        </div>
      </section>

      <section className="ticket-form-section">
        <h3>Recebimento e revisão</h3>

        <div className="ticket-form-grid">
          <label>
            Defeito
            <select value={values.defeito} onChange={(e) => update("defeito", e.target.value as DevolucaoDefeito)}>
              {DEFEITOS.map((item) => (
                <option key={item} value={item}>{formatEnumLabel(item)}</option>
              ))}
            </select>
          </label>

          <label>
            Data de recebimento
            <input type="date" value={values.dataRecebimento} onChange={(e) => update("dataRecebimento", e.target.value)} />
          </label>

          <label>
            Data de revisão
            <input type="date" value={values.dataRevisao} onChange={(e) => update("dataRevisao", e.target.value)} />
          </label>

          <label>
            Solução
            <select value={values.solucao} onChange={(e) => update("solucao", e.target.value as DevolucaoSolucao | "")}>
              <option value="">Sem solução definida</option>
              {SOLUCOES.map((item) => (
                <option key={item} value={item}>{formatEnumLabel(item)}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Observação
          <textarea value={values.observacao} onChange={(e) => update("observacao", e.target.value)} rows={3} placeholder="Observações adicionais" />
        </label>
      </section>

      <section className="ticket-form-section">
        <h3>Recuperação de valor</h3>

        <div className="ticket-form-grid">
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={values.solicitadoReembolso}
              onChange={(e) => update("solicitadoReembolso", e.target.checked)}
              style={{ width: "auto" }}
            />
            Reembolso solicitado ao marketplace
          </label>

          <label>
            Valor recuperado
            <input
              type="number"
              step="0.01"
              min="0"
              value={values.valorRecuperado}
              onChange={(e) => update("valorRecuperado", Number(e.target.value))}
              placeholder="R$ 0,00"
            />
          </label>
        </div>
      </section>

      {error ? <p className="field-error">{error}</p> : null}

      <div className="ticket-form-actions">
        <button type="button" className="btn btn-secondary" onClick={() => router.push("/devolucoes-internas")}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
