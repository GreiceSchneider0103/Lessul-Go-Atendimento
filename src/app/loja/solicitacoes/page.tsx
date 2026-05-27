import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { formatEnumLabel } from "@/lib/formatters/display";
import { Empresa, Perfil, StatusOperacionalLoja } from "@prisma/client";
import { OperationalRequestsPanel } from "@/components/loja/operational-requests-panel";

type PageProps = { searchParams: Promise<{ empresa?: string; status?: string }> };

const statusLabel: Record<string, string> = {
  aberto: "Em aberto",
  assistenciaCaminho: "Assistência a caminho",
  assistenciaEntregue: "Assistência entregue",
  coletaSolicitada: "Coleta solicitada",
  coletaFeita: "Coleta feita",
  reembolsoRealizado: "Reembolso realizado",
  concluidas: "Concluídas",
  atrasadas: "Atrasadas"
};

const statusOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "EM_ABERTO", label: "Em aberto" },
  { value: "ASSISTENCIA_ENVIADA", label: "Assistência enviada" },
  { value: "ASSISTENCIA_A_CAMINHO", label: "Assistência a caminho" },
  { value: "ASSISTENCIA_ENTREGUE", label: "Assistência entregue" },
  { value: "COLETA_SOLICITADA", label: "Coleta solicitada" },
  { value: "COLETA_FEITA", label: "Coleta feita" },
  { value: "DEVOLUCAO_SOLICITADA", label: "Devolução solicitada" },
  { value: "DEVOLUCAO_A_CAMINHO", label: "Devolução a caminho" },
  { value: "DEVOLUCAO_REALIZADA", label: "Devolução realizada" },
  { value: "REEMBOLSO_PENDENTE", label: "Reembolso pendente" },
  { value: "REEMBOLSO_REALIZADO", label: "Reembolso realizado" },
  { value: "AGUARDANDO_ATENDENTE", label: "Aguardando atendente" },
  { value: "CONCLUIDA", label: "Concluída" }
];

export default async function LojaSolicitacoesPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (user.perfil !== "LOJA" && user.perfil !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const empresaFiltro = params.empresa && Object.values(Empresa).includes(params.empresa as Empresa) ? params.empresa as Empresa : undefined;
  const statusFiltro = params.status && Object.values(StatusOperacionalLoja).includes(params.status as StatusOperacionalLoja) ? params.status as StatusOperacionalLoja : undefined;

  const where = user.perfil === "LOJA"
    ? { empresa: user.empresaVinculada ?? undefined, ticket: statusFiltro ? { statusOperacionalLoja: statusFiltro } : undefined }
    : (empresaFiltro ? { empresa: empresaFiltro, ticket: statusFiltro ? { statusOperacionalLoja: statusFiltro } : undefined } : { ticket: statusFiltro ? { statusOperacionalLoja: statusFiltro } : undefined });

  const data = await prisma.operationalRequest.findMany({ where, include: { ticket: true }, orderBy: { updatedAt: "desc" } });
  const stats = {
    aberto: data.filter((d) => d.status === "EM_ABERTO").length,
    assistenciaCaminho: data.filter((d) => d.status === "ASSISTENCIA_A_CAMINHO").length,
    assistenciaEntregue: data.filter((d) => d.status === "ASSISTENCIA_ENTREGUE").length,
    coletaSolicitada: data.filter((d) => d.status === "COLETA_SOLICITADA").length,
    coletaFeita: data.filter((d) => d.status === "COLETA_FEITA").length,
    reembolsoRealizado: data.filter((d) => d.status === "REEMBOLSO_REALIZADO").length,
    concluidas: data.filter((d) => d.status === "CONCLUIDA").length,
    atrasadas: data.filter((d) => d.prazoOperacional && d.prazoOperacional < new Date() && d.status !== "CONCLUIDA").length
  };

  return <section className="page"><h1>Solicitações da Loja</h1>
    <div className="panel" style={{ marginBottom: 12 }}>
      <strong>Filtros</strong>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {user.perfil === Perfil.ADMIN ? <><a className="btn btn-secondary" href={`/loja/solicitacoes${params.status ? `?status=${params.status}` : ""}`}>Todas empresas</a>{Object.values(Empresa).map((emp) => <a key={emp} className="btn btn-secondary" href={`/loja/solicitacoes?empresa=${emp}${params.status ? `&status=${params.status}` : ""}`}>{formatEnumLabel(emp)}</a>)}</> : null}
        {statusOptions.map((opt) => <a key={opt.value || "all"} className="btn btn-secondary" href={`/loja/solicitacoes?${user.perfil === Perfil.ADMIN && empresaFiltro ? `empresa=${empresaFiltro}&` : ""}${opt.value ? `status=${opt.value}` : ""}`}>{opt.label}</a>)}
      </div>
    </div>
    <div className="grid" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>{Object.entries(stats).map(([k, v]) => <article className="card" key={k}><strong>{statusLabel[k] ?? k}</strong><div style={{ fontSize: 24 }}>{v}</div></article>)}</div>
    <OperationalRequestsPanel perfil={user.perfil} data={data.map((row) => ({ id: row.id, empresa: row.empresa, ticketId: row.ticketId, tipoAcao: row.tipoAcao, status: row.status as any, prazoOperacional: row.prazoOperacional?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString(), comentarioLoja: row.comentarioLoja, comentarioAtendente: row.comentarioAtendente, codigoRastreio: row.codigoRastreio, valorReembolso: Number(row.valorReembolso), valorAssistencia: Number((row.ticket as any).valorAssistencia ?? 0), valorColetaEnvioPecas: Number(row.valorColetaEnvioPecas), ticket: { nomeCliente: row.ticket.nomeCliente, numeroVenda: row.ticket.numeroVenda, linkPedido: row.ticket.linkPedido }, anexo: row.ticket.anexoUrl ? { fileUrl: row.ticket.anexoUrl, fileName: (row.ticket as any).anexoNome ?? "Ver anexo" } : undefined }))} />
  </section>;
}
