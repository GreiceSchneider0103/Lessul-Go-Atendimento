import Link from "next/link";
import { BarChart3, LayoutDashboard, ArrowRight } from "lucide-react";
import { requireCurrentUser } from "@/lib/auth/require-user";
import { assertPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { listUsuariosComEmpresas } from "@/lib/services/users-service";
import { UsersAdmin } from "@/components/admin/users-admin";

export default async function AdminPage() {
  const user = await requireCurrentUser();
  assertPermission(user.perfil, "user.manage");

  let users: Awaited<ReturnType<typeof listUsuariosComEmpresas>> = [];
  let totalTickets = 0;
  let activeTickets = 0;
  let failedBackups = 0;
  let dataError: string | null = null;

  try {
    [users, totalTickets, activeTickets, failedBackups] = await Promise.all([
      listUsuariosComEmpresas(),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { ativo: true } }),
      prisma.ticket.count({ where: { backupSyncStatus: "FAILED" } })
    ]);
  } catch (error) {
    dataError = error instanceof Error ? error.message : "Falha ao carregar métricas administrativas";
  }

  return (
    <section className="page">
      <div className="page-header">
        <h1>Administração</h1>
        <p className="muted">Gestão de usuários, permissões e saúde operacional do sistema.</p>
      </div>

      {dataError ? (
        <div className="alert alert-error">
          {dataError}
          <br />
          Aplique o patch SQL de alinhamento do banco para liberar as métricas de backup e auditoria.
        </div>
      ) : null}

      <div className="grid grid-4">
        <article className="card">
          <strong className="text-xs font-bold uppercase tracking-wide text-slate-500">Total de usuários</strong>
          <p className="metric-value">{users.length}</p>
        </article>
        <article className="card">
          <strong className="text-xs font-bold uppercase tracking-wide text-slate-500">Tickets totais</strong>
          <p className="metric-value">{totalTickets}</p>
        </article>
        <article className="card">
          <strong className="text-xs font-bold uppercase tracking-wide text-slate-500">Tickets ativos</strong>
          <p className="metric-value">{activeTickets}</p>
        </article>
        <article className="card">
          <strong className="text-xs font-bold uppercase tracking-wide text-slate-500">Backups com falha</strong>
          <p className="metric-value">{failedBackups}</p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/dashboard" className="card flex items-center justify-between gap-3 transition hover:border-brand-300 hover:shadow-popover">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-600">
              <LayoutDashboard size={19} strokeWidth={2.25} />
            </span>
            <div>
              <strong className="text-sm font-bold text-slate-800">Dashboard</strong>
              <p className="muted">Indicadores consolidados da operação</p>
            </div>
          </div>
          <ArrowRight size={16} strokeWidth={2.25} className="text-slate-400" aria-hidden />
        </Link>

        <Link href="/reports" className="card flex items-center justify-between gap-3 transition hover:border-brand-300 hover:shadow-popover">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-slate-100 text-slate-600">
              <BarChart3 size={19} strokeWidth={2.25} />
            </span>
            <div>
              <strong className="text-sm font-bold text-slate-800">Relatórios</strong>
              <p className="muted">Estatísticas e exportação de dados</p>
            </div>
          </div>
          <ArrowRight size={16} strokeWidth={2.25} className="text-slate-400" aria-hidden />
        </Link>
      </div>

      <UsersAdmin initialUsers={users} initialError={dataError} allowMultiEmpresa />
    </section>
  );
}
