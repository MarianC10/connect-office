import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Image,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

const BG_IMAGE = require("../../assets/images/login_signup_background.jpg");

// ---------------------------------------------------------------------------
// PLACEHOLDER DATA
// Everything below is mock data shown when no real data is passed in via
// props. Once the backend is ready, fetch the real values (e.g. with a hook
// or a query) in the parent screen / navigator and pass them down as props.
// Nothing else in this file needs to change.
// ---------------------------------------------------------------------------

type BookingStatus = "confirmed" | "pending";

export type RecentBooking = {
  id: string;
  officeName: string;
  date: string;
  userName: string;
  status: BookingStatus;
  /** Optional photo for the office. Falls back to a placeholder image if omitted. */
  imageUrl?: string;
};

export type OwnerDashboardScreenProps = {
  /** TODO: wire up to e.g. `useOwnerProfile().firstName` */
  ownerName?: string;
  /** TODO: wire up to e.g. `useOwnerStats().locationsCount` */
  locationsCount?: number;
  /** TODO: wire up to e.g. `useOwnerStats().bookingsCount` */
  bookingsCount?: number;
  /** TODO: wire up to e.g. `useRecentBookings({ limit: 3 })` */
  recentBookings?: RecentBooking[];
};

// Fallback image used for any booking that doesn't have its own `imageUrl`.
// TODO: once offices have real photos coming from the backend, this is only
// needed as a last-resort fallback (e.g. office has no photo uploaded yet).
const PLACEHOLDER_OFFICE_IMAGE =
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=600&auto=format&fit=crop";

const PLACEHOLDER_OWNER_NAME = "owner name";
const PLACEHOLDER_LOCATIONS_COUNT = 3;
const PLACEHOLDER_BOOKINGS_COUNT = 12;

const PLACEHOLDER_RECENT_BOOKINGS: RecentBooking[] = [
  {
    id: "1",
    officeName: "Office name",
    date: "07.08.2026",
    userName: "user_name",
    status: "confirmed",
  },
  {
    id: "2",
    officeName: "Office name",
    date: "07.08.2026",
    userName: "user_name",
    status: "pending",
  },
  {
    id: "3",
    officeName: "Office name",
    date: "07.08.2026",
    userName: "user_name",
    status: "confirmed",
  },
];

export default function OwnerDashboardScreen({
  ownerName = PLACEHOLDER_OWNER_NAME,
  locationsCount = PLACEHOLDER_LOCATIONS_COUNT,
  bookingsCount = PLACEHOLDER_BOOKINGS_COUNT,
  recentBookings = PLACEHOLDER_RECENT_BOOKINGS,
}: OwnerDashboardScreenProps) {
  return (
    <ImageBackground source={BG_IMAGE} style={styles.background} resizeMode="cover">
      <StatusBar barStyle="light-content" />

      <View style={styles.overlay} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.phoneFrame}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.header}>
              <Text style={styles.welcome}>Welcome back,</Text>
              {/* TODO: backend - owner's display name */}
              <Text style={styles.ownerName}>{ownerName}.</Text>
            </View>

            <View style={styles.statsRow}>
              <StatCard
                icon={
                  <MaterialCommunityIcons
                    name="office-building-marker-outline"
                    size={32}
                    color="#000"
                  />
                }
                // TODO: backend - total number of locations owned
                value={String(locationsCount)}
                label="locations"
              />

              <StatCard
                icon={
                  <MaterialCommunityIcons
                    name="calendar-month-outline"
                    size={32}
                    color="#000"
                  />
                }
                // TODO: backend - total number of bookings
                value={String(bookingsCount)}
                label="bookings"
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.addButton}
              onPress={() => router.push("/owner/add-location" as any)}
            >
              <Text style={styles.addButtonText}>+ Add New Location</Text>
            </TouchableOpacity>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Bookings</Text>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => router.push("/owner/bookings" as any)}
              >
                <Text style={styles.viewAll}>view all</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bookingsList}>
              {/* TODO: backend - list of the owner's most recent bookings */}
              {recentBookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </View>
          </ScrollView>

          <OwnerBottomBar />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <BlurView intensity={45} tint="light" style={styles.statCard}>
      <View style={styles.statIcon}>{icon}</View>

      <View style={styles.statTextBlock}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </BlurView>
  );
}

function BookingCard({ booking }: { booking: RecentBooking }) {
  const isConfirmed = booking.status === "confirmed";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.bookingCard}
      onPress={() => router.push("/owner/bookings" as any)}
    >
      <Image
        // TODO: backend - office photo. Falls back to a stock photo if the
        // office doesn't have one uploaded yet.
        source={{ uri: booking.imageUrl ?? PLACEHOLDER_OFFICE_IMAGE }}
        style={styles.bookingImage}
      />

      <View style={styles.bookingInfo}>
        <Text numberOfLines={1} style={styles.officeName}>
          {booking.officeName}
        </Text>

        <Text style={styles.bookingMeta}>Date: {booking.date}</Text>
        <Text style={styles.bookingMeta}>User: {booking.userName}</Text>

        <View
          style={[
            styles.statusBadge,
            isConfirmed ? styles.confirmedBadge : styles.pendingBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              isConfirmed ? styles.confirmedText : styles.pendingText,
            ]}
          >
            {booking.status}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function OwnerBottomBar() {
  return (
    <View style={styles.bottomBarWrapper}>
      <BlurView intensity={70} tint="light" style={styles.bottomBar}>
        <TouchableOpacity
          activeOpacity={0.75}
          style={styles.bottomItem}
          onPress={() => router.push("/owner" as any)}
        >
          <Ionicons name="home-outline" size={25} color="#000" />
        </TouchableOpacity>

        <View style={styles.bottomDivider} />

        <TouchableOpacity
          activeOpacity={0.75}
          style={styles.bottomItem}
          onPress={() => router.push("/owner/bookings" as any)}
        >
          <Ionicons name="calendar-outline" size={25} color="#000" />
        </TouchableOpacity>

        <View style={styles.bottomDivider} />

        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.bottomItem, styles.bottomItemActive]}
          onPress={() => router.push("/owner/locations" as any)}
        >
          <MaterialCommunityIcons name="map-marker-outline" size={26} color="#000" />
        </TouchableOpacity>

        <View style={styles.bottomDivider} />

        <TouchableOpacity
          activeOpacity={0.75}
          style={styles.bottomItem}
          onPress={() => router.push("/owner/settings" as any)}
        >
          <Ionicons name="people-outline" size={27} color="#000" />
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#111111",
  },

  safeArea: {
    flex: 1,
  },

  phoneFrame: {
    flex: 1,
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    borderRadius: 15,
    overflow: "visible",
  },

  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.42)",
  },

  scrollContent: {
    paddingHorizontal: 17,
    paddingTop: 24,
    paddingBottom: 96,
  },

  header: {
    marginTop: 2,
    marginBottom: 24,
  },

  welcome: {
    color: "#F2F2F2",
    fontSize: 31,
    fontWeight: "800",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  ownerName: {
    color: "#E7E7E7",
    fontSize: 29,
    fontStyle: "italic",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
    marginTop: 6,
  },

  statsRow: {
    flexDirection: "row",
    gap: 22,
    marginBottom: 14,
  },

  statCard: {
    flex: 1,
    height: 82,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.55)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },

  statIcon: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  statTextBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  statValue: {
    color: "#F5F5F5",
    fontSize: 25,
    fontWeight: "800",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
    lineHeight: 28,
  },

  statLabel: {
    color: "#F2F2F2",
    fontSize: 14,
    fontWeight: "700",
    fontStyle: "italic",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
    marginTop: 1,
  },

  addButton: {
    height: 48,
    borderRadius: 16,
    backgroundColor: "#10185B",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 15,
    marginTop: 0,
    marginBottom: 7,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "800",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },

  sectionTitle: {
    color: "#F2F2F2",
    fontSize: 17,
    fontWeight: "800",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  viewAll: {
    color: "#BFBFBF",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  bookingsList: {
    gap: 9,
  },

  bookingCard: {
    minHeight: 89,
    borderRadius: 13,
    backgroundColor: "rgba(232,232,232,0.78)",
    flexDirection: "row",
    overflow: "hidden",
    padding: 11,
  },

  bookingImage: {
    width: 91,
    height: "100%",
    minHeight: 89,
    borderRadius: 14,
  },

  bookingInfo: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 12,
    paddingTop: 4,
    paddingBottom: 9,
  },

  officeName: {
    color: "#06105A",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 29,
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  bookingMeta: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  statusBadge: {
    position: "absolute",
    right: 11,
    bottom: 7,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },

  confirmedBadge: {
    backgroundColor: "#EEF3FF",
  },

  pendingBadge: {
    backgroundColor: "#FFF9EC",
  },

  statusText: {
    fontSize: 13,
    fontWeight: "800",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  confirmedText: {
    color: "#1A4B7A",
  },

  pendingText: {
    color: "#9B6400",
  },

  bottomBarWrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 9,
  },

  bottomBar: {
    height: 39,
    borderRadius: 19,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.78)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  bottomItem: {
    flex: 1,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
  },

  bottomItemActive: {
    backgroundColor: "rgba(255,255,255,0.32)",
  },

  bottomDivider: {
    width: 1,
    height: 25,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
});
