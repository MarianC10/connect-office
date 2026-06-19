import { router } from "expo-router";

import { homeRouteForRole } from "@/lib/roles";

export function resetToHome(role: string | undefined | null) {
  router.replace(homeRouteForRole(role));
}
