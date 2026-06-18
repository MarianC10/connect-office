import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { fetchMe, type MeProfile } from "@/lib/profile";

export function useUserRole() {
  const [me, setMe] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const reload = useCallback(async () => {
    const showLoader = !hasLoadedRef.current;
    if (showLoader) {
      setLoading(true);
    }
    setError(null);
    try {
      const profile = await fetchMe();
      setMe(profile);
      hasLoadedRef.current = true;
    } catch (e) {
      setMe(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  return { me, role: me?.role ?? "member", loading, error, reload };
}
