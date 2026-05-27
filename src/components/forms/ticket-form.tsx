"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CANAIS_MARKETPLACE, EMPRESAS, MOTIVOS, RESOLUCOES, STATUS_RECLAMACAO, STATUS_TICKET } from "@/config/domains";
import { formatEnumLabel } from "@/lib/formatters/display";
import { TicketFormInput, ticketFormSchema } from "@/lib/validation/ticket";

type AssignableUser = { id: string; nome: string };

type UserPerfil = "ATENDENTE" | "SUPERVISOR" | "ADMIN" | "LOJA";

type TicketAttachment = {
  fileUrl?: string | null;
  fileName?: string | null;
  filePath?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedAt?: string | null;
};

type TicketFormProps = {
  ticketId?: string;
  initialValues?: Partial<TicketFormInput>;
  canEditSensitive?: boolean;
  assignableUsers?: AssignableUser[];
  cancelHref?: "/tickets" | `/tickets/${string}`;
  ticketAttachment?: TicketAttachment;
  userPerfil?: UserPerfil;
};

function toText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function toNullableText(value: unknown): string | null {
  const text = toText(value).trim();
  return text.length ? text : null;
}

function toNumberValue(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const parsed = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateInput(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return "";
}

function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function TicketForm({
  ticketId,
  initialValues,
  canEditSensitive = true,
  assignableUsers = [],
  cancelHref,
  ticketAttachment,
  userPerfil
}: TicketFormProps) {
  const router = useRouter();

  const [requestError, setRequestError] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentMessage, setAttachmentMessage] = useState<string | null>(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [currentAttachment, setCurrentAttachment] = useState<TicketAttachment | undefined>(ticketAttachment);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<TicketFormInput>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      nomeCliente: toText(initialValues?.nomeCliente),
      dataCompra: toDateInput(initialValues?.dataCompra),
      numeroVenda: toText(initialValues?.numeroVenda),
      linkPedido: toText(initialValues?.linkPedido),
      uf: toText(initialValues?.uf),
      cpf: toText(initialValues?.cpf),
      canalMarketplace: toText(initialValues?.canalMarketplace) || "MERCADO_LIVRE",
      empresa: toText(initialValues?.empresa) || "LESSUL",
      produto: toText(initialValues?.produto),
      sku: toText(initialValues?.sku),
      fabricante: toText(initialValues?.fabricante),
      transportadora: toText(initialValues?.transportadora),
      statusReclamacao: toText(initialValues?.statusReclamacao) || "AFETANDO",
      dataReclamacao: toDateInput(initialValues?.dataReclamacao),
      motivo: toText(initialValues?.motivo) || "DESISTENCIA",
      detalhesCliente: toText(initialValues?.detalhesCliente),
      comentarioInterno: toText(initialValues?.comentarioInterno),
      resolucao: toNullableText(initialValues?.resolucao),
      valorReembolso: toNumberValue(initialValues?.valorReembolso),
      valorColeta: toNumberValue(initialValues?.valorColeta),
      valorAssistencia: toNumberValue(initialValues?.valorAssistencia),
      valorColetaEnvioPecas: toNumberValue(initialValues?.valorColetaEnvioPecas),
      codigoRastreio: toText(initialValues?.codigoRastreio),
      statusOperacionalLoja: toText(initialValues?.statusOperacionalLoja) || "EM_ABERTO",
      comentarioLoja: toText(initialValues?.comentarioLoja),
      statusTicket: toText(initialValues?.statusTicket) || "ABERTO",
      prazoConclusao: toDateInput(initialValues?.prazoConclusao),
      responsavelId: toNullableText(initialValues?.responsavelId),
      acaoOperacionalLoja: toText(initialValues?.acaoOperacionalLoja) || "NENHUMA"
    } as Partial<TicketFormInput>
  });

  async function onSubmit(values: TicketFormInput) {
    setRequestError(null);

    const dataCompra = toIsoDate(values.dataCompra);
    const dataReclamacao = toIsoDate(values.dataReclamacao);

    if (!dataCompra || !dataReclamacao) {
      setRequestError("Informe a data da compra e a data da reclamação.");
      return;
    }

    const payload = {
      ...values,
      uf: toText(values.uf).toUpperCase(),
      dataCompra,
      dataReclamacao,
      prazoConclusao: toIsoDate(values.prazoConclusao),
      linkPedido: toText(values.linkPedido),
      fabricante: toText(values.fabricante),
      transportadora: toText(values.transportadora),
      detalhesCliente: toText(values.detalhesCliente),
      comentarioInterno: toText(values.comentarioInterno),
      comentarioLoja: toText(values.comentarioLoja),
      codigoRastreio: toText(values.codigoRastreio),
      responsavelId: toNullableText(values.responsavelId),
      resolucao: toNullableText(values.resolucao),
      valorReembolso: toNumberValue(values.valorReembolso),
      valorColeta: toNumberValue(values.valorColeta),
      valorAssistencia: toNumberValue(values.valorAssistencia),
      valorColetaEnvioPecas: toNumberValue(values.valorColetaEnvioPecas)
    };

    const url = ticketId ? `/api/tickets/${ticketId}` : "/api/tickets";
    const method = ticketId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "Erro desconhecido" }));

      const issueMessage = Array.isArray(body?.issues)
        ? body.issues
            .map((issue: { path?: string[]; message?: string }) => `${issue.path?.join(".") ?? "campo"}: ${issue.message ?? "inválido"}`)
            .join(" | ")
        : null;

      setRequestError(issueMessage ?? body.message ?? "Falha ao salvar ticket");
      return;
    }

    if (payload.acaoOperacionalLoja !== "NENHUMA" && ticketId) {
      await fetch("/api/operational-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, tipoAcao: payload.acaoOperacionalLoja })
      });
    }

    router.push("/tickets");
    router.refresh();
  }

  function errorFor(field: keyof TicketFormInput) {
    return errors[field]?.message;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="panel ticket-form">
      <section className="ticket-form-section">
        <h3>Dados principais</h3>

        <div className="ticket-form-grid">
          <label>
            Nome do cliente
            <input {...register("nomeCliente")} placeholder="Nome do cliente" />
            {errorFor("nomeCliente") ? <small className="field-error">{errorFor("nomeCliente")}</small> : null}
          </label>

          <label>
            Número da venda
            <input {...register("numeroVenda")} placeholder="Número da venda" />
            {errorFor("numeroVenda") ? <small className="field-error">{errorFor("numeroVenda")}</small> : null}
          </label>

          <label>
            Data da compra
            <input {...register("dataCompra")} type="date" />
          </label>

          <label>
            Data da reclamação
            <input {...register("dataReclamacao")} type="date" />
          </label>

          <label>
            Prazo de conclusão
            <input {...register("prazoConclusao")} type="date" disabled={!canEditSensitive} />
          </label>

          <label>
            Link do pedido
            <input {...register("linkPedido")} placeholder="https://..." />
          </label>
        </div>
      </section>

      <section className="ticket-form-section">
        <h3>Classificação e responsáveis</h3>

        <div className="ticket-form-grid">
          <label>
            Canal / Marketplace
            <select {...register("canalMarketplace")}>
              {CANAIS_MARKETPLACE.map((item) => (
                <option key={item} value={item}>
                  {formatEnumLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Empresa
            <select {...register("empresa")}>
              {EMPRESAS.map((item) => (
                <option key={item} value={item}>
                  {formatEnumLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Produto
            <input {...register("produto")} placeholder="Produto" />
          </label>

          <label>
            SKU
            <input {...register("sku")} placeholder="SKU" />
          </label>

          <label>
            Status da reclamação
            <select {...register("statusReclamacao")}>
              {STATUS_RECLAMACAO.map((item) => (
                <option key={item} value={item}>
                  {formatEnumLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Motivo
            <select {...register("motivo")}>
              {MOTIVOS.map((item) => (
                <option key={item} value={item}>
                  {formatEnumLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Status do ticket
            <select {...register("statusTicket")}>
              {STATUS_TICKET.map((item) => (
                <option key={item} value={item}>
                  {formatEnumLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Responsável
            <select {...register("responsavelId")}>
              <option value="">Não atribuído</option>
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="ticket-form-section">
        <h3>Dados complementares</h3>

        <div className="ticket-form-grid">
          <label>
            UF
            <input {...register("uf")} placeholder="UF" maxLength={2} />
          </label>

          <label>
            CPF
            <input {...register("cpf")} placeholder="CPF" />
          </label>

          <label>
            Fabricante
            <input {...register("fabricante")} placeholder="Fabricante" />
          </label>

          <label>
            Transportadora
            <input {...register("transportadora")} placeholder="Transportadora" />
          </label>

          <label>
            Resolução
            <select {...register("resolucao")} disabled={!canEditSensitive}>
              <option value="">Sem resolução</option>
              {RESOLUCOES.map((item) => (
                <option key={item} value={item}>
                  {formatEnumLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Valor de reembolso
            <input {...register("valorReembolso", { valueAsNumber: true })} type="number" step="0.01" placeholder="Valor reembolso" disabled={!canEditSensitive} />
          </label>

          <label>
            Ação operacional da loja
            <select {...register("acaoOperacionalLoja")}>
              <option value="NENHUMA">Nenhuma</option>
              <option value="ASSISTENCIA">Enviar assistência</option>
              <option value="COLETA">Solicitar coleta</option>
              <option value="DEVOLUCAO">Realizar devolução</option>
              <option value="REEMBOLSO">Realizar reembolso</option>
            </select>
          </label>

          <label>
            Valor de assistência
            <input {...register("valorAssistencia", { valueAsNumber: true })} type="number" step="0.01" placeholder="R$ 0,00" />
          </label>

          <label>
            Valor de coleta, envio ou peças operacional
            <input {...register("valorColetaEnvioPecas", { valueAsNumber: true })} type="number" step="0.01" placeholder="R$ 0,00" />
          </label>

          <label>
            Código de rastreio
            <input {...register("codigoRastreio")} placeholder="Código de rastreio" />
          </label>

          <label>
            Status operacional da loja
            <select {...register("statusOperacionalLoja")}>
              <option value="EM_ABERTO">Em aberto</option>
              <option value="ASSISTENCIA_ENVIADA">Assistência enviada</option>
              <option value="ASSISTENCIA_A_CAMINHO">Assistência a caminho</option>
              <option value="ASSISTENCIA_ENTREGUE">Assistência entregue</option>
              <option value="COLETA_SOLICITADA">Coleta solicitada</option>
              <option value="COLETA_FEITA">Coleta feita</option>
              <option value="DEVOLUCAO_SOLICITADA">Devolução solicitada</option>
              <option value="DEVOLUCAO_A_CAMINHO">Devolução a caminho</option>
              <option value="DEVOLUCAO_REALIZADA">Devolução realizada</option>
              <option value="REEMBOLSO_PENDENTE">Reembolso pendente</option>
              <option value="REEMBOLSO_REALIZADO">Reembolso realizado</option>
              <option value="AGUARDANDO_ATENDENTE">Aguardando atendente</option>
              <option value="CONCLUIDA">Concluída</option>
            </select>
          </label>

          <label>
            Valor de coleta, envio ou peças
            <input {...register("valorColeta", { valueAsNumber: true })} type="number" step="0.01" placeholder="Valor coleta, envio ou peças" disabled={!canEditSensitive} />
          </label>
        </div>

        <label>
          Detalhes do cliente
          <textarea {...register("detalhesCliente")} placeholder="Detalhes do cliente" rows={4} />
        </label>

        <label>
          Comentário da loja
          <textarea {...register("comentarioLoja")} placeholder="Descreva a atualização, envio, coleta, assistência ou observação da loja" rows={4} />
        </label>

        <label>
          Comentário interno
          <textarea {...register("comentarioInterno")} placeholder="Observações internas para acompanhamento do ticket" rows={4} />
        </label>
      </section>

      <section className="ticket-form-section">
        <h3>Anexo do ticket</h3>

        {ticketId ? (
          <>
            <div className="ticket-form-grid">
              <label>
                Anexo
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => {
                    setAttachmentFile(event.target.files?.[0] ?? null);
                    setAttachmentError(null);
                    setAttachmentMessage(null);
                  }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={attachmentLoading || !attachmentFile}
                onClick={async () => {
                  if (!ticketId) return;

                  if (!attachmentFile) {
                    setAttachmentError("Selecione um arquivo para upload.");
                    return;
                  }

                  setAttachmentLoading(true);
                  setAttachmentError(null);
                  setAttachmentMessage(null);

                  try {
                    const formData = new FormData();
                    formData.append("file", attachmentFile);

                    const response = await fetch(`/api/tickets/${ticketId}/attachment`, {
                      method: "POST",
                      body: formData
                    });

                    const body = await response.json().catch(() => ({}));

                    if (!response.ok) {
                      setAttachmentError(body.message ?? "Falha ao enviar o anexo.");
                      return;
                    }

                    const updated = body.data;

                    setCurrentAttachment({
                      fileUrl: updated.anexoUrl,
                      fileName: updated.anexoNome,
                      filePath: updated.anexoPath,
                      mimeType: updated.anexoMimeType,
                      sizeBytes: updated.anexoSizeBytes ? Number(updated.anexoSizeBytes) : null,
                      uploadedAt: updated.anexoUploadedAt ?? null
                    });

                    setAttachmentFile(null);
                    setAttachmentMessage("Anexo enviado com sucesso.");
                  } catch {
                    setAttachmentError("Falha ao enviar o anexo.");
                  } finally {
                    setAttachmentLoading(false);
                  }
                }}
              >
                {currentAttachment?.fileUrl ? "Substituir anexo" : "Adicionar anexo"}
              </button>

              {currentAttachment?.fileUrl ? (
                <a className="btn btn-link" href={currentAttachment.fileUrl} target="_blank" rel="noopener noreferrer">
                  {currentAttachment.fileName ?? "Visualizar anexo"}
                </a>
              ) : null}

              {userPerfil === "ADMIN" && currentAttachment?.fileUrl ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={attachmentLoading}
                  onClick={async () => {
                    if (!ticketId) return;

                    setAttachmentLoading(true);
                    setAttachmentError(null);
                    setAttachmentMessage(null);

                    try {
                      const response = await fetch(`/api/tickets/${ticketId}/attachment`, {
                        method: "DELETE"
                      });

                      const body = await response.json().catch(() => ({}));

                      if (!response.ok) {
                        setAttachmentError(body.message ?? "Falha ao remover o anexo.");
                        return;
                      }

                      setCurrentAttachment(undefined);
                      setAttachmentMessage("Anexo removido com sucesso.");
                    } catch {
                      setAttachmentError("Falha ao remover o anexo.");
                    } finally {
                      setAttachmentLoading(false);
                    }
                  }}
                >
                  Remover anexo
                </button>
              ) : null}
            </div>

            {!currentAttachment?.fileUrl ? <p className="muted">Sem anexo.</p> : null}
            {attachmentError ? <p className="field-error">{attachmentError}</p> : null}
            {attachmentMessage ? <p className="muted">{attachmentMessage}</p> : null}
          </>
        ) : (
          <p>Salve o ticket para adicionar anexo.</p>
        )}
      </section>

      {!canEditSensitive ? <p className="muted">Seu perfil não pode editar campos sensíveis.</p> : null}
      {requestError ? <p className="field-error">{requestError}</p> : null}

      <div className="ticket-form-actions">
        {cancelHref ? (
          <button type="button" className="btn btn-secondary" onClick={() => router.push(cancelHref)}>
            Cancelar
          </button>
        ) : null}

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}