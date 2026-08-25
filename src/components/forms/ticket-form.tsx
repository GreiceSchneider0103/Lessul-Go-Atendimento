"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Paperclip, Trash2, ExternalLink } from "lucide-react";
import { CANAIS_MARKETPLACE, EMPRESAS, MOTIVOS, RESOLUCOES, STATUS_RECLAMACAO, STATUS_TICKET } from "@/config/domains";
import { formatEnumLabel } from "@/lib/formatters/display";
import { TicketFormInput, ticketFormSchema } from "@/lib/validation/ticket";

type AssignableUser = { id: string; nome: string };

type UserPerfil = "ATENDENTE" | "SUPERVISOR" | "ADMIN" | "LOJA" | "MASTER";

type EmpresaValue = (typeof EMPRESAS)[number];

type TicketAttachment = {
  fileUrl?: string | null;
  fileName?: string | null;
  filePath?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedAt?: string | null;
  uploadedBy?: string | null;
};

type TicketFormProps = {
  ticketId?: string;
  initialValues?: Partial<TicketFormInput>;
  canEditSensitive?: boolean;
  assignableUsers?: AssignableUser[];
  cancelHref?: "/tickets" | `/tickets/${string}` | "/loja/solicitacoes";
  userPerfil?: UserPerfil;
  ticketAttachment?: TicketAttachment;
  currentUser?: {
    perfil?: UserPerfil;
    empresasVinculadas?: EmpresaValue[] | null;
  } | null;
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

function isEmpresaValue(value: unknown): value is EmpresaValue {
  return typeof value === "string" && (EMPRESAS as readonly string[]).includes(value);
}

export function TicketForm({
  ticketId,
  initialValues,
  canEditSensitive = true,
  assignableUsers = [],
  cancelHref,
  userPerfil,
  ticketAttachment,
  currentUser
}: TicketFormProps) {
  const router = useRouter();

  const perfilAtual = currentUser?.perfil ?? userPerfil;

  const empresasDisponiveis = useMemo<EmpresaValue[]>(() => {
    const empresasVinculadas = Array.isArray(currentUser?.empresasVinculadas)
      ? currentUser.empresasVinculadas.filter(isEmpresaValue)
      : [];

    if (perfilAtual === "LOJA" && empresasVinculadas.length > 0) {
      return empresasVinculadas;
    }

    const empresaInicial = initialValues?.empresa;

    if (perfilAtual === "LOJA" && isEmpresaValue(empresaInicial)) {
      return [empresaInicial];
    }

    return [...EMPRESAS];
  }, [currentUser?.empresasVinculadas, perfilAtual, initialValues?.empresa]);

  const empresaInicial = useMemo<EmpresaValue>(() => {
    const empresaDoTicket = initialValues?.empresa;

    if (isEmpresaValue(empresaDoTicket) && empresasDisponiveis.includes(empresaDoTicket)) {
      return empresaDoTicket;
    }

    return empresasDisponiveis[0] ?? ("LESSUL" as EmpresaValue);
  }, [empresasDisponiveis, initialValues?.empresa]);

  const [requestError, setRequestError] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentMessage, setAttachmentMessage] = useState<string | null>(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [currentAttachment, setCurrentAttachment] = useState<TicketAttachment | undefined>(ticketAttachment);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<TicketFormInput>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      nomeCliente: toText(initialValues?.nomeCliente),
      dataCompra: toDateInput(initialValues?.dataCompra),
      numeroVenda: toText(initialValues?.numeroVenda),
      linkPedido: toText(initialValues?.linkPedido),
      uf: toText(initialValues?.uf).toUpperCase(),
      cpf: toText(initialValues?.cpf),
      canalMarketplace: toText(initialValues?.canalMarketplace) || "MERCADO_LIVRE",
      empresa: empresaInicial,
      produto: toText(initialValues?.produto),
      sku: toText(initialValues?.sku),
      fabricante: toText(initialValues?.fabricante),
      transportadora: toText(initialValues?.transportadora),
      statusReclamacao: toText(initialValues?.statusReclamacao) || "AFETANDO",
      dataReclamacao: toDateInput(initialValues?.dataReclamacao),
      motivo: toText(initialValues?.motivo) || "DESISTENCIA",
      detalhesCliente: toText(initialValues?.detalhesCliente),
      resolucao: toNullableText(initialValues?.resolucao),
      valorReembolso: toNumberValue(initialValues?.valorReembolso),
      valorColeta: toNumberValue(initialValues?.valorColeta),
      valorAssistencia: toNumberValue(initialValues?.valorAssistencia),
      valorColetaEnvioPecas: toNumberValue(initialValues?.valorColetaEnvioPecas),
      codigoRastreio: toText(initialValues?.codigoRastreio),
      statusOperacionalLoja: toText(initialValues?.statusOperacionalLoja) || "EM_ABERTO",
      comentarioLoja: toText(initialValues?.comentarioLoja),
      comentarioInterno: toText(initialValues?.comentarioInterno),
      statusTicket: toText(initialValues?.statusTicket) || "ABERTO",
      prazoConclusao: toDateInput(initialValues?.prazoConclusao),
      responsavelId: toNullableText(initialValues?.responsavelId) || undefined,
      acaoOperacionalLoja: toText(initialValues?.acaoOperacionalLoja) || "NENHUMA"
    } as Partial<TicketFormInput>
  });

  const empresaSelecionada = watch("empresa");

  useEffect(() => {
    if (!empresasDisponiveis.length) return;

    if (!isEmpresaValue(empresaSelecionada) || !empresasDisponiveis.includes(empresaSelecionada)) {
      setValue("empresa", empresasDisponiveis[0], {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: true
      });
    }
  }, [empresaSelecionada, empresasDisponiveis, setValue]);

  async function onSubmit(values: TicketFormInput) {
    setRequestError(null);

    const dataCompra = toIsoDate(values.dataCompra);
    const dataReclamacao = toIsoDate(values.dataReclamacao);

    if (!dataCompra || !dataReclamacao) {
      setRequestError("Informe a data da compra e a data da reclamação.");
      return;
    }

    if (!isEmpresaValue(values.empresa)) {
      setRequestError("Selecione uma empresa válida para o ticket.");
      return;
    }

    const payload = {
      ...values,
      empresa: values.empresa,
      uf: toText(values.uf).toUpperCase(),
      dataCompra,
      dataReclamacao,
      prazoConclusao: toIsoDate(values.prazoConclusao),
      linkPedido: toText(values.linkPedido),
      fabricante: toText(values.fabricante),
      transportadora: toText(values.transportadora),
      detalhesCliente: toText(values.detalhesCliente),
      codigoRastreio: toText(values.codigoRastreio),
      comentarioLoja: toText(values.comentarioLoja),
      comentarioInterno: toText(values.comentarioInterno),
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

    const result = await response.json().catch(() => ({}));
    const activeTicketId = ticketId || result.data?.id;

    if (payload.acaoOperacionalLoja !== "NENHUMA" && activeTicketId) {
      await fetch("/api/operational-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: activeTicketId, tipoAcao: payload.acaoOperacionalLoja })
      });
    }

    router.push(userPerfil === "LOJA" ? "/loja/solicitacoes" : cancelHref ?? "/tickets");
    router.refresh();
  }

  function errorFor(field: keyof TicketFormInput) {
    return errors[field]?.message;
  }

  const semEmpresaDisponivel = empresasDisponiveis.length === 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="panel ticket-form">
      <section className="ticket-form-section">
        <h3>Dados do cliente e pedido</h3>

        <div className="ticket-form-grid">
          <label>
            Nome do cliente
            <input {...register("nomeCliente")} placeholder="Nome do cliente" />
            {errorFor("nomeCliente") ? <small className="field-error">{errorFor("nomeCliente")}</small> : null}
          </label>

          <label>
            CPF
            <input {...register("cpf")} placeholder="CPF" />
          </label>

          <label>
            UF
            <input {...register("uf")} placeholder="UF" maxLength={2} />
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
            Link do pedido
            <input {...register("linkPedido")} placeholder="https://..." />
          </label>
        </div>

        <label>
          Detalhes do cliente
          <textarea {...register("detalhesCliente")} placeholder="Detalhes do cliente" rows={3} />
        </label>
      </section>

      <section className="ticket-form-section">
        <h3>Classificação da reclamação</h3>

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
            <select {...register("empresa")} disabled={semEmpresaDisponivel}>
              {semEmpresaDisponivel ? (
                <option value="">Nenhuma empresa vinculada</option>
              ) : (
                empresasDisponiveis.map((item) => (
                  <option key={item} value={item}>
                    {formatEnumLabel(item)}
                  </option>
                ))
              )}
            </select>
            {perfilAtual === "LOJA" && empresasDisponiveis.length === 1 ? (
              <small className="muted">Empresa selecionada automaticamente pelo vínculo do usuário.</small>
            ) : null}
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
            Fabricante
            <input {...register("fabricante")} placeholder="Fabricante" />
          </label>

          <label>
            Transportadora
            <input {...register("transportadora")} placeholder="Transportadora" />
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
            Data da reclamação
            <input {...register("dataReclamacao")} type="date" />
          </label>
        </div>
      </section>

      <section className="ticket-form-section">
        <h3>Andamento e responsável</h3>

        <div className="ticket-form-grid">
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

          <label>
            Prazo de conclusão
            <input {...register("prazoConclusao")} type="date" disabled={!canEditSensitive} />
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
        </div>

        <label>
          Comentário interno
          <textarea {...register("comentarioInterno")} placeholder="Observações internas para acompanhamento do ticket" rows={3} />
        </label>
      </section>

      <section className="ticket-form-section">
        <h3>Valores</h3>

        <div className="ticket-form-grid">
          <label>
            Valor de reembolso
            <input {...register("valorReembolso", { valueAsNumber: true })} type="number" step="0.01" placeholder="R$ 0,00" />
          </label>

          <label>
            Valor de assistência
            <input {...register("valorAssistencia", { valueAsNumber: true })} type="number" step="0.01" placeholder="R$ 0,00" />
          </label>

          <label>
            Valor de coleta, envio ou peças
            <input {...register("valorColetaEnvioPecas", { valueAsNumber: true })} type="number" step="0.01" placeholder="R$ 0,00" />
          </label>

          <label>
            Valor de coleta (uso interno)
            <input
              {...register("valorColeta", { valueAsNumber: true })}
              type="number"
              step="0.01"
              placeholder="R$ 0,00"
              disabled={!canEditSensitive}
            />
            <small className="muted">Custo interno de coleta, separado do valor de coleta/envio/peças acima.</small>
          </label>
        </div>
      </section>

      <section className="ticket-form-section">
        <h3>Operação da loja</h3>

        <div className="ticket-form-grid">
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
            Status operacional da loja
            <select {...register("statusOperacionalLoja")}>
              <option value="EM_ABERTO">Em aberto</option>
              <option value="ENVIAR_ASSISTENCIA">Enviar assistência</option>
              <option value="ASSISTENCIA_ENVIADA">Assistência enviada</option>
              <option value="COLETAR">Coletar</option>
              <option value="COLETA_SOLICITADA">Coleta solicitada</option>
              <option value="COLETA_FEITA">Coleta feita</option>
              <option value="DEVOLUCAO_RECEBIDA">Devolução recebida aguardando cobrança</option>
              <option value="REEMBOLSO_PENDENTE">Reembolsar</option>
              <option value="REEMBOLSO_REALIZADO">Reembolso feito</option>
              <option value="AGUARDANDO_ATENDENTE">Aguardando informações</option>
              <option value="CONCLUIDA" disabled={userPerfil === "LOJA"}>
                Concluído
              </option>
            </select>
          </label>

          <label>
            Código de rastreio
            <input {...register("codigoRastreio")} placeholder="Código de rastreio" />
          </label>
        </div>

        <label>
          Comentário da loja
          <textarea {...register("comentarioLoja")} placeholder="Descreva a atualização, envio, coleta, assistência ou observação da loja" rows={3} />
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

            <div className="flex flex-wrap items-center gap-2">
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
                    router.refresh();
                  } catch {
                    setAttachmentError("Falha ao enviar o anexo.");
                  } finally {
                    setAttachmentLoading(false);
                  }
                }}
              >
                <Paperclip size={14} strokeWidth={2.25} aria-hidden />
                {currentAttachment?.fileUrl ? "Substituir anexo" : "Adicionar anexo"}
              </button>

              {currentAttachment?.fileUrl ? (
                <a
                  className="btn btn-link inline-flex items-center gap-1.5"
                  href={currentAttachment.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={14} strokeWidth={2.25} aria-hidden />
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
                  <Trash2 size={14} strokeWidth={2.25} aria-hidden />
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

      {!canEditSensitive ? <p className="muted">Seu perfil não pode editar campos administrativos.</p> : null}
      {semEmpresaDisponivel ? <p className="field-error">Nenhuma empresa vinculada ao usuário atual.</p> : null}
      {requestError ? <p className="field-error">{requestError}</p> : null}

      <div className="ticket-form-actions">
        {cancelHref ? (
          <button type="button" className="btn btn-secondary" onClick={() => router.push(cancelHref)}>
            Cancelar
          </button>
        ) : null}

        <button type="submit" className="btn btn-primary" disabled={isSubmitting || semEmpresaDisponivel}>
          {isSubmitting ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}