import { StatusOperacional, Empresa, Prisma, StatusOperacionalLoja, TipoAcaoOperacional } from "@prisma/client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { after } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { formatEnumLabel } from "@/lib/formatters/display";
import { EMPRESAS } from "@/config/domains";
import { hasPermission } from "@/lib/rbac/permissions";
import { OperationalRequestsPanel } from "@/components/loja/operational-requests-panel";
import { markOperacionalLojaVisitado } from "@/lib/services/operational-requests-service";

type PageProps = {
  searchParams: Promise<{
    empresa?: string;
    status?: string;
    categoria?: string;
  }>;
};

type EmpresaValue = (typeof EMPRESAS)[number];

const CATEGORIA_TIPO_ACAO: Record<string, TipoAcaoOperacional[]> = {
  assistencia_coleta: ["ASSISTENCIA", "COLETA"],
  devolucoes: ["DEVOLUCAO", "REEMBOLSO"]
};

type OperationalRequestWithTicket = {
  id: string;
  empresa: Empresa;
  ticketId: string;
  tipoAcao: string;
  status: StatusOperacional;
  prazoOperacional: Date | null;
  updatedAt: Date;
  comentarioLoja: string | null;
  comentarioAtendente: string | null;
  codigoRastreio: string | null;
  valorReembolso: unknown;
  valorColetaEnvioPecas: unknown;
  anexos: Array<{
    id: string;
    fileUrl: string | null;
    fileName: string;
    mimeType: string | null;
  }>;
  ticket: {
    nomeCliente: string;
    numeroVenda: string;
    prazoConclusao: Date | null;
    linkPedido: string | null;
    anexoUrl: string | null;
    anexoNome: string | null;
    anexoPath: string | null;
    anexoMimeType: string | null;
    valorReembolso: Prisma.Decimal;
    valorAssistencia: Prisma.Decimal;
    valorColetaEnvioPecas: Prisma.Decimal;
    codigoRastreio: string | null;
    statusOperacionalLoja: StatusOperacionalLoja;
    comentarioLoja: string | null;
    acaoOperacionalLoja: string;
    produto: string;
    sku: string;
    detalhesCliente: string | null;
    resolucao: string | null;
  };
};

const statusOptions = Object.values(StatusOperacional) as StatusOperacional[];

function isEmpresa(value: string | undefined): value is EmpresaValue {
  return Boolean(value && EMPRESAS.includes(value as EmpresaValue));
}

function isStatusOperacional(value: string | undefined): value is StatusOperacional {
  return Boolean(value && statusOptions.includes(value as StatusOperacional));
}

function toNumber(value: unknown): number {
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

function isOverdue(prazoOperacional: string | null, status: string) {
  if (!prazoOperacional) return false;
  // Atualizado para considerar novos status finalizados como não atrasados
  const nonOverdueStatuses = ["CONCLUIDA", "ASSISTENCIA_ENTREGUE", "REEMBOLSO_REALIZADO"];
  if (nonOverdueStatuses.includes(status)) return false;

  const prazo = new Date(prazoOperacional);
  const hoje = new Date();

  prazo.setHours(23, 59, 59, 999);
  hoje.setHours(0, 0, 0, 0);

  return prazo < hoje;
}

export default async function LojaSolicitacoesPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();

  if (user.perfil !== "LOJA" && !hasPermission(user.perfil, "operational.update")) {
    redirect("/dashboard");
  }

  after(() => markOperacionalLojaVisitado(user.id));

  const params = await searchParams;
  const empresaFiltro = isEmpresa(params.empresa) ? params.empresa : undefined;
  const statusFiltro = isStatusOperacional(params.status) ? params.status : undefined;
  const categoriaFiltro = params.categoria && CATEGORIA_TIPO_ACAO[params.categoria] ? params.categoria : undefined;

  const baseWhere: Prisma.OperationalRequestWhereInput = {
    ticket: { ativo: true },
    ...(user.perfil === "LOJA"
      ? { empresa: user.empresaVinculada ?? undefined }
      : empresaFiltro
        ? { empresa: empresaFiltro as Empresa }
        : {})
  };

  const conditions: Prisma.OperationalRequestWhereInput[] = [baseWhere];

  if (statusFiltro) {
    // quando filtrar por status, considerar tanto o status da request quanto o status operacional armazenado no ticket
    conditions.push({ OR: [{ status: statusFiltro }, { ticket: { statusOperacionalLoja: statusFiltro } }] });
  }

  if (categoriaFiltro) {
    const tipos = CATEGORIA_TIPO_ACAO[categoriaFiltro];
    conditions.push({ OR: [{ tipoAcao: { in: tipos } }, { ticket: { acaoOperacionalLoja: { in: tipos } } }] });
  }

  const where: Prisma.OperationalRequestWhereInput = conditions.length > 1 ? { AND: conditions } : conditions[0];

  const data = (await prisma.operationalRequest.findMany({
    where,
    include: {
      anexos: {
        orderBy: { uploadedAt: "asc" },
        select: { id: true, fileUrl: true, fileName: true, mimeType: true }
      },
      ticket: {
        select: {
          nomeCliente: true,
          numeroVenda: true,
          linkPedido: true,
          prazoConclusao: true,
          anexoUrl: true,
          anexoNome: true,
          anexoPath: true,
          anexoMimeType: true,
          valorReembolso: true,
          valorColetaEnvioPecas: true,
          valorAssistencia: true,
          codigoRastreio: true,
          statusOperacionalLoja: true,
          comentarioLoja: true,
          acaoOperacionalLoja: true,
          produto: true,
          sku: true,
          detalhesCliente: true,
          resolucao: true
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    }
  })) as unknown as OperationalRequestWithTicket[];

  const mappedData = data.map((row) => {
    const displayStatus = (row.ticket.statusOperacionalLoja as unknown as StatusOperacional) || row.status;
    const displayTipoAcao = row.ticket.acaoOperacionalLoja !== "NENHUMA" ? row.ticket.acaoOperacionalLoja : row.tipoAcao;

    return {
      id: row.id,
      empresa: row.empresa,
      ticketId: row.ticketId,
      tipoAcao: displayTipoAcao,
      status: displayStatus,
      prazoOperacional: row.ticket.prazoConclusao?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
      comentarioLoja: row.ticket.comentarioLoja ?? row.comentarioLoja ?? null,
      comentarioAtendente: row.comentarioAtendente ?? null,
      codigoRastreio: row.ticket.codigoRastreio ?? row.codigoRastreio ?? null,
      valorReembolso: toNumber(row.ticket.valorReembolso) || toNumber(row.valorReembolso),
      valorAssistencia: toNumber(row.ticket.valorAssistencia),
      valorColetaEnvioPecas: toNumber(row.ticket.valorColetaEnvioPecas) || toNumber(row.valorColetaEnvioPecas),
      ticket: {
        nomeCliente: row.ticket.nomeCliente,
        numeroVenda: row.ticket.numeroVenda,
        linkPedido: row.ticket.linkPedido ?? null,
        produto: row.ticket.produto,
        sku: row.ticket.sku,
        detalhesCliente: row.ticket.detalhesCliente ?? null,
        resolucao: row.ticket.resolucao ?? null,
        acaoOperacionalLoja: row.ticket.acaoOperacionalLoja,
        statusOperacionalLoja: row.ticket.statusOperacionalLoja,
        comentarioLoja: row.ticket.comentarioLoja ?? null,
      },
      anexo: row.ticket.anexoUrl
        ? {
            fileUrl: row.ticket.anexoUrl,
            fileName: row.ticket.anexoNome ?? "Anexo",
            filePath: row.ticket.anexoPath ?? null,
            mimeType: row.ticket.anexoMimeType ?? null
          }
        : undefined,
      anexos: row.anexos
    };
  });
  // Definir status para as novas regras dos cards
  const openStatuses = ["EM_ABERTO"];
  const finalizedStatuses = ["CONCLUIDA", "ASSISTENCIA_ENTREGUE", "REEMBOLSO_REALIZADO"];

  // Estatísticas devem considerar todos os registros (incluindo concluídos), porém a tabela
  // exibirá, por padrão, apenas os não concluídos. Se houver um filtro explícito de status,
  // a tabela mostra apenas esse status.
  const concluidas = mappedData.filter((item) => finalizedStatuses.includes(item.status)).length;
  const totalNotConcluded = mappedData.filter((item) => !finalizedStatuses.includes(item.status)).length;
  const emAberto = mappedData.filter((item) => openStatuses.includes(item.status)).length;
  const emAndamento = mappedData.filter((item) => !openStatuses.includes(item.status) && !finalizedStatuses.includes(item.status)).length;
  const atrasadas = mappedData.filter((item) => isOverdue(item.prazoOperacional, item.status) && !finalizedStatuses.includes(item.status)).length;

  const stats = [
    { key: "TOTAL", label: "Total", value: totalNotConcluded },
    { key: "EM_ABERTO", label: "Em aberto", value: emAberto },
    { key: "EM_ANDAMENTO", label: "Em andamento", value: emAndamento },
    { key: "CONCLUIDAS", label: "Concluídas", value: concluidas },
    { key: "ATRASADAS", label: "Atrasadas", value: atrasadas }
  ];

  // Definir dados que serão mostrados na tabela aplicando o filtro padrão (excluir concluidas)
  const displayData = statusFiltro
    ? mappedData.filter((item) => item.status === statusFiltro)
    : mappedData.filter((item) => !finalizedStatuses.includes(item.status));

  const categoriaTabs: Array<{ key?: string; label: string }> = [
    { key: undefined, label: "Todas" },
    { key: "assistencia_coleta", label: "Assistências e coletas" },
    { key: "devolucoes", label: "Devoluções" }
  ];

  function buildCategoriaHref(categoria?: string) {
    const query = new URLSearchParams();
    if (empresaFiltro) query.set("empresa", empresaFiltro);
    if (statusFiltro) query.set("status", statusFiltro);
    if (categoria) query.set("categoria", categoria);
    const queryString = query.toString();
    return `/loja/solicitacoes${queryString ? `?${queryString}` : ""}`;
  }

  return (
    <section className="page">
      <div className="page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Solicitações da Loja</h1>
          <p className="muted">Acompanhamento operacional das ações abertas pelas lojas.</p>
        </div>

        {user.perfil === "LOJA" ? (
          <Link href="/loja/devolucoes" className="btn btn-primary">
            <Plus size={16} strokeWidth={2.5} aria-hidden />
            Devolução sem ticket
          </Link>
        ) : null}
      </div>

      <nav className="tabs" aria-label="Categoria">
        {categoriaTabs.map((tab) => (
          <a
            key={tab.key ?? "todas"}
            href={buildCategoriaHref(tab.key)}
            className={`tab-item ${categoriaFiltro === tab.key || (!categoriaFiltro && !tab.key) ? "active" : ""}`}
          >
            {tab.label}
          </a>
        ))}
      </nav>

      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <form action="/loja/solicitacoes" method="get" className="flex flex-1 flex-wrap items-end gap-3">
          <input type="hidden" name="categoria" value={categoriaFiltro ?? ""} />

          {user.perfil !== "LOJA" ? (
            <label className="min-w-[180px]">
              Empresa
              <select name="empresa" defaultValue={empresaFiltro ?? ""}>
                <option value="">Todas as empresas</option>
                {EMPRESAS.map((emp) => (
                  <option key={emp} value={emp}>
                    {formatEnumLabel(emp)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="min-w-[200px]">
            Status operacional
            <select name="status" defaultValue={statusFiltro ?? ""}>
              <option value="">Todos os status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {formatEnumLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-1">
            <button className="btn btn-primary h-[42px]" type="submit">
              Filtrar
            </button>

            <Link className="btn btn-link h-[42px] inline-flex items-center" href="/loja/solicitacoes">
              Limpar
            </Link>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {stats.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5"
              style={
                item.key === "ATRASADAS" && item.value > 0
                  ? { borderColor: "#fecaca", background: "#fef2f2" }
                  : { borderColor: "var(--color-border)", background: "#f8fafc" }
              }
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</span>
              <strong
                className="text-sm font-extrabold"
                style={{ color: item.key === "ATRASADAS" && item.value > 0 ? "#b91c1c" : "#0f172a" }}
              >
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      </div>

      <OperationalRequestsPanel perfil={user.perfil} data={displayData} />
    </section>
  );
}