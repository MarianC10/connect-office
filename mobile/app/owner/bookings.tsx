import React, { useCallback, useState } from "react";
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
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useFocusEffect } from "@react-navigation/native";

import { OwnerBottomBar } from "@/components/owner-bottom-bar";
import {
  formatBookingChipLabel,
  formatBookingDateLabel,
  getBookingWindowDateKeys,
  todayInBucharest,
} from "@/lib/bookings";
import { fetchOwnerBookings, fetchOwnerLocations } from "@/lib/owner";
import type { OwnerBooking } from "@/lib/owner";

const BG_IMAGE = require("../../assets/images/login_signup_background.jpg");

type BookingStatus = "confirmed" | "pending";

export type Booking = {
  id: string;
  officeName: string;
  bookedByEmail: string;
  dates: string;
  status: BookingStatus;
  imageUrl?: string;
};

const PLACEHOLDER_OFFICE_IMAGE =
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=600&auto=format&fit=crop";

export default function OwnerBookingsScreen() {
  const [selectedDate, setSelectedDate] = useState(todayInBucharest());
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const dateOptions = getBookingWindowDateKeys();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [locs, items] = await Promise.all([
        fetchOwnerLocations(),
        fetchOwnerBookings({
          date: selectedDate,
          locationId: locationFilter ?? undefined,
        }),
      ]);
      setLocations(locs.map((l) => ({ id: l.id, name: l.name })));
      setBookings(items.map(mapOwnerBooking));
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, locationFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

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
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {dateOptions.map((dateKey) => (
                  <TouchableOpacity
                    key={dateKey}
                    activeOpacity={0.75}
                    style={[
                      styles.dateChip,
                      selectedDate === dateKey && styles.dateChipActive,
                    ]}
                    onPress={() => setSelectedDate(dateKey)}
                  >
                    <Text
                      style={[
                        styles.dateChipText,
                        selectedDate === dateKey && styles.dateChipTextActive,
                      ]}
                    >
                      {formatBookingChipLabel(dateKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {locations.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRow}
              >
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    locationFilter === null && styles.filterChipActive,
                  ]}
                  onPress={() => setLocationFilter(null)}
                >
                  <Text style={styles.filterChipText}>All locations</Text>
                </TouchableOpacity>
                {locations.map((loc) => (
                  <TouchableOpacity
                    key={loc.id}
                    style={[
                      styles.filterChip,
                      locationFilter === loc.id && styles.filterChipActive,
                    ]}
                    onPress={() => setLocationFilter(loc.id)}
                  >
                    <Text style={styles.filterChipText} numberOfLines={1}>
                      {loc.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.bookingsList}>
              {loading ? (
                <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
              ) : bookings.length === 0 ? (
                <Text style={styles.emptyText}>
                  No bookings on {formatBookingDateLabel(selectedDate)}.
                </Text>
              ) : (
                bookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))
              )}
            </View>
          </ScrollView>

          <OwnerBottomBar />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

function mapOwnerBooking(b: OwnerBooking): Booking {
  return {
    id: b.id,
    officeName: b.location_name,
    bookedByEmail: b.renter_email || b.renter_name,
    dates: formatBookingDateLabel(b.booking_date),
    status: b.status === "confirmed" ? "confirmed" : "pending",
    imageUrl: b.location_image_url,
  };
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
    marginBottom: 12,
  },

  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginRight: 8,
  },

  dateChipActive: {
    backgroundColor: "rgba(255,255,255,0.85)",
  },

  dateChipText: {
    color: "#ddd",
    fontSize: 13,
    fontWeight: "700",
  },

  dateChipTextActive: {
    color: "#132457",
  },

  filterRow: {
    marginBottom: 14,
  },

  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginRight: 8,
    maxWidth: 180,
  },

  filterChipActive: {
    backgroundColor: "rgba(16,24,91,0.85)",
  },

  filterChipText: {
    color: "#f2f2f2",
    fontSize: 12,
    fontWeight: "600",
  },

  emptyText: {
    color: "#ddd",
    textAlign: "center",
    marginTop: 24,
    fontSize: 15,
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
});
