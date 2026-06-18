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
import { fetchOwnerLocations } from "@/lib/owner";

const BG_IMAGE = require("../../assets/images/login_signup_background.jpg");

// ---------------------------------------------------------------------------
// PLACEHOLDER DATA
// Everything below is mock data shown when no real data is passed in via
// props. Once the backend is ready, fetch the real values (e.g. with a hook
// or a query) in the parent screen / navigator and pass them down as props.
// Nothing else in this file needs to change.
// ---------------------------------------------------------------------------

export type OwnerLocation = {
  id: string;
  name: string;
  city: string;
  bookingsCount: number;
  imageUrl?: string;
};

const PLACEHOLDER_LOCATION_IMAGE =
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=600&auto=format&fit=crop";

export default function OwnerLocationsScreen() {
  const [locations, setLocations] = useState<OwnerLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchOwnerLocations();
      setLocations(
        items.map((loc) => ({
          id: loc.id,
          name: loc.name,
          city: loc.city,
          bookingsCount: loc.booking_count,
          imageUrl: loc.image_url,
        }))
      );
    } catch {
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadLocations();
    }, [loadLocations])
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
            <BlurView intensity={45} tint="light" style={styles.titleCard}>
              <MaterialCommunityIcons
                name="anchor"
                size={24}
                color="#1A1A1A"
                style={styles.titleIcon}
              />
              <Text style={styles.title}>My Locations</Text>
            </BlurView>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.addButton}
              onPress={() => router.push("/owner/add-location" as any)}
            >
              <Text style={styles.addButtonText}>+ Add Location</Text>
            </TouchableOpacity>

            <View style={styles.locationsList}>
              {loading ? (
                <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
              ) : locations.length === 0 ? (
                <Text style={styles.emptyText}>No locations yet.</Text>
              ) : (
                locations.map((location) => (
                  <LocationCard key={location.id} location={location} />
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

function LocationCard({ location }: { location: OwnerLocation }) {
  return (
    <View style={styles.locationCard}>
      <Image
        // TODO: backend - location photo. Falls back to a stock photo if the
        // location doesn't have one uploaded yet.
        source={{ uri: location.imageUrl ?? PLACEHOLDER_LOCATION_IMAGE }}
        style={styles.locationImage}
      />

      <View style={styles.locationInfo}>
        <Text numberOfLines={1} style={styles.locationName}>
          {location.name}
        </Text>
        <Text style={styles.locationCity}>{location.city}</Text>

        <View style={styles.locationFooter}>
          {/* TODO: backend - number of bookings for this location */}
          <Text style={styles.bookingsCount}>Bookings: {location.bookingsCount}</Text>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.editButton}
            onPress={() =>
              // TODO: backend - pass the real location id once available
              router.push(`/owner/edit-location?id=${location.id}` as any)
            }
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
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
    paddingTop: 18,
    paddingBottom: 96,
  },

  titleCard: {
    height: 60,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(232,232,232,0.78)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  titleIcon: {
    marginRight: 9,
  },

  title: {
    color: "#1A1A1A",
    fontSize: 26,
    fontWeight: "800",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  addButton: {
    height: 48,
    borderRadius: 16,
    backgroundColor: "#10185B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  locationsList: {
    gap: 14,
  },

  emptyText: {
    color: "#ddd",
    textAlign: "center",
    marginTop: 8,
    fontSize: 15,
  },

  locationCard: {
    minHeight: 148,
    borderRadius: 18,
    backgroundColor: "rgba(232,232,232,0.78)",
    flexDirection: "row",
    padding: 11,
  },

  locationImage: {
    width: 110,
    height: "100%",
    borderRadius: 14,
  },

  locationInfo: {
    flex: 1,
    paddingLeft: 14,
    justifyContent: "space-between",
  },

  locationName: {
    color: "#06105A",
    fontSize: 23,
    fontWeight: "900",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  locationCity: {
    color: "#6E7390",
    fontSize: 14,
    fontWeight: "600",
    marginTop: -2,
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  locationFooter: {
    gap: 8,
  },

  bookingsCount: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
  },

  editButton: {
    height: 34,
    borderRadius: 17,
    backgroundColor: "#10185B",
    alignItems: "center",
    justifyContent: "center",
  },

  editButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      default: "serif",
    }),
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
