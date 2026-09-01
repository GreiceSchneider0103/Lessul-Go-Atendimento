import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SupportTicketForm } from "@/components/support/support-ticket-form";

export default async function NovoChamadoSuportePage() {
  const user = await getCurrentUser();

  if (user.perfil !== "LOJA") {
    redirect("/suporte");
  }

  return (
    <section className="page">
      <div className="page-header">
        <h1>Novo chamado</h1>
        <p className="muted">
          Abra um chamado para dúvidas, alterações ou pedidos gerais junto ao time que administra sua conta. Prazo de
          resposta: até 2 dias úteis.
        </p>
      </div>

      <SupportTicketForm empresasDisponiveis={user.empresasVinculadas} />
    </section>
  );
}
