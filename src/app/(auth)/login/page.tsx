import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <section className="card" style={{ width: "100%", maxWidth: 480 }}>
      <h1>GO Atendimento</h1>
      <p className="muted" style={{ marginBottom: 16 }}>Faça login para acessar o sistema interno.</p>
      <LoginForm />
    </section>
  );
}
