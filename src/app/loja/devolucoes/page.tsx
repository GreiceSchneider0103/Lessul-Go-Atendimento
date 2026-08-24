import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { EMPRESAS } from "@/config/domains";
import { DevolucaoRecebidaForm } from "@/components/loja/devolucao-recebida-form";

type EmpresaValue = (typeof EMPRESAS)[number];

function isEmpresaValue(value: string): value is EmpresaValue {
  return (EMPRESAS as readonly string[]).includes(value);
}

export default async function DevolucaoRecebidaPage() {
  const user = await getCurrentUser();

  if (user.perfil !== "LOJA") {
    redirect("/loja/solicitacoes");
  }

  const vinculos = await prisma.usuarioEmpresa.findMany({ where: { usuarioId: user.id } });
  const empresasDisponiveis = (
    vinculos.length ? vinculos.map((item) => item.empresa) : user.empresaVinculada ? [user.empresaVinculada] : []
  ).filter(isEmpresaValue);

  return (
    <section className="page">
      <div className="page-header">
        <h1>Devolução recebida</h1>
        <p className="muted">
          Use este formulário quando um produto de devolução chegar na loja sem um ticket de atendimento já aberto
          (por exemplo, quando o cliente devolveu direto pelo marketplace). Ao enviar, o time interno é notificado
          para realizar a cobrança do marketplace.
        </p>
      </div>

      <DevolucaoRecebidaForm empresasDisponiveis={empresasDisponiveis} />
    </section>
  );
}
