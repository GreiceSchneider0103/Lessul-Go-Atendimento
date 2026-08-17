import { requireCurrentUser } from "@/lib/auth/require-user";
import { assertPermission } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db/prisma";
import { UsersAdmin } from "@/components/admin/users-admin";

const MASTER_PERFIL_OPTIONS = ["ATENDENTE", "SUPERVISOR", "ADMIN", "LOJA", "MASTER"] as const;

export default async function MasterPage() {
  const user = await requireCurrentUser();
  assertPermission(user.perfil, "master.manage");

  let users: Awaited<ReturnType<typeof prisma.usuario.findMany>> = [];
  let dataError: string | null = null;

  try {
    users = await prisma.usuario.findMany({ orderBy: { criadoEm: "desc" } });
  } catch (error) {
    dataError = error instanceof Error ? error.message : "Falha ao carregar usuários";
  }

  return (
    <section className="page">
      <div className="page-header">
        <h1>Master</h1>
        <p className="muted">Configuração de contas, permissões e redefinição de senha.</p>
      </div>

      {dataError ? <div className="alert alert-error">{dataError}</div> : null}

      <UsersAdmin
        initialUsers={users}
        initialError={dataError}
        perfilOptions={[...MASTER_PERFIL_OPTIONS]}
        showPasswordReset
      />
    </section>
  );
}
