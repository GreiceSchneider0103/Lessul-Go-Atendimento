import Link from "next/link";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { SupportCategoria, SupportStatus } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { EMPRESAS } from "@/config/domains";
import { formatEnumLabel } from "@/lib/formatters/display";
import { listSupportTickets, markSuporteVisitado } from "@/lib/services/support-service";
import { SupportTicketsPanel, type SupportTicketRow } from "@/components/support/support-tickets-panel";

type EmpresaValue = (typeof EMPRESAS)[number];

type PageProps = {
  searchParams: Promise<{ empresa?: string; status?: string; categoria?: string }>;
};

const STATUS_OPTIONS = Object.values(SupportStatus);
const CATEGORIA_OPTIONS = Object.values(SupportCategoria);

function isEmpresa(value: string | undefined): value is EmpresaValue {
  return Boolean(value && (EMPRESAS as readonly string[]).includes(value));
}

function isStatus(value: string | undefined): value is SupportStatus {
  return Boolean(value && (STATUS_OPTIONS as readonly string[]).includes(value));
}

function isCategoria(value: string | undefined): value is SupportCategoria {
  return Boolean(value && (CATEGORIA_OPTIONS as readonly string[]).includes(value));
}

export default async function SuportePage({ searchParams }: PageProps) {
  const user = await getCurrentUser();

  if (!hasPermission(user.perfil, "support.view")) {
    redirect("/dashboard");
  }

  after(() => markSuporteVisitado(user.id));

  const isStaff = user.perfil !== "LOJA";
  const params = await searchParams;
  const empresaFiltro = isEmpresa(params.empresa) ? params.empresa : undefined;
  const statusFiltro = isStatus(params.status) ? params.status : undefined;
  const categoriaFiltro = isCategoria(params.categoria) ? params.categoria : undefined;

  const [tickets, assignableUsers] = await Promise.all([
    listSupportTickets(user, { empresa: empresaFiltro, status: statusFiltro, categoria: categoriaFiltro }),
    isStaff
      ? prisma.usuario.findMany({
          where: { ativo: true, perfil: { in: ["ATENDENTE", "SUPERVISOR", "ADMIN", "MASTER"] } },
          orderBy: { nome: "asc" },
          select: { id: true, nome: true }
        })
      : Promise.resolve([])
  ]);

  const rows: SupportTicketRow[] = tickets.map((ticket) => ({
    id: ticket.id,
    empresa: ticket.empresa,
    categoria: ticket.categoria,
    titulo: ticket.titulo,
    descricao: ticket.descricao,
    status: ticket.status,
    prazoResposta: ticket.prazoResposta.toISOString(),
    slaStatus: ticket.slaStatus,
    responsavel: ticket.responsavel,
    criadoPor: ticket.criadoPor,
    criadoEm: ticket.criadoEm.toISOString(),
    atualizadoEm: ticket.atualizadoEm.toISOString(),
    concluidoEm: ticket.concluidoEm ? ticket.concluidoEm.toISOString() : null,
    comentarios: ticket.comentarios.map((comentario) => ({
      id: comentario.id,
      autorNome: comentario.autorNome,
      autorPerfil: comentario.autorPerfil,
      comentario: comentario.comentario,
      criadoEm: comentario.criadoEm.toISOString()
    })),
    anexos: ticket.anexos.map((anexo) => ({
      id: anexo.id,
      fileName: anexo.fileName,
      mimeType: anexo.mimeType
    }))
  }));

  const naoConcluidos = rows.filter((row) => row.status !== "CONCLUIDO");
  const stats = [
    { label: "Total", value: naoConcluidos.length },
    { label: "Aberto", value: rows.filter((row) => row.status === "ABERTO").length },
    { label: "Em andamento", value: rows.filter((row) => row.status === "EM_ANDAMENTO").length },
    { label: "Concluídos", value: rows.filter((row) => row.status === "CONCLUIDO").length },
    {
      label: "Atrasados",
      value: naoConcluidos.filter((row) => new Date(row.prazoResposta) < new Date()).length
    }
  ];

  const displayRows = statusFiltro ? rows : naoConcluidos;

  return (
    <section className="page">
      <div className="page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Suporte</h1>
          <p className="muted">
            {isStaff
              ? "Chamados abertos pelas lojas para dúvidas, alterações e pedidos gerais."
              : "Acompanhe os chamados abertos por você. Prazo de resposta: até 2 dias úteis."}
          </p>
        </div>

        {user.perfil === "LOJA" ? (
          <Link href="/suporte/novo" className="btn btn-primary btn-create-ticket whitespace-nowrap">
            <Plus size={16} strokeWidth={2.5} aria-hidden />
            Novo chamado
          </Link>
        ) : null}
      </div>

      <div className="panel flex flex-wrap items-end justify-between gap-4">
        <form action="/suporte" method="get" className="flex flex-1 flex-wrap items-end gap-3">
          {isStaff ? (
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

          <label className="min-w-[180px]">
            Status
            <select name="status" defaultValue={statusFiltro ?? ""}>
              <option value="">Todos os status</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {formatEnumLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[180px]">
            Categoria
            <select name="categoria" defaultValue={categoriaFiltro ?? ""}>
              <option value="">Todas as categorias</option>
              {CATEGORIA_OPTIONS.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {formatEnumLabel(categoria)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-1">
            <button className="btn btn-primary h-[42px]" type="submit">
              Filtrar
            </button>
            <Link className="btn btn-link h-[42px] inline-flex items-center" href="/suporte">
              Limpar
            </Link>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {stats.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5"
              style={
                item.label === "Atrasados" && item.value > 0
                  ? { borderColor: "#fecaca", background: "#fef2f2" }
                  : { borderColor: "var(--color-border)", background: "#f8fafc" }
              }
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</span>
              <strong className="text-sm font-extrabold" style={{ color: item.label === "Atrasados" && item.value > 0 ? "#b91c1c" : "#0f172a" }}>
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      </div>

      <SupportTicketsPanel perfil={user.perfil} data={displayRows} assignableUsers={assignableUsers} />
    </section>
  );
}
