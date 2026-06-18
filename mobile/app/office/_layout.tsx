import { Stack } from "expo-router";

import { MemberShellGate } from "@/components/role-guard";

export default function Layout() {
  return (
    <MemberShellGate>
      <Stack screenOptions={{ headerShown: false }} />
    </MemberShellGate>
  );
}
