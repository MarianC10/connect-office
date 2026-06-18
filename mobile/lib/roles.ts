export type UserRole = "member" | "owner";

export function isOwnerRole(role: string | undefined | null): boolean {
  return role === "owner";
}

export function homeRouteForRole(role: string | undefined | null): "/owner" | "/(tabs)" {
  return isOwnerRole(role) ? "/owner" : "/(tabs)";
}
