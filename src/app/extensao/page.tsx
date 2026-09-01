import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { requireCurrentUser } from "@/lib/auth/require-user";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { ExtensionTokenManager } from "@/components/extension/extension-token-manager";

const EXTENSION_ZIP_PATH = "/downloads/lessul-go-extensao-mercado-livre.zip";

export default async function ExtensaoPage() {
  const user = await requireCurrentUser();

  if (!hasPermission(user.perfil, "ticket.create")) {
    redirect("/dashboard");
  }

  const tokens = await prisma.personalAccessToken.findMany({
    where: { usuarioId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true, revokedAt: true }
  });

  return (
    <section className="page">
      <div className="page-header">
        <h1>Extensão do navegador</h1>
        <p className="muted">Importe pedidos do Mercado Livre direto para um novo ticket, sem digitar tudo manualmente.</p>
      </div>

      <article className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <strong className="text-sm font-bold text-slate-800">1. Baixar e instalar a extensão</strong>
            <p className="muted mt-1">Funciona no Google Chrome. Suporta apenas Mercado Livre por enquanto.</p>
          </div>
          <a href={EXTENSION_ZIP_PATH} download className="btn btn-primary whitespace-nowrap">
            <Download size={15} strokeWidth={2.25} aria-hidden />
            Baixar extensão (.zip)
          </a>
        </div>

        <ol className="mt-4 grid gap-2 pl-5" style={{ listStyle: "decimal", fontSize: 13.5 }}>
          <li>Baixe o arquivo acima e extraia (descompacte) a pasta em qualquer lugar do computador — ela precisa continuar ali, não é só para instalar e apagar.</li>
          <li>
            No Chrome, digite <code>chrome://extensions</code> na barra de endereço e aperte Enter.
          </li>
          <li>Ative a opção <strong>&quot;Modo do desenvolvedor&quot;</strong>, no canto superior direito da página.</li>
          <li>
            Clique em <strong>&quot;Carregar sem compactação&quot;</strong> e selecione a pasta que você extraiu no
            passo 1 (a pasta que contém o arquivo <code>manifest.json</code>).
          </li>
          <li>A extensão &quot;Lessul Go — Importar Mercado Livre&quot; deve aparecer na lista e no ícone de peça de quebra-cabeça do Chrome. Fixe o ícone para acesso rápido, se quiser.</li>
        </ol>
      </article>

      <article className="card">
        <strong className="text-sm font-bold text-slate-800">2. Conectar a extensão à sua conta</strong>
        <p className="muted mt-1">
          Gere um token abaixo, cole nas opções da extensão (clique com o botão direito no ícone dela → Opções) e salve.
        </p>
        <ExtensionTokenManager initialTokens={tokens} />
      </article>

      <article className="card">
        <strong className="text-sm font-bold text-slate-800">3. Como usar</strong>
        <ol className="mt-3 grid gap-2 pl-5" style={{ listStyle: "decimal", fontSize: 13.5 }}>
          <li>Abra a página de detalhe de uma venda no Mercado Livre (dentro da sua conta de vendedor).</li>
          <li>
            Clique no botão flutuante <strong>&quot;Importar para o Lessul Go&quot;</strong> no canto inferior direito
            da página — ou no ícone da extensão e em <strong>&quot;Importar pedido desta página&quot;</strong>.
          </li>
          <li>Uma nova aba abre com o formulário de criação de ticket já preenchido. Revise os dados, confirme a empresa/loja correta e finalize o cadastro normalmente.</li>
        </ol>
      </article>
    </section>
  );
}
