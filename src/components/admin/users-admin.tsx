"use client";

import { FormEvent, useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EMPRESAS } from "@/config/domains";

type Perfil = "ATENDENTE" | "SUPERVISOR" | "ADMIN" | "LOJA";

type AdminUser = {
  id: string;
  authUserId: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  empresaVinculada?: (typeof EMPRESAS)[number] | null;
};

function getSafeUsers(input: unknown): AdminUser[] {
  return Array.isArray(input) ? (input as AdminUser[]) : [];
}

export function UsersAdmin({ initialUsers, initialError }: { initialUsers: unknown; initialError?: string | null }) {
  const [users, setUsers] = useState<AdminUser[]>(() => getSafeUsers(initialUsers));
  const [error, setError] = useState<string | null>(initialError ?? null);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("ATENDENTE");
  const [empresaVinculada, setEmpresaVinculada] = useState<string>("");
  const [enviarConvite, setEnviarConvite] = useState(false);
  const [senhaTemporaria, setSenhaTemporaria] = useState("");

  const hasUsers = useMemo(() => Array.isArray(users) && users.length > 0, [users]);

  function resetForm() {
    setEditingUserId(null);
    setNome("");
    setEmail("");
    setPerfil("ATENDENTE");
    setEmpresaVinculada("");
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
    setEnviarConvite(false);
    setSenhaTemporaria("");
  }

  async function createOrUpdateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const payload = {
      nome,
      email,
      perfil,
      empresaVinculada: empresaVinculada || null,
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
        empresaVinculada: payload.empresaVinculada
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

  return (
    <section className="grid">
      <form onSubmit={createOrUpdateUser} className="panel form-grid cols-4">
        <input name="nome" placeholder="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
        <input name="email" placeholder="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(editingUserId)} />

        <select name="perfil" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
          <option value="ATENDENTE">ATENDENTE</option>
          <option value="SUPERVISOR">SUPERVISOR</option>
          <option value="ADMIN">ADMIN</option>
          <option value="LOJA">LOJA</option>
        </select>

        <select name="empresaVinculada" required={perfil === "LOJA"} value={empresaVinculada} onChange={(e) => setEmpresaVinculada(e.target.value)}>
          <option value="">Sem empresa vinculada</option>
          {EMPRESAS.map((emp) => <option key={emp} value={emp}>{emp}</option>)}
        </select>

        {!editingUserId ? (
          <>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={enviarConvite} onChange={(e) => setEnviarConvite(e.target.checked)} />
              Enviar convite por e-mail
            </label>
            <input name="senhaTemporaria" placeholder="Senha temporária" type="password" disabled={enviarConvite} required={!enviarConvite} minLength={8} value={senhaTemporaria} onChange={(e) => setSenhaTemporaria(e.target.value)} />
          </>
        ) : (
          <div className="muted" style={{ alignSelf: "center" }}>E-mail/Auth não editáveis nesta etapa.</div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
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
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.nome}</td>
                  <td>{user.email}</td>
                  <td><StatusBadge value={user.perfil} /></td>
                  <td>{user.empresaVinculada ?? "-"}</td>
                  <td>{user.ativo ? "Sim" : "Não"}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => handleEditUser(user)}>Editar</button>
                    <button className="btn btn-secondary" onClick={() => toggleAtivo(user.id, user.ativo)}>{user.ativo ? "Inativar" : "Ativar"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
