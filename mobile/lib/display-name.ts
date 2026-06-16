import { supabase } from '@/lib/supabase';

type Metadata = Record<string, unknown> | undefined;

export function usernameFromSupabaseMetadata(metadata: Metadata): string {
  if (!metadata) return '';
  const preferred = metadata.preferred_username;
  const userName = metadata.user_name;
  const username = metadata.username;
  const value =
    (typeof preferred === 'string' && preferred) ||
    (typeof userName === 'string' && userName) ||
    (typeof username === 'string' && username) ||
    '';
  return value.trim();
}

export function isLikelyAutoDisplayName(displayName: string, email: string): boolean {
  const trimmed = displayName.trim();
  if (!trimmed || trimmed === 'User') {
    return true;
  }
  const local = email.split('@')[0]?.trim().toLowerCase() ?? '';
  return local !== '' && trimmed.toLowerCase() === local;
}

/** Prefer backend display_name; fall back to Supabase metadata when backend is empty. */
export function resolveDisplayName(
  backendDisplayName: string,
  metadata: Metadata
): string {
  const backend = backendDisplayName.trim();
  const fromSupabase = usernameFromSupabaseMetadata(metadata);
  if (backend.length >= 2) {
    return backend;
  }
  if (fromSupabase.length >= 2) {
    return fromSupabase;
  }
  return backend || fromSupabase || 'User';
}

export async function syncDisplayNameToSupabase(displayName: string): Promise<void> {
  const trimmed = displayName.trim();
  if (trimmed.length < 2) {
    return;
  }
  const { error } = await supabase.auth.updateUser({
    data: { preferred_username: trimmed },
  });
  if (error) {
    throw error;
  }
}
