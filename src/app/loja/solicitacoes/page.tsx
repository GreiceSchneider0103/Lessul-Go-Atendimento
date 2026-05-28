import { StatusOperacional, Empresa, Prisma, StatusOperacionalLoja } from "@prisma/client";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { formatEnumLabel } from "@/lib/formatters/display";
import { EMPRESAS } from "@/config/domains";
import { OperationalRequestsPanel } from "@/components/loja/operational-requests-panel";

type PageProps = {
  searchParams: Promise<{
    empresa?: string;
    status?: string;
  }>;
};

type EmpresaValue = (typeof EMPRESAS)[number];

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

const statusLabel: Record<string, string> = {
  EM_ABERTO: "Em aberto",
  ASSISTENCIA_ENVIADA: "Assistência enviada",
  ASSISTENCIA_A_CAMINHO: "Assistência a caminho",
  ASSISTENCIA_ENTREGUE: "Assistência entregue",
  COLETA_SOLICITADA: "Coleta solicitada",
  COLETA_FEITA: "Coleta feita",
  DEVOLUCAO_SOLICITADA: "Devolução solicitada",
  DEVOLUCAO_A_CAMINHO: "Devolução a caminho",
  DEVOLUCAO_REALIZADA: "Devolução realizada",
  REEMBOLSO_PENDENTE: "Reembolso pendente",
  REEMBOLSO_REALIZADO: "Reembolso realizado",
  AGUARDANDO_ATENDENTE: "Aguardando atendente",
  CONCLUIDA: "Concluídas"
};

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
  if (status === "CONCLUIDA") return false;

  const prazo = new Date(prazoOperacional);
  const hoje = new Date();

  prazo.setHours(23, 59, 59, 999);
  hoje.setHours(0, 0, 0, 0);

  return prazo < hoje;
}

export default async function LojaSolicitacoesPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();

  if (user.perfil !== "LOJA" && user.perfil !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const empresaFiltro = isEmpresa(params.empresa) ? params.empresa : undefined;
  const statusFiltro = isStatusOperacional(params.status) ? params.status : undefined;

  const baseWhere: Prisma.OperationalRequestWhereInput =
    user.perfil === "LOJA"
      ? { empresa: user.empresaVinculada ?? undefined }
      : empresaFiltro
        ? { empresa: empresaFiltro as Empresa }
        : {};

  const where: Prisma.OperationalRequestWhereInput = {
    ...baseWhere,
    ...(statusFiltro ? { status: statusFiltro } : {})
  };

  const data = (await prisma.operationalRequest.findMany({
    where,
    include: {
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
        : undefined
    };
  });

  const total = mappedData.length;
  const concluidas = mappedData.filter((item) => item.status === "CONCLUIDA").length;
  const atrasadas = mappedData.filter((item) => isOverdue(item.prazoOperacional, item.status)).length;
  const emAberto = mappedData.filter((item) => item.status !== "CONCLUIDA").length;

  const stats = [
    {
      key: "TOTAL",
      label: "Total",
      value: total
    },
    {
      key: "EM_ABERTO",
      label: "Em aberto",
      value: emAberto
    },
    {
      key: "CONCLUIDAS",
      label: "Concluídas",
      value: concluidas
    },
    {
      key: "ATRASADAS",
      label: "Atrasadas",
      value: atrasadas
    }
  ];

  return (
    <section className="page">
      <h1>Solicitações da Loja</h1>

      <div className="panel" style={{ marginBottom: 12 }}>
        <form
          action="/loja/solicitacoes"
          method="get"
          style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}
        >
          {user.perfil === "ADMIN" ? (
            <label style={{ minWidth: 220 }}>
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

          <label style={{ minWidth: 260 }}>
            Status operacional
            <select name="status" defaultValue={statusFiltro ?? ""}>
              <option value="">Todos os status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabel[status] ?? formatEnumLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" type="submit" style={{ height: "42px" }}>
              Filtrar
            </button>

            <Link
              className="btn btn-secondary"
              href="/loja/solicitacoes"
              style={{
                height: "42px",
                display: "inline-flex",
                alignItems: "center",
                backgroundColor: "#f1f5f9",
                color: "#475569",
                border: "1px solid #e2e8f0"
              }}
            >
              Limpar
            </Link>
          </div>
        </form>
      </div>

      <div className="grid grid-4">
        {stats.map((item) => (
          <article className="card" key={item.key}>
            <strong>{item.label}</strong>
            <div style={{ fontSize: 24 }}>{item.value}</div>
          </article>
        ))}
      </div>

      <OperationalRequestsPanel perfil={user.perfil} data={mappedData} />
    </section>
  );
}