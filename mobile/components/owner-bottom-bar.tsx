import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { router, usePathname } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

type TabKey = "home" | "bookings" | "locations" | "profile";

const TABS: { key: TabKey; label: string; href: string }[] = [
  { key: "home", label: "Home", href: "/owner" },
  { key: "bookings", label: "Bookings", href: "/owner/bookings" },
  { key: "locations", label: "Locations", href: "/owner/locations" },
  { key: "profile", label: "Profile", href: "/owner/profile" },
];

function activeTabFromPath(pathname: string): TabKey {
  if (pathname.includes("/owner/bookings")) return "bookings";
  if (pathname.includes("/owner/locations")) return "locations";
  if (pathname.includes("/owner/profile")) return "profile";
  return "home";
}

export function OwnerBottomBar() {
  const pathname = usePathname();
  const active = activeTabFromPath(pathname);

  return (
    <BlurView intensity={55} tint="light" style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.item, isActive && styles.itemActive]}
            onPress={() => router.push(tab.href as any)}
            activeOpacity={0.8}
          >
            {tab.key === "home" && (
              <Ionicons name="home-outline" size={26} color="#000" />
            )}
            {tab.key === "bookings" && (
              <MaterialCommunityIcons name="calendar-check-outline" size={26} color="#000" />
            )}
            {tab.key === "locations" && (
              <MaterialCommunityIcons name="map-marker-outline" size={26} color="#000" />
            )}
            {tab.key === "profile" && (
              <Ionicons name="person-outline" size={26} color="#000" />
            )}
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.25)",
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
    borderRadius: 10,
  },
  itemActive: {
    backgroundColor: "rgba(46, 91, 255, 0.12)",
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: "#333",
  },
  labelActive: {
    color: "#132457",
  },
});
