import React, { useState } from "react";
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

export type Booking = {
  id: string;
  officeName: string;
  bookedByEmail: string;
  /** Already formatted for display, e.g. "12 Jun 2026 - 13 Jun 2026 (2 days)" */
  dates: string;
  status: BookingStatus;
  /** Optional photo for the office. Falls back to a placeholder image if omitted. */
  imageUrl?: string;
};

export type OwnerBookingsScreenProps = {
  /** TODO: wire up to e.g. `useOwnerBookings()` */
  bookings?: Booking[];
};

// Fallback image used for any booking that doesn't have its own `imageUrl`.
const PLACEHOLDER_OFFICE_IMAGE =
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=600&auto=format&fit=crop";

const PLACEHOLDER_BOOKINGS: Booking[] = [
  {
    id: "1",
    officeName: "Deerling",
    bookedByEmail: "user_name@gmail.com",
    dates: "12 Jun 2026 - 13 Jun 2026 (2 days)",
    status: "confirmed",
  },
  {
    id: "2",
    officeName: "Office name",
    bookedByEmail: "user_name@gmail.com",
    dates: "15 Jun 2026 (1 day)",
    status: "pending",
  },
  {
    id: "3",
    officeName: "Office name",
    bookedByEmail: "user_name@gmail.com",
    dates: "22 Jun 2026 - 24 Jun 2026 (3 days)",
    status: "confirmed",
  },
];

type TabKey = "all" | "pending";

export default function OwnerBookingsScreen({
  bookings = PLACEHOLDER_BOOKINGS,
}: OwnerBookingsScreenProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  // TODO: once bookings come from the backend, this filtering can stay
  // client-side (small list) or be swapped for a server-side filtered query.
  const visibleBookings =
    activeTab === "all" ? bookings : bookings.filter((b) => b.status === "pending");

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
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.headerSideSlot}
                onPress={() => router.back()}
              >
                <Ionicons name="chevron-back" size={26} color="#F2F2F2" />
              </TouchableOpacity>

              <Text style={styles.headerTitle}>Bookings</Text>

              <View style={styles.headerSideSlot} />
            </View>

            <View style={styles.tabsRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.tabButton}
                onPress={() => setActiveTab("all")}
              >
                <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>
                  All Bookings
                </Text>
                {activeTab === "all" && <View style={styles.tabIndicator} />}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.tabButton}
                onPress={() => setActiveTab("pending")}
              >
                <Text style={[styles.tabText, activeTab === "pending" && styles.tabTextActive]}>
                  Pending
                </Text>
                {activeTab === "pending" && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            </View>

            <View style={styles.bookingsList}>
              {/* TODO: backend - owner's bookings, filtered by the active tab */}
              {visibleBookings.map((booking) => (
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

function BookingCard({ booking }: { booking: Booking }) {
  const isConfirmed = booking.status === "confirmed";

  return (
    <View style={styles.bookingCard}>
      <Image
        // TODO: backend - office photo, falls back to a stock photo if missing
        source={{ uri: booking.imageUrl ?? PLACEHOLDER_OFFICE_IMAGE }}
        style={styles.bookingImage}
      />

      <View style={styles.bookingInfo}>
        <Text numberOfLines={1} style={styles.officeName}>
          {booking.officeName}
        </Text>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Booked by</Text>
          {/* TODO: backend - email of the user who made the booking */}
          <Text style={styles.fieldValue}>{booking.bookedByEmail}</Text>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Dates</Text>
          {/* TODO: backend - booking date range */}
          <Text style={styles.fieldValue}>{booking.dates}</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.fieldLabel}>Status</Text>

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
              {isConfirmed ? "Confirmed" : "Pending"}
            </Text>
          </View>
        </View>
      </View>
    </View>
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
          style={[styles.bottomItem, styles.bottomItemActive]}
          onPress={() => router.push("/owner/bookings" as any)}
        >
          <Ionicons name="calendar-outline" size={25} color="#000" />
        </TouchableOpacity>

        <View style={styles.bottomDivider} />

        <TouchableOpacity
          activeOpacity={0.75}
          style={styles.bottomItem}
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
    paddingTop: 14,
    paddingBottom: 96,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  headerSideSlot: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#F2F2F2",
    fontSize: 26,
    fontWeight: "800",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  tabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.25)",
    marginBottom: 16,
  },

  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 10,
  },

  tabText: {
    color: "#B9B9B9",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  tabTextActive: {
    color: "#F5F5F5",
  },

  tabIndicator: {
    position: "absolute",
    bottom: -1,
    height: 2,
    width: "70%",
    borderRadius: 2,
    backgroundColor: "#10185B",
  },

  bookingsList: {
    gap: 12,
  },

  bookingCard: {
    minHeight: 150,
    borderRadius: 16,
    backgroundColor: "rgba(232,232,232,0.78)",
    flexDirection: "row",
    padding: 11,
  },

  bookingImage: {
    width: 100,
    height: "100%",
    borderRadius: 14,
  },

  bookingInfo: {
    flex: 1,
    paddingLeft: 14,
  },

  officeName: {
    color: "#06105A",
    fontSize: 22,
    fontWeight: "900",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  fieldBlock: {
    marginTop: 7,
  },

  fieldLabel: {
    color: "#6E7390",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  fieldValue: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 1,
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 9,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
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
