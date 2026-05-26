import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { formatEnumLabel } from "@/lib/formatters/display";
import { Empresa, Perfil } from "@prisma/client";
import { OperationalRequestsPanel } from "@/components/loja/operational-requests-panel";

type PageProps = { searchParams: Promise<{ empresa?: string }> };

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

export default async function LojaSolicitacoesPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (user.perfil !== "LOJA" && user.perfil !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const empresaFiltro = params.empresa && Object.values(Empresa).includes(params.empresa as Empresa) ? params.empresa as Empresa : undefined;

  const where = user.perfil === "LOJA"
    ? { empresa: user.empresaVinculada ?? undefined }
    : (empresaFiltro ? { empresa: empresaFiltro } : {});

  const data = await prisma.operationalRequest.findMany({ where, include: { ticket: true, anexos: { orderBy: { uploadedAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" } });
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
    {user.perfil === Perfil.ADMIN ? <div className="panel" style={{ marginBottom: 12 }}><strong>Filtro por empresa:</strong><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}><Link className="btn btn-secondary" href="/loja/solicitacoes">Todas</Link>{Object.values(Empresa).map((emp) => <Link key={emp} className="btn btn-secondary" href={`/loja/solicitacoes?empresa=${emp}`}>{formatEnumLabel(emp)}</Link>)}</div></div> : null}
    <div className="grid" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))" }}>{Object.entries(stats).map(([k, v]) => <article className="card" key={k}><strong>{statusLabel[k] ?? k}</strong><div style={{ fontSize: 24 }}>{v}</div></article>)}</div>
    <OperationalRequestsPanel
      perfil={user.perfil}
      data={data.map((row) => ({
        id: row.id,
        empresa: row.empresa,
        ticketId: row.ticketId,
        tipoAcao: row.tipoAcao,
        status: row.status,
        prazoOperacional: row.prazoOperacional?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
        comentarioLoja: row.comentarioLoja,
        comentarioAtendente: row.comentarioAtendente,
        codigoRastreio: row.codigoRastreio,
        valorReembolso: Number(row.valorReembolso),
        valorColetaEnvioPecas: Number(row.valorColetaEnvioPecas),
        ticket: { nomeCliente: row.ticket.nomeCliente, numeroVenda: row.ticket.numeroVenda, linkPedido: row.ticket.linkPedido },
        anexo: row.ticket.anexoUrl ? { fileUrl: row.ticket.anexoUrl, fileName: (row.ticket as any).anexoNome ?? "Anexo" } : undefined
      }))}
    />
  </section>;
}
