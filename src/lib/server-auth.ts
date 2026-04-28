// Helper to attach the current Supabase user's access token to a server
// function call. The auth middleware on the server expects a Bearer token in
// the Authorization header — TanStack's createServerFn does not attach this
// automatically, so we have to pass it explicitly via the `headers` option.
import { supabase } from "@/integrations/supabase/client";

export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You're signed out — please log in again.");
  return { Authorization: `Bearer ${token}` };
}
