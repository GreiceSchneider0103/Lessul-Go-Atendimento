"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { EMPRESAS } from "@/config/domains";
import { formatEnumLabel } from "@/lib/formatters/display";

type EmpresaValue = (typeof EMPRESAS)[number];

const CATEGORIAS = ["GERAL", "ALTERACAO", "DUVIDA", "OUTRO"] as const;

export function SupportTicketForm({ empresasDisponiveis }: { empresasDisponiveis: EmpresaValue[] }) {
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
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      formData.delete("files");
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/support", { method: "POST", body: formData });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(body.message ?? "Falha ao abrir o chamado.");
        return;
      }

      router.push("/suporte");
      router.refresh();
    } catch {
      setError("Falha ao abrir o chamado.");
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
        <h3>Dados do chamado</h3>

        <div className="ticket-form-grid">
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
            Categoria
            <select name="categoria" defaultValue="GERAL" required>
              {CATEGORIAS.map((item) => (
                <option key={item} value={item}>
                  {formatEnumLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Título
          <input name="titulo" placeholder="Resuma o assunto do chamado" required minLength={3} />
        </label>

        <label>
          Descrição
          <textarea name="descricao" placeholder="Descreva o que você precisa" rows={5} required minLength={3} />
        </label>
      </section>

      <section className="ticket-form-section">
        <h3>Anexos (opcional)</h3>

        <div className="ticket-form-grid">
          <label>
            Adicionar fotos ou PDF
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
      </section>

      {error ? <p className="field-error">{error}</p> : null}

      <div className="ticket-form-actions">
        <button type="button" className="btn btn-secondary" onClick={() => router.push("/suporte")}>
          Cancelar
        </button>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Enviando..." : "Abrir chamado"}
        </button>
      </div>
    </form>
  );
}
