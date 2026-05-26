import { redirect } from "next/navigation";
import { hasSupabaseClientEnv } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  if (!hasSupabaseClientEnv()) redirect("/login");

  try {
    const user = await getCurrentUser();
    if (user.perfil === "LOJA") redirect("/loja/solicitacoes");
    redirect("/dashboard");
  } catch {
    redirect("/login");
  }
}
