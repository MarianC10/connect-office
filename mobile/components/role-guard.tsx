import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { useUserRole } from "@/hooks/use-user-role";
import { isOwnerRole } from "@/lib/roles";

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
});

export function MemberShellGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { role, loading } = useUserRole();

  useEffect(() => {
    if (!loading && isOwnerRole(role)) {
      router.replace("/owner");
    }
  }, [loading, role, router]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#132457" />
      </View>
    );
  }

  if (isOwnerRole(role)) {
    return null;
  }

  return <>{children}</>;
}

export function OwnerShellGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { role, loading } = useUserRole();

  useEffect(() => {
    if (!loading && !isOwnerRole(role)) {
      router.replace("/(tabs)");
    }
  }, [loading, role, router]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#132457" />
      </View>
    );
  }

  if (!isOwnerRole(role)) {
    return null;
  }

  return <>{children}</>;
}
