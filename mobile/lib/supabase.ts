import "expo-sqlite/localStorage/install";
import type { LockFunc } from "@supabase/auth-js";
import { createClient } from "@supabase/supabase-js";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

const authLock: LockFunc = async (_name, _acquireTimeout, fn) => await fn();

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
    lock: authLock,
    ...(typeof __DEV__ !== "undefined" && __DEV__ ? { debug: true } : {}),
  },
});
