import { Stack } from "expo-router";

import { OwnerShellGate } from "@/components/role-guard";

export default function OwnerLayout() {
  return (
    <OwnerShellGate>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="bookings" />
        <Stack.Screen name="locations" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="add-location" />
        <Stack.Screen name="edit-location" />
      </Stack>
    </OwnerShellGate>
  );
}
