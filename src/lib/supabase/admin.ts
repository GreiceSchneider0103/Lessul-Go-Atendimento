import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

export function createSupabaseAdminClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase Admin não configurado (URL/Service Role)");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function hasSupabaseAdminEnv() {
  return Boolean(getSupabaseUrl() && getSupabasePublicKey() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
