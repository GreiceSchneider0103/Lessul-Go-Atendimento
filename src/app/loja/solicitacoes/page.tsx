import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

async function getData() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/operational-requests`, { cache: "no-store" });
  if (!response.ok) return [];
  const body = await response.json();
  return body.data ?? [];
}

export default async function LojaSolicitacoesPage() {
  const user = await getCurrentUser();
  if (user.perfil !== "LOJA") redirect("/dashboard");
  const data = await getData();

  return <section className="panel"><h1>Solicitações da Loja</h1><table className="table"><thead><tr><th>ID</th><th>Ticket</th><th>Cliente</th><th>Pedido</th><th>Ação</th><th>Status</th><th>Prazo</th></tr></thead><tbody>{data.map((row: any) => <tr key={row.id}><td>{row.id.slice(0,8)}</td><td>{row.ticketId}</td><td>{row.ticket?.nomeCliente}</td><td>{row.ticket?.numeroVenda}</td><td>{row.tipoAcao}</td><td>{row.status}</td><td>{row.prazoOperacional ? new Date(row.prazoOperacional).toLocaleDateString("pt-BR") : "-"}</td></tr>)}</tbody></table></section>;
}
