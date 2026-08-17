import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <section className="card" style={{ width: "100%", maxWidth: 480 }}>
      <h1>Redefinir senha</h1>
      <p className="muted" style={{ marginBottom: 16 }}>Escolha uma nova senha para sua conta.</p>
      <ResetPasswordForm />
    </section>
  );
}
