import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <section className="card w-full max-w-[400px]">
      <h1 className="mb-1 text-xl font-bold">Entrar</h1>
      <p className="muted mb-5">Acesse o sistema interno de atendimento.</p>
      <LoginForm />
    </section>
  );
}
