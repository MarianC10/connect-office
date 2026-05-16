import { API_BASE_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/** Provisions the user row in the Go API (GET /me with Supabase access token). */
export async function syncCurrentUserWithBackend(
  accessTokenOverride?: string
): Promise<void> {
  let token = accessTokenOverride;
  if (!token) {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token;
  }
  if (!token) {
    throw new Error("No active session");
  }
  const res = await fetch(`${API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}
