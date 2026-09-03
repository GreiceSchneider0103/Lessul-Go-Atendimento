"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const supabase = getSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }

    await supabase.auth.getSession();
    router.replace("/dashboard");
    router.refresh();
  }

  async function onForgotPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setForgotError(null);
    setForgotMessage(null);
    setForgotLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    setForgotLoading(false);

    if (resetError) {
      setForgotError(resetError.message);
      return;
    }

    setForgotMessage("Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha.");
  }

  return (
    <div className="grid gap-3.5">
      <form onSubmit={onSubmit} className="grid gap-3.5">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
          E-mail
          <input required name="email" type="email" placeholder="voce@empresa.com.br" autoComplete="email" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
          Senha
          <input required name="password" type="password" placeholder="••••••••" autoComplete="current-password" />
        </label>
        {error ? <p className="field-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary mt-1 h-[42px]" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <button
        type="button"
        className="btn btn-link justify-self-start p-0 text-xs"
        onClick={() => {
          setShowForgotPassword((current) => !current);
          setForgotMessage(null);
          setForgotError(null);
        }}
      >
        Esqueci minha senha
      </button>

      {showForgotPassword ? (
        <form onSubmit={onForgotPasswordSubmit} className="grid gap-2.5 rounded-[10px] border border-slate-200 bg-slate-50 p-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
            Informe seu e-mail para receber o link de redefinição
            <input
              required
              type="email"
              placeholder="voce@empresa.com.br"
              value={forgotEmail}
              onChange={(event) => setForgotEmail(event.target.value)}
            />
          </label>
          {forgotError ? <p className="field-error">{forgotError}</p> : null}
          {forgotMessage ? <p className="muted">{forgotMessage}</p> : null}
          <button type="submit" className="btn btn-secondary h-[38px]" disabled={forgotLoading}>
            {forgotLoading ? "Enviando..." : "Enviar link de redefinição"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
