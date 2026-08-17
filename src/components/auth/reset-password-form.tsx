"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/auth/supabase";

const LINK_VALIDATION_TIMEOUT_MS = 4000;

export function ResetPasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState<"validating" | "ready" | "invalid">("validating");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const { data: listener } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "PASSWORD_RECOVERY") {
        setStatus("ready");
      }
    });

    const timeoutId = setTimeout(() => {
      setStatus((current) => (current === "validating" ? "invalid" : current));
    }, LINK_VALIDATION_TIMEOUT_MS);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password.length < 8) {
      setError("A senha precisa ter ao menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    setTimeout(() => {
      router.replace("/dashboard");
      router.refresh();
    }, 1500);
  }

  if (done) {
    return <p>Senha atualizada com sucesso. Redirecionando...</p>;
  }

  if (status === "validating") {
    return <p className="muted">Validando link de redefinição...</p>;
  }

  if (status === "invalid") {
    return (
      <div>
        <p className="field-error">Este link de redefinição é inválido ou expirou.</p>
        <Link href="/login" className="link">Voltar para o login</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid" style={{ gap: 12 }}>
      <input required name="password" type="password" placeholder="Nova senha" minLength={8} />
      <input required name="confirmPassword" type="password" placeholder="Confirmar nova senha" minLength={8} />
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      <button type="submit" disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</button>
    </form>
  );
}
