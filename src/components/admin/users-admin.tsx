"use client";

import { FormEvent, useMemo, useState } from "react";
import { Pencil, Power, KeyRound } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EMPRESAS } from "@/config/domains";

type Perfil = "ATENDENTE" | "SUPERVISOR" | "ADMIN" | "LOJA" | "MASTER";

const DEFAULT_PERFIL_OPTIONS: Perfil[] = ["ATENDENTE", "SUPERVISOR", "ADMIN", "LOJA"];

type AdminUser = {
  id: string;
  authUserId: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  empresaVinculada?: (typeof EMPRESAS)[number] | null;
  empresasVinculadas?: Array<(typeof EMPRESAS)[number]>;
};

function getSafeUsers(input: unknown): AdminUser[] {
  return Array.isArray(input) ? (input as AdminUser[]) : [];
}

type UsersAdminProps = {
  initialUsers: unknown;
  initialError?: string | null;
  perfilOptions?: Perfil[];
  showPasswordReset?: boolean;
  allowMultiEmpresa?: boolean;
};

export function UsersAdmin({
  initialUsers,
  initialError,
  perfilOptions = DEFAULT_PERFIL_OPTIONS,
  showPasswordReset = false,
  allowMultiEmpresa = false
}: UsersAdminProps) {
  const [users, setUsers] = useState<AdminUser[]>(() => getSafeUsers(initialUsers));
  const [error, setError] = useState<string | null>(initialError ?? null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("ATENDENTE");
  const [empresaVinculada, setEmpresaVinculada] = useState<string>("");
  const [empresasVinculadas, setEmpresasVinculadas] = useState<string[]>([]);
  const [enviarConvite, setEnviarConvite] = useState(false);
  const [senhaTemporaria, setSenhaTemporaria] = useState("");
  const [resetPasswordState, setResetPasswordState] = useState<Record<string, "loading" | "sent" | "error">>({});

  const hasUsers = useMemo(() => Array.isArray(users) && users.length > 0, [users]);

  function resetForm() {
    setEditingUserId(null);
    setNome("");
    setEmail("");
    setPerfil("ATENDENTE");
    setEmpresaVinculada("");
    setEmpresasVinculadas([]);
    setEnviarConvite(false);
    setSenhaTemporaria("");
  }

  function handleEditUser(user: AdminUser) {
    setError(null);
    setEditingUserId(user.id);
    setNome(user.nome ?? "");
    setEmail(user.email ?? "");
    setPerfil(user.perfil);
    setEmpresaVinculada(user.empresaVinculada ?? "");
    setEmpresasVinculadas(user.empresasVinculadas ?? (user.empresaVinculada ? [user.empresaVinculada] : []));
    setEnviarConvite(false);
    setSenhaTemporaria("");
  }

  function toggleEmpresaVinculada(empresa: string) {
    setEmpresasVinculadas((prev) =>
      prev.includes(empresa) ? prev.filter((item) => item !== empresa) : [...prev, empresa]
    );
  }

  async function createOrUpdateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = {
      nome,
      email,
      perfil,
      empresaVinculada: allowMultiEmpresa ? (empresasVinculadas[0] || null) : (empresaVinculada || null),
      empresasVinculadas: allowMultiEmpresa ? empresasVinculadas : undefined,
      senhaTemporaria: senhaTemporaria || undefined,
      enviarConvite
    };

    const url = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
    const method = editingUserId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingUserId ? {
        nome: payload.nome,
        perfil: payload.perfil,
        empresaVinculada: payload.empresaVinculada,
        empresasVinculadas: payload.empresasVinculadas
      } : payload)
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.message ?? `Erro ao ${editingUserId ? "atualizar" : "criar"} usuário`);
      return;
    }

    if (body?.data) {
      if (editingUserId) {
        setUsers((prev) => prev.map((item) => (item.id === editingUserId ? body.data : item)));
      } else {
        setUsers((prev) => [body.data, ...prev]);
      }
      resetForm();
    }
  }

  async function toggleAtivo(userId: string, ativo: boolean) {
    const response = await fetch(`/api/users/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ativo: !ativo }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.message ?? "Erro ao atualizar usuário");
      return;
    }

    const updated = body?.data as AdminUser | undefined;
    if (updated) {
      setUsers((prev) => prev.map((user) => (user.id === userId ? updated : user)));
      return;
    }

    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, ativo: !ativo } : user)));
  }

  async function sendPasswordReset(userId: string) {
    setError(null);
    setResetPasswordState((prev) => ({ ...prev, [userId]: "loading" }));

    const response = await fetch(`/api/users/${userId}/reset-password`, { method: "POST" });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setResetPasswordState((prev) => ({ ...prev, [userId]: "error" }));
      setError(body.message ?? "Erro ao enviar e-mail de redefinição de senha");
      return;
    }

    setResetPasswordState((prev) => ({ ...prev, [userId]: "sent" }));
  }

  return (
    <section className="grid">
      <form onSubmit={createOrUpdateUser} className="panel form-grid cols-4">
        <input name="nome" placeholder="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
        <input name="email" placeholder="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(editingUserId)} />

        <select name="perfil" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
          {perfilOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>

        {allowMultiEmpresa ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-500">
              Empresas vinculadas{perfil === "LOJA" ? " (obrigatório para LOJA)" : ""}
            </span>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {EMPRESAS.map((emp) => (
                <label key={emp} className="flex items-center gap-1.5 text-sm font-normal text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 flex-none"
                    checked={empresasVinculadas.includes(emp)}
                    onChange={() => toggleEmpresaVinculada(emp)}
                  />
                  {emp}
                </label>
              ))}
            </div>
          </div>
        ) : (
          <select name="empresaVinculada" required={perfil === "LOJA"} value={empresaVinculada} onChange={(e) => setEmpresaVinculada(e.target.value)}>
            <option value="">Sem empresa vinculada</option>
            {EMPRESAS.map((emp) => <option key={emp} value={emp}>{emp}</option>)}
          </select>
        )}

        {!editingUserId ? (
          <>
            <label className="flex items-center gap-2 text-sm font-normal text-slate-700">
              <input type="checkbox" className="h-4 w-4 flex-none" checked={enviarConvite} onChange={(e) => setEnviarConvite(e.target.checked)} />
              Enviar convite por e-mail
            </label>
            <input name="senhaTemporaria" placeholder="Senha temporária" type="password" disabled={enviarConvite} required={!enviarConvite} minLength={8} value={senhaTemporaria} onChange={(e) => setSenhaTemporaria(e.target.value)} />
          </>
        ) : (
          <div className="muted self-center">E-mail/Auth não editáveis nesta etapa.</div>
        )}

        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">{editingUserId ? "Salvar edição" : "Cadastrar usuário"}</button>
          {editingUserId ? <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancelar</button> : null}
        </div>
      </form>

      {error ? <p className="alert alert-error">{error}</p> : null}

      <div className="panel table-wrap">
        {!hasUsers ? <div className="empty-state">Nenhum usuário encontrado para exibir.</div> : (
          <table className="table">
            <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Empresa</th><th>Ativo</th><th>Ação</th></tr></thead>
            <tbody>
              {users.map((user) => {
                const resetState = resetPasswordState[user.id];

                return (
                  <tr key={user.id}>
                    <td>{user.nome}</td>
                    <td>{user.email}</td>
                    <td><StatusBadge value={user.perfil} /></td>
                    <td>
                      {allowMultiEmpresa
                        ? user.empresasVinculadas?.length
                          ? user.empresasVinculadas.join(", ")
                          : "-"
                        : user.empresaVinculada ?? "-"}
                    </td>
                    <td>{user.ativo ? "Sim" : "Não"}</td>
                    <td className="flex flex-wrap items-center gap-2">
                      <button className="btn btn-secondary" onClick={() => handleEditUser(user)}>
                        <Pencil size={14} strokeWidth={2.25} aria-hidden />
                        Editar
                      </button>
                      <button className="btn btn-secondary" onClick={() => toggleAtivo(user.id, user.ativo)}>
                        <Power size={14} strokeWidth={2.25} aria-hidden />
                        {user.ativo ? "Inativar" : "Ativar"}
                      </button>
                      {showPasswordReset ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={resetState === "loading"}
                          onClick={() => sendPasswordReset(user.id)}
                        >
                          <KeyRound size={14} strokeWidth={2.25} aria-hidden />
                          {resetState === "loading" ? "Enviando..." : resetState === "sent" ? "E-mail enviado" : "Redefinir senha"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
