import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { formatDateBR, formatDateTimeBR } from "@/lib/formatters/display";

export default async function LojaSolicitacoesPage() {
  const user = await getCurrentUser();
  if (user.perfil !== "LOJA") redirect("/dashboard");

  const data = await prisma.operationalRequest.findMany({ where: { empresa: user.empresaVinculada ?? undefined }, include: { ticket: true, anexos: true }, orderBy: { updatedAt: "desc" } });
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

  return <section className="page"><h1>Solicitações da Loja</h1><div className="grid" style={{gridTemplateColumns:"repeat(4,minmax(0,1fr))"}}>{Object.entries(stats).map(([k,v])=><article className="card" key={k}><strong>{k}</strong><div style={{fontSize:24}}>{v}</div></article>)}</div><div className="panel table-wrap"><table className="table"><thead><tr><th>ID</th><th>Ticket</th><th>Cliente</th><th>Pedido</th><th>Produto/SKU</th><th>Ação</th><th>Status</th><th>Prazo</th><th>Atualizado</th></tr></thead><tbody>{data.map((row)=><tr key={row.id}><td>{row.id.slice(0,8)}</td><td>{row.ticketId}</td><td>{row.ticket.nomeCliente}</td><td>{row.ticket.numeroVenda}</td><td>{row.ticket.produto} / {row.ticket.sku}</td><td>{row.tipoAcao}</td><td>{row.status}</td><td>{formatDateBR(row.prazoOperacional)}</td><td>{formatDateTimeBR(row.updatedAt)}</td></tr>)}</tbody></table></div></section>;
}
