import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <section className="card w-full max-w-[400px]">
      <h1 className="mb-1 text-xl font-bold">Redefinir senha</h1>
      <p className="muted mb-5">Escolha uma nova senha para sua conta.</p>
      <ResetPasswordForm />
    </section>
  );
}
