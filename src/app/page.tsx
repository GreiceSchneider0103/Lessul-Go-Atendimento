import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { hasSupabaseClientEnv } from "@/lib/supabase/config";

function hasSupabaseSessionCookie(cookieNames: string[]) {
  return cookieNames.some((name) => name.includes("-auth-token"));
}

export default async function Home() {
  if (!hasSupabaseClientEnv()) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((cookie) => cookie.name);

  if (hasSupabaseSessionCookie(cookieNames)) {
    redirect("/dashboard");
  }

  redirect("/login");
}
