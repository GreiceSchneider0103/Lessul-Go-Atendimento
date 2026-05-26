export function getSupabasePublicKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
}

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function hasSupabaseClientEnv() {
  return Boolean(getSupabaseUrl() && getSupabasePublicKey());
}

export function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_BASE_URL ?? "https://lessul-go-atendimento-2p7t.onrender.com";
}
