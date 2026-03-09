<<<<<<< HEAD
import { getCurrentUser } from "@/lib/auth/session";

export default async function UsersPage() {
  const user = await getCurrentUser();
  return (
    <section className="grid">
      <h1>Meu usuário</h1>
      <div className="card">
        <p><strong>Nome:</strong> {user.nome}</p>
        <p><strong>Email:</strong> {user.email}</p>
        <p><strong>Perfil:</strong> {user.perfil}</p>
        <p><strong>Ativo:</strong> {String(user.ativo)}</p>
      </div>
=======
async function getUsers() {
  const response = await fetch(`${process.env.APP_BASE_URL ?? "http://localhost:3000"}/api/users`, { cache: "no-store" });
  return response.json();
}

export default async function UsersPage() {
  const users = await getUsers();
  return (
    <section className="grid">
      <h1>Usuários</h1>
      <div className="card"><pre>{JSON.stringify(users, null, 2)}</pre></div>
>>>>>>> origin/main
    </section>
  );
}
