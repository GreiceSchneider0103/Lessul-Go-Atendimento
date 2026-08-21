"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { CANAIS_MARKETPLACE, EMPRESAS } from "@/config/domains";
import { formatEnumLabel } from "@/lib/formatters/display";

type EmpresaValue = (typeof EMPRESAS)[number];

export function DevolucaoRecebidaForm({ empresasDisponiveis }: { empresasDisponiveis: EmpresaValue[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const semEmpresaDisponivel = empresasDisponiveis.length === 0;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Anexe uma foto do produto recebido.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      formData.set("file", file);

      const response = await fetch("/api/loja/devolucoes", {
        method: "POST",
        body: formData
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.message ?? "Falha ao registrar a devolução recebida.");
        return;
      }

      router.push("/loja/solicitacoes");
      router.refresh();
    } catch {
      setError("Falha ao registrar a devolução recebida.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (semEmpresaDisponivel) {
    return <p className="panel field-error">Nenhuma empresa vinculada ao usuário atual.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="panel ticket-form">
      <section className="ticket-form-section">
        <h3>Dados do pedido</h3>

        <div className="ticket-form-grid">
          <label>
            Nome do cliente
            <input name="nomeCliente" placeholder="Nome do cliente" required minLength={3} />
          </label>

          <label>
            Número da venda
            <input name="numeroVenda" placeholder="Número da venda" required minLength={3} />
          </label>

          <label>
            Marketplace
            <select name="canalMarketplace" defaultValue={CANAIS_MARKETPLACE[0]} required>
              {CANAIS_MARKETPLACE.map((item) => (
                <option key={item} value={item}>
                  {formatEnumLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Empresa
            <select name="empresa" defaultValue={empresasDisponiveis[0]} required>
              {empresasDisponiveis.map((item) => (
                <option key={item} value={item}>
                  {formatEnumLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Produto
            <input name="produto" placeholder="Produto" required minLength={2} />
          </label>

          <label>
            SKU
            <input name="sku" placeholder="SKU" required minLength={2} />
          </label>
        </div>
      </section>

      <section className="ticket-form-section">
        <h3>Foto do produto recebido</h3>

        <div className="ticket-form-grid">
          <label>
            Anexo
            <input
              type="file"
              accept="image/*,application/pdf"
              required
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <p className="muted">
          <Paperclip size={13} strokeWidth={2.25} className="mr-1 inline" aria-hidden />
          A foto é obrigatória — ela é o comprovante usado para cobrar o marketplace.
        </p>
      </section>

      {error ? <p className="field-error">{error}</p> : null}

      <div className="ticket-form-actions">
        <button type="button" className="btn btn-secondary" onClick={() => router.push("/loja/solicitacoes")}>
          Cancelar
        </button>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Enviando..." : "Registrar devolução recebida"}
        </button>
      </div>
    </form>
  );
}
