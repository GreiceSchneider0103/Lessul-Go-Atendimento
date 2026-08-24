"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, X } from "lucide-react";
import { CANAIS_MARKETPLACE, EMPRESAS } from "@/config/domains";
import { formatEnumLabel } from "@/lib/formatters/display";

type EmpresaValue = (typeof EMPRESAS)[number];

const MIN_PHOTOS = 5;

export function DevolucaoRecebidaForm({ empresasDisponiveis }: { empresasDisponiveis: EmpresaValue[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const semEmpresaDisponivel = empresasDisponiveis.length === 0;

  function addFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    setFiles((prev) => [...prev, ...Array.from(selected)]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (files.length < MIN_PHOTOS) {
      setError(`Anexe pelo menos ${MIN_PHOTOS} fotos do produto recebido.`);
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      formData.delete("files");
      files.forEach((file) => formData.append("files", file));

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
        <h3>Fotos do produto recebido</h3>

        <div className="alert flex items-start gap-2" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8" }}>
          <Info size={16} strokeWidth={2.25} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Envie pelo menos {MIN_PHOTOS} fotos — dá pra anexar mais se precisar. Inclua a etiqueta do produto e as
            avarias/danos visíveis, além de fotos gerais do item recebido.
          </span>
        </div>

        <div className="ticket-form-grid">
          <label>
            Adicionar fotos
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>

        {files.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-xs font-medium text-slate-700"
              >
                {file.name}
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-transparent p-0 text-slate-500 hover:bg-slate-200"
                  aria-label={`Remover ${file.name}`}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <p className={files.length < MIN_PHOTOS ? "field-error" : "muted"}>
          {files.length} de {MIN_PHOTOS} fotos obrigatórias selecionadas.
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
