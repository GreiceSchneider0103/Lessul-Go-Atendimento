import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicKey, getSupabaseUrl } from "@/lib/supabase/config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (browserClient) return browserClient;

  const url = getSupabaseUrl();
  const anonKey = getSupabasePublicKey();

  if (!url || !anonKey) {
    throw new Error("Supabase não configurado no browser");
  }

  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
