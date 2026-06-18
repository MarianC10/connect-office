import { Stack } from "expo-router";

import { MemberShellGate } from "@/components/role-guard";

export default function ChatLayout() {
  return (
    <MemberShellGate>
      <Stack screenOptions={{ headerShown: false }} />
    </MemberShellGate>
  );
}
