"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
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
  );
}
