import { API_BASE_URL } from "@/lib/env";
import { supabase } from "@/lib/supabase";

export async function getAccessToken(accessTokenOverride?: string): Promise<string> {
  if (accessTokenOverride) return accessTokenOverride;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error("No active session");
  }
  return token;
}

/** Provisions the user row in the Go API (GET /me with Supabase access token). */
export async function syncCurrentUserWithBackend(
  accessTokenOverride?: string
): Promise<void> {
  const token = await getAccessToken(accessTokenOverride);
  const res = await fetch(`${API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
}
