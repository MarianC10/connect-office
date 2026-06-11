import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Image,
  Pressable,
  Share,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";

import { getAccessToken } from "@/lib/api";
import { API_BASE_URL } from "@/lib/env";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.48;

const STATIC_FILES_URL =
  process.env.EXPO_PUBLIC_STATIC_FILES_URL ?? "http://localhost:8082";

function resolveImageUrl(url?: string) {
  if (!url) return null;

  let finalUrl = url.trim();

  if (finalUrl.startsWith("http://localhost:8082")) {
    finalUrl = finalUrl.replace("http://localhost:8082", STATIC_FILES_URL);
  }

  if (finalUrl.startsWith("http://127.0.0.1:8082")) {
    finalUrl = finalUrl.replace("http://127.0.0.1:8082", STATIC_FILES_URL);
  }

  if (finalUrl.startsWith("/")) {
    finalUrl = `${STATIC_FILES_URL}${finalUrl}`;
  }

  return encodeURI(finalUrl);
}

interface Amenity {
  name: string;
  category: string;
}

interface LocationImage {
  id: string;
  url: string;
}

interface Location {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  county: string;
  country: string;
  latitude: number;
  longitude: number;
  amenities: Amenity[];
  images: LocationImage[];
}

const C = {
  pageBg: "#D9D9D9",
  cardBg: "#D9D9D9",
  text: "#111111",
  muted: "#666666",
  white: "#FFFFFF",
  barBg: "#BFBFBF",
  buttonBg: "#E8E8E8",
} as const;

function getAmenityIcon(name: string) {
  const value = name.toLowerCase();

  if (value.includes("wi") || value.includes("internet")) return "wifi";
  if (value.includes("coffee")) return "coffee-outline";
  if (value.includes("parking")) return "truck-outline";
  if (value.includes("meeting")) return "account-group-outline";
  if (value.includes("desk")) return "desk";
  if (value.includes("print")) return "printer-outline";

  return "check-circle-outline";
}

export default function OfficeDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [imageIndex, setImageIndex] = useState(0);
  const [isImageFullScreen, setIsImageFullScreen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOffice() {
      try {
        const token = await getAccessToken();

        const response = await fetch(`${API_BASE_URL}/locations/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Server error: HTTP ${response.status}`);
        }

        const data = (await response.json()) as Location;

        console.log("Location data:", data);
        console.log("Images from API:", data.images);

        if (!cancelled) {
          setLocation(data);
          setImageIndex(0);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (id) {
      loadOffice();
    }

    return () => {
      cancelled = true;
    };
  }, [id]);

  const images = location?.images ?? [];
  const currentImage = resolveImageUrl(images[imageIndex]?.url);
  const hasMultipleImages = images.length > 1;

  const goPreviousImage = () => {
    if (images.length === 0) return;

    setImageIndex((current) =>
      current === 0 ? images.length - 1 : current - 1
    );
  };

  const goNextImage = () => {
    if (images.length === 0) return;

    setImageIndex((current) =>
      current === images.length - 1 ? 0 : current + 1
    );
  };

  const openFullScreenImage = () => {
    console.log("Center image pressed");
    console.log("currentImage:", currentImage);

    if (!currentImage) return;

    setIsImageFullScreen(true);
  };

  const closeFullScreenImage = () => {
    setIsImageFullScreen(false);
  };

  const handleShare = async () => {
    if (!location) return;

    console.log("Share button pressed");

    try {
      await Share.share({
        title: location.name,
        message: `${location.name}

${location.address}
${location.city}, ${location.country}

${location.description}`,
      });
    } catch (e) {
      console.log("Share failed:", e);
      Alert.alert("Share failed", "Could not open the share menu.");
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safe} edges={[]}>
        <StatusBar barStyle="light-content" />

        {loading && (
          <View style={styles.centeredState}>
            <ActivityIndicator size="large" color={C.text} />
            <Text style={styles.centeredText}>Loading office…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.centeredState}>
            <Ionicons name="cloud-offline-outline" size={42} color={C.text} />
            <Text style={styles.centeredText}>Could not load office</Text>
            <Text style={styles.centeredSub}>{error}</Text>
          </View>
        )}

        {!loading && !error && location && (
          <View style={styles.page}>
            <View style={styles.imageArea}>
              {currentImage ? (
                <Image
                  source={{ uri: currentImage }}
                  style={styles.heroImage}
                  resizeMode="cover"
                  onError={(error) => {
                    console.log("currentImage used by Expo:", currentImage);
                    console.log("Image failed to load:", currentImage);
                    console.log(error.nativeEvent);
                  }}
                  onLoad={() => {
                    console.log("Image loaded:", currentImage);
                  }}
                />
              ) : (
                <View style={styles.heroPlaceholder}>
                  <Text style={styles.heroEmoji}>🏢</Text>
                </View>
              )}

              <>
                {hasMultipleImages && (
                  <Pressable
                    style={[styles.imageTapZone, styles.imageTapZoneLeft]}
                    onPress={goPreviousImage}
                  />
                )}

                <Pressable
                  style={[
                    styles.imageTapZone,
                    hasMultipleImages
                      ? styles.imageTapZoneCenter
                      : styles.imageTapZoneFull,
                  ]}
                  onPress={openFullScreenImage}
                />

                {hasMultipleImages && (
                  <Pressable
                    style={[styles.imageTapZone, styles.imageTapZoneRight]}
                    onPress={goNextImage}
                  />
                )}
              </>
            </View>

            <View style={styles.topIcons}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => router.back()}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="arrow-back-circle-outline"
                  size={30}
                  color={C.text}
                />
              </TouchableOpacity>

              <View style={styles.rightIcons}>
                <TouchableOpacity
                  style={styles.iconButton}
                  activeOpacity={0.8}
                  onPress={handleShare}
                >
                  <Ionicons name="share-outline" size={26} color={C.text} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
                  <Ionicons name="heart-outline" size={29} color={C.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailsCard}>
                <Text style={styles.title}>
                  {location.name || "OFFICE NAME"}
                </Text>

                <Text style={styles.address} numberOfLines={2}>
                  adresa: {location.address}
                </Text>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={24} color={C.text} />
                  <Text style={styles.infoText}>{location.city}</Text>
                </View>

                {location.amenities.slice(0, 4).map((amenity) => (
                  <View key={amenity.name} style={styles.infoRow}>
                    <MaterialCommunityIcons
                      name={getAmenityIcon(amenity.name) as never}
                      size={25}
                      color={C.text}
                    />
                    <Text style={styles.infoText}>{amenity.name}</Text>
                  </View>
                ))}

                <Text style={styles.descriptionLabel}>Description:</Text>

                <Text style={styles.description}>
                  {location.description ||
                    "Main hub near the old town with flexible desks and bookable meeting rooms."}
                </Text>

                <View style={styles.bottomBar}>
                  <Text style={styles.price}>500 Lei</Text>

                  <TouchableOpacity
                    style={styles.bookButton}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.bookText}>book</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <Modal
              visible={isImageFullScreen}
              transparent={false}
              animationType="fade"
              onRequestClose={closeFullScreenImage}
            >
              <View style={styles.fullScreenContainer}>
                <StatusBar barStyle="light-content" backgroundColor="#000000" />

                {currentImage && (
                  <Image
                    source={{ uri: currentImage }}
                    style={styles.fullScreenImage}
                    resizeMode="contain"
                    onError={(error) => {
                      console.log("Full screen image failed:", currentImage);
                      console.log(error.nativeEvent);
                    }}
                  />
                )}

                <TouchableOpacity
                  style={styles.fullScreenCloseButton}
                  onPress={closeFullScreenImage}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={34} color={C.white} />
                </TouchableOpacity>

                {hasMultipleImages && (
                  <>
                    <Pressable
                      style={[
                        styles.fullScreenTapZone,
                        styles.fullScreenTapZoneLeft,
                      ]}
                      onPress={goPreviousImage}
                    />

                    <Pressable
                      style={[
                        styles.fullScreenTapZone,
                        styles.fullScreenTapZoneRight,
                      ]}
                      onPress={goNextImage}
                    />

                    <View style={styles.imageCounter}>
                      <Text style={styles.imageCounterText}>
                        {imageIndex + 1} / {images.length}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </Modal>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.pageBg,
  },

  page: {
    flex: 1,
    backgroundColor: C.cardBg,
  },

  scroll: {
    flex: 1,
    backgroundColor: "transparent",
    zIndex: 2,
  },

  scrollContent: {
    paddingTop: IMAGE_HEIGHT - 50,
    paddingBottom: 0,
    backgroundColor: "transparent",
  },

  centeredState: {
    flex: 1,
    backgroundColor: C.pageBg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },

  centeredText: {
    color: C.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  centeredSub: {
    color: C.muted,
    fontSize: 13,
    textAlign: "center",
  },

  imageArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: "#FFFBFB",
    overflow: "hidden",
    zIndex: 1,
  },

  heroImage: {
    width: "100%",
    height: "100%",
  },

  heroPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(210, 220, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroEmoji: {
    fontSize: 84,
  },

  imageTapZone: {
    position: "absolute",
    top: 0,
    bottom: 0,
    zIndex: 5,
  },

  imageTapZoneLeft: {
    left: 0,
    width: "25%",
  },

  imageTapZoneCenter: {
    left: "25%",
    width: "50%",
  },

  imageTapZoneRight: {
    right: 0,
    width: "25%",
  },

  imageTapZoneFull: {
    left: 0,
    right: 0,
  },

  topIcons: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
    elevation: 20,
  },

  rightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  detailsCard: {
    width: "100%",
    backgroundColor: C.cardBg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  title: {
    fontSize: 24,
    fontWeight: "900",
    color: C.text,
    textAlign: "center",
    fontFamily: Platform.select({
      ios: "Times New Roman",
      android: "serif",
      default: "serif",
    }),
  },

  address: {
    marginTop: 4,
    fontSize: 15,
    color: C.muted,
    textAlign: "center",
    fontFamily: Platform.select({
      ios: "Times New Roman",
      android: "serif",
      default: "serif",
    }),
  },

  divider: {
    height: 1,
    backgroundColor: C.white,
    opacity: 0.9,
    marginTop: 8,
    marginBottom: 18,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingLeft: 16,
  },

  infoText: {
    fontSize: 21,
    fontWeight: "800",
    color: C.text,
    fontFamily: Platform.select({
      ios: "Times New Roman",
      android: "serif",
      default: "serif",
    }),
  },

  descriptionLabel: {
    marginTop: 8,
    fontSize: 21,
    fontWeight: "900",
    color: C.text,
    fontFamily: Platform.select({
      ios: "Times New Roman",
      android: "serif",
      default: "serif",
    }),
  },

  description: {
    marginTop: 8,
    marginLeft: 20,
    marginRight: 16,
    fontSize: 17,
    lineHeight: 22,
    color: "#4D4D4D",
    fontFamily: Platform.select({
      ios: "Times New Roman",
      android: "serif",
      default: "serif",
    }),
  },

  bottomBar: {
    marginTop: 20,
    height: 52,
    borderRadius: 16,
    backgroundColor: C.barBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 14,
  },

  price: {
    fontSize: 25,
    fontWeight: "900",
    color: C.white,
    fontFamily: Platform.select({
      ios: "Times New Roman",
      android: "serif",
      default: "serif",
    }),
  },

  bookButton: {
    minWidth: 98,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.buttonBg,
    alignItems: "center",
    justifyContent: "center",
  },

  bookText: {
    fontSize: 21,
    fontWeight: "800",
    color: C.white,
    fontFamily: Platform.select({
      ios: "Times New Roman",
      android: "serif",
      default: "serif",
    }),
  },

  fullScreenContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },

  fullScreenImage: {
    width: "100%",
    height: "100%",
  },

  fullScreenCloseButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 28,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
    elevation: 30,
  },

  fullScreenTapZone: {
    position: "absolute",
    top: 100,
    bottom: 100,
    width: "50%",
    zIndex: 10,
  },

  fullScreenTapZoneLeft: {
    left: 0,
  },

  fullScreenTapZoneRight: {
    right: 0,
  },

  imageCounter: {
    position: "absolute",
    bottom: 40,
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  imageCounterText: {
    color: C.white,
    fontSize: 14,
    fontWeight: "700",
  },
});