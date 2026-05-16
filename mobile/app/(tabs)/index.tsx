import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  StatusBar,
  ImageBackground,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";
import { Ionicons, Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useScrollToTop } from "@react-navigation/native";

import { getAccessToken } from "@/lib/api";
import { API_BASE_URL } from "@/lib/env";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.44;
const CARD_GAP = 12;

// ─── Background image ─────────────────────────────────────────────────────────

const BG_IMAGE = require("../../assets/images/login_signup_background.jpg");

// ─── Types ────────────────────────────────────────────────────────────────────

interface Amenity {
  name: string;
  category: string;
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
}

interface MapMarkerData {
  id: string;
  title: string;
  coordinate: { latitude: number; longitude: number };
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  glassBg:       "rgba(255, 255, 255, 0.20)",
  glassBgStrong: "rgba(255, 255, 255, 0.32)",
  glassBgSolid:  "rgba(255, 255, 255, 0.92)",
  glassBorder:   "rgba(255, 255, 255, 0.50)",
  text:          "#12122A",
  textSub:       "#38385E",
  textMuted:     "#7A7A9A",
  accent:        "#002f6c",
  accentLight:   "rgba(46, 91, 255, 0.15)",
  heart:         "#FF3B5C",
  star:          "#DE8807",
  white:         "#FFFFFF",
  danger:        "#FF3B5C",
} as const;

const CARD_TINTS = [
  "rgba(46,  91, 255, 0.06)",
  "rgba(100, 180, 255, 0.06)",
  "rgba(180, 200, 255, 0.06)",
  "rgba(60,  120, 200, 0.06)",
  "rgba(80,  140, 220, 0.06)",
];

// ─── Default map region (Cluj-Napoca) ─────────────────────────────────────────

const DEFAULT_REGION: Region = {
  latitude: 46.7712,
  longitude: 23.6236,
  latitudeDelta: 0.14,
  longitudeDelta: 0.14,
};

// ─── Fetch hook ───────────────────────────────────────────────────────────────

function useLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading]     = useState<boolean>(true);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const r = await fetch(`${API_BASE_URL}/locations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!r.ok) throw new Error(`Server error: HTTP ${r.status}`);
        const data = (await r.json()) as Location[];
        setLocations(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { locations, loading, error };
}

// ─── Nominatim geocoder (free, no API key) ────────────────────────────────────

async function geocodeLocation(query: string): Promise<NominatimResult[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=5&addressdetails=1`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "en", "User-Agent": "ConnectOfficeApp/1.0" },
  });
  if (!res.ok) throw new Error("Geocode request failed");
  return res.json();
}

// ─── Shared office markers rendered on MapView ────────────────────────────────

interface OfficeMapMarkersProps {
  markers: MapMarkerData[];
}

function OfficeMapMarkers({ markers }: OfficeMapMarkersProps) {
  return (
    <>
      {markers.map((m) => (
        <Marker key={m.id} coordinate={m.coordinate} title={m.title}>
          <View style={styles.markerOuter}>
            <View style={styles.markerInner} />
          </View>
        </Marker>
      ))}
    </>
  );
}

// ─── Fullscreen Interactive Map Modal ─────────────────────────────────────────

interface FullscreenMapProps {
  visible: boolean;
  onClose: () => void;
  markers: MapMarkerData[];
}

function FullscreenMap({ visible, onClose, markers }: FullscreenMapProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [mapQuery, setMapQuery]           = useState<string>("");
  const [suggestions, setSuggestions]     = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching]     = useState<boolean>(false);
  const [searchError, setSearchError]     = useState<string>("");
  const [searchedPin, setSearchedPin]     = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchedLabel, setSearchedLabel] = useState<string>("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Match query against real location markers
  const matchOffices = (text: string): NominatimResult[] => {
    const q = text.toLowerCase();
    return markers
      .filter((m) => m.title.toLowerCase().includes(q))
      .map((m) => ({
        place_id: 0,
        display_name: m.title,
        lat: String(m.coordinate.latitude),
        lon: String(m.coordinate.longitude),
        type: "office",
        _isOffice: true,
      } as NominatimResult & { _isOffice?: boolean }));
  };

  const handleMapQueryChange = useCallback((text: string) => {
    setMapQuery(text);
    setSearchError("");
    if (!text.trim()) { setSuggestions([]); return; }

    const officeMatches = matchOffices(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await geocodeLocation(text);
        const officeNames = new Set(officeMatches.map((o) => o.display_name.toLowerCase()));
        const external = results.filter(
          (r) => !officeNames.has(r.display_name.split(",")[0].toLowerCase())
        );
        setSuggestions([...officeMatches, ...external].slice(0, 6));
      } catch {
        setSuggestions(officeMatches);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    setSuggestions(officeMatches);
  }, [markers]);

  const handleSelectSuggestion = useCallback((result: NominatimResult & { _isOffice?: boolean }) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    const label = result.display_name.split(",")[0];
    const region: Region = {
      latitude: lat,
      longitude: lon,
      latitudeDelta: result._isOffice ? 0.01 : 0.05,
      longitudeDelta: result._isOffice ? 0.01 : 0.05,
    };
    mapRef.current?.animateToRegion(region, 800);
    setSearchedPin({ latitude: lat, longitude: lon });
    setSearchedLabel(label);
    setSuggestions([]);
    setMapQuery(label);
    Keyboard.dismiss();
  }, []);

  const handleSearchSubmit = useCallback(async () => {
    if (!mapQuery.trim()) return;

    const officeMatches = matchOffices(mapQuery);
    if (officeMatches.length > 0) {
      handleSelectSuggestion(officeMatches[0] as NominatimResult & { _isOffice?: boolean });
      setSuggestions([]);
      Keyboard.dismiss();
      return;
    }

    setIsSearching(true);
    setSearchError("");
    setSuggestions([]);
    Keyboard.dismiss();
    try {
      const results = await geocodeLocation(mapQuery);
      if (results.length === 0) {
        setSearchError("Location not found. Try a different search.");
        return;
      }
      handleSelectSuggestion(results[0]);
    } catch {
      setSearchError("Network error. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }, [mapQuery, handleSelectSuggestion]);

  const handleClose = () => {
    setMapQuery("");
    setSuggestions([]);
    setSearchedPin(null);
    setSearchError("");
    onClose();
  };

  const shortName = (name: string) => {
    const parts = name.split(",");
    return parts.slice(0, 3).join(",").trim();
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.fullscreenContainer}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            initialRegion={DEFAULT_REGION}
            customMapStyle={lightMapStyle}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass
          >
            <OfficeMapMarkers markers={markers} />
            {searchedPin && (
              <Marker coordinate={searchedPin} title={searchedLabel}>
                <View style={styles.searchedMarkerOuter}>
                  <View style={styles.searchedMarkerInner} />
                </View>
              </Marker>
            )}
          </MapView>

          {/* ── Top bar: search + close ── */}
          <View style={[styles.fullscreenTopBar, { top: insets.top + 10 }]}>
            <BlurView intensity={75} tint="light" style={styles.mapSearchBlur}>
              <View style={styles.mapSearchInner}>
                <Feather name="search" size={15} color={C.textMuted} style={{ marginRight: 7 }} />
                <TextInput
                  style={styles.mapSearchInput}
                  placeholder="Search city or location…"
                  placeholderTextColor={C.textMuted}
                  value={mapQuery}
                  onChangeText={handleMapQueryChange}
                  onSubmitEditing={handleSearchSubmit}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {isSearching && (
                  <ActivityIndicator size="small" color={C.accent} style={{ marginLeft: 6 }} />
                )}
                {!isSearching && mapQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => { setMapQuery(""); setSuggestions([]); setSearchedPin(null); setSearchError(""); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={16} color={C.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </BlurView>

            <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.85}>
              <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFill} />
              <Ionicons name="close" size={20} color={C.text} />
            </TouchableOpacity>
          </View>

          {/* ── Suggestions dropdown ── */}
          {suggestions.length > 0 && (
            <View style={[styles.suggestionsBox, { top: insets.top + 10 + 52 + 8 }]}>
              <BlurView intensity={85} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.suggestionsInner}>
                {suggestions.map((s, i) => {
                  const isOffice = (s as NominatimResult & { _isOffice?: boolean })._isOffice;
                  return (
                    <TouchableOpacity
                      key={`${s.place_id}-${i}`}
                      style={[
                        styles.suggestionRow,
                        i < suggestions.length - 1 && styles.suggestionBorder,
                      ]}
                      onPress={() => handleSelectSuggestion(s as NominatimResult & { _isOffice?: boolean })}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={isOffice ? "business-outline" : "location-outline"}
                        size={15}
                        color={isOffice ? C.accent : C.textMuted}
                        style={{ marginRight: 10 }}
                      />
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {shortName(s.display_name)}
                      </Text>
                      {isOffice && (
                        <Text style={{ fontSize: 10, color: C.accent, fontWeight: "600", marginLeft: 6 }}>
                          Office
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Error message ── */}
          {searchError !== "" && (
            <View style={[styles.errorBox, { top: insets.top + 10 + 52 + 8 }]}>
              <BlurView intensity={85} tint="light" style={StyleSheet.absoluteFill} />
              <Ionicons name="alert-circle-outline" size={15} color={C.danger} style={{ marginRight: 7 }} />
              <Text style={styles.errorText}>{searchError}</Text>
            </View>
          )}

          {/* ── My location button ── */}
          <TouchableOpacity
            style={[styles.myLocationBtn, { bottom: insets.bottom + 24 }]}
            onPress={() => mapRef.current?.animateToRegion(DEFAULT_REGION, 700)}
            activeOpacity={0.85}
          >
            <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFill} />
            <Ionicons name="locate-outline" size={20} color={C.accent} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── LocationCard (carousel) ──────────────────────────────────────────────────

interface LocationCardProps {
  item: Location;
  index: number;
}

function LocationCard({ item, index }: LocationCardProps) {
  const tint = CARD_TINTS[index % CARD_TINTS.length];

  // Pick a representative amenity label for the subtitle area
  const amenityLabel = item.amenities.length > 0
    ? item.amenities[0].name
    : item.county;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      style={styles.card}
      onPress={() => router.push({ pathname: "/office/[id]", params: { id: item.id } })}
    >
      <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />

      <View style={styles.cardImg}>
        <View style={styles.cardImgIconWrap}>
          <Text style={styles.cardImgEmoji}>🏢</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardCity} numberOfLines={1}>{item.city}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardAmenity} numberOfLines={1}>{amenityLabel}</Text>
        </View>
      </View>

      <View style={styles.cardBorderRing} />
    </TouchableOpacity>
  );
}

// ─── SectionCarousel ─────────────────────────────────────────────────────────

interface SectionCarouselProps {
  title: string;
  data: Location[];
  onSeeAll: () => void;
}

function SectionCarousel({ title, data, onSeeAll }: SectionCarouselProps) {
  if (data.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={styles.seeAll}>see all</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
        ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
        renderItem={({ item, index }) => <LocationCard item={item} index={index} />}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
      />
    </View>
  );
}

// ─── SearchResultCard ─────────────────────────────────────────────────────────

interface SearchResultCardProps {
  item: Location;
}

function SearchResultCard({ item }: SearchResultCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      style={styles.resultCard}
      onPress={() => router.push({ pathname: "/office/[id]", params: { id: item.id } })}
    >
      <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFill} />
      <View style={styles.resultCardBg} />

      {/* Left: office image placeholder */}
      <View style={styles.resultCardImg}>
        <Text style={{ fontSize: 32 }}>🏢</Text>
      </View>

      {/* Right: info */}
      <View style={styles.resultCardBody}>
        <View style={styles.resultCardHeader}>
          <Text style={styles.resultCardName} numberOfLines={1}>{item.name}</Text>
        </View>

        <Text style={styles.resultCardCity} numberOfLines={1}>
          {item.city}, {item.county}
        </Text>
        <Text style={styles.resultCardAddress} numberOfLines={1}>{item.address}</Text>

        {/* Amenity pills */}
        {item.amenities.length > 0 && (
          <View style={styles.resultCardFooter}>
            {item.amenities.slice(0, 3).map((a) => (
              <View key={a.name} style={styles.amenityPill}>
                <Text style={styles.amenityPillText}>{a.name}</Text>
              </View>
            ))}
            {item.amenities.length > 3 && (
              <Text style={styles.amenityMore}>+{item.amenities.length - 3}</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.resultCardBorder} />
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [searchQuery, setSearchQuery]     = useState<string>("");
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [mapFullscreen, setMapFullscreen] = useState<boolean>(false);

  useScrollToTop(scrollRef);

  const { locations, loading, error } = useLocations();

  // Derive map markers from real data
  const officeMarkers: MapMarkerData[] = locations.map((loc) => ({
    id: loc.id,
    title: loc.name,
    coordinate: { latitude: loc.latitude, longitude: loc.longitude },
  }));

  // Group by city for section carousels
  const clujLocations      = locations.filter((l) => l.city === "Cluj-Napoca");
  const bucharestLocations = locations.filter((l) => l.city === "Bucharest");
  const otherLocations     = locations.filter(
    (l) => l.city !== "Cluj-Napoca" && l.city !== "Bucharest"
  );

  // Search filters across all locations
  const searchResults = searchQuery.trim().length > 0
    ? locations.filter((l) => {
        const q = searchQuery.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q) ||
          l.county.toLowerCase().includes(q) ||
          l.address.toLowerCase().includes(q)
        );
      })
    : [];
  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <ImageBackground source={BG_IMAGE} style={styles.bgImage} resizeMode="cover" blurRadius={1.2}>
      <View style={styles.bgOverlay} />

      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="dark-content" />

        {/* ── Search bar ── */}
        <View style={styles.searchWrapper}>
          <BlurView intensity={60} tint="light" style={styles.searchBlur}>
            <View style={[styles.searchInner, searchFocused && styles.searchInnerFocused]}>
              <Feather
                name="search"
                size={17}
                color={searchFocused ? C.accent : C.textMuted}
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search offices, cities…"
                placeholderTextColor={C.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={17} color={C.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </BlurView>
        </View>

        {/* ── Scrollable body ── */}
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Loading state ── */}
          {loading && (
            <View style={styles.centeredState}>
              <ActivityIndicator size="large" color={C.accent} />
              <Text style={styles.centeredStateText}>Loading locations…</Text>
            </View>
          )}

          {/* ── Error state ── */}
          {!loading && error && (
            <View style={styles.centeredState}>
              <Ionicons name="cloud-offline-outline" size={40} color={C.textMuted} />
              <Text style={styles.centeredStateText}>Could not load locations</Text>
              <Text style={styles.centeredStateSub}>{error}</Text>
            </View>
          )}

          {/* ── Content (only when data is ready) ── */}
          {!loading && !error && (
            <>
              {isSearchActive ? (
                /* ── Search results ── */
                <View style={styles.resultsContainer}>
                  {searchResults.length > 0 ? (
                    <>
                      <Text style={styles.resultsHeader}>
                        {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{searchQuery}"
                      </Text>
                      {searchResults.map((item) => (
                        <SearchResultCard key={item.id} item={item} />
                      ))}
                    </>
                  ) : (
                    <View style={styles.noResults}>
                      <Ionicons name="search-outline" size={40} color={C.textMuted} />
                      <Text style={styles.noResultsText}>No offices found for "{searchQuery}"</Text>
                      <Text style={styles.noResultsSub}>Try a different city or office name</Text>
                    </View>
                  )}
                </View>
              ) : (
                /* ── Normal home content ── */
                <>
                  {/* ── Inline map card ── */}
                  <View style={styles.mapSection}>
                    <Text style={styles.mapLabel}>Locations:</Text>
                    <TouchableOpacity activeOpacity={0.95} onPress={() => setMapFullscreen(true)}>
                      <BlurView intensity={40} tint="light" style={styles.mapBlur}>
                        <View style={styles.mapInner}>
                          <MapView
                            style={styles.map}
                            provider={PROVIDER_DEFAULT}
                            initialRegion={DEFAULT_REGION}
                            customMapStyle={lightMapStyle}
                            scrollEnabled={false}
                            zoomEnabled={false}
                            rotateEnabled={false}
                            pitchEnabled={false}
                          >
                            <OfficeMapMarkers markers={officeMarkers} />
                          </MapView>

                          <View style={styles.expandHint}>
                            <BlurView intensity={65} tint="light" style={StyleSheet.absoluteFill} />
                            <Ionicons name="expand-outline" size={13} color={C.text} style={{ marginRight: 4 }} />
                            <Text style={styles.expandHintText}>Tap to explore</Text>
                          </View>
                        </View>
                      </BlurView>
                    </TouchableOpacity>
                  </View>

                  {/* ── Carousels ── */}
                  <SectionCarousel
                    title="Cluj-Napoca:"
                    data={clujLocations}
                    onSeeAll={() => {}}
                  />
                  <SectionCarousel
                    title="Bucharest:"
                    data={bucharestLocations}
                    onSeeAll={() => {}}
                  />
                  {otherLocations.length > 0 && (
                    <SectionCarousel
                      title="Other Cities:"
                      data={otherLocations}
                      onSeeAll={() => {}}
                    />
                  )}
                </>
              )}
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Fullscreen interactive map ── */}
      <FullscreenMap
        visible={mapFullscreen}
        onClose={() => setMapFullscreen(false)}
        markers={officeMarkers}
      />
    </ImageBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  bgImage: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  safe: { flex: 1 },

  // Loading / error states
  centeredState: {
    alignItems: "center",
    paddingVertical: 80,
    gap: 10,
  },
  centeredStateText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.text,
    textAlign: "center",
  },
  centeredStateSub: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
    paddingHorizontal: 24,
  },

  // Home search
  searchWrapper: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  searchBlur: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.glassBg,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  searchInnerFocused: {
    borderColor: C.accent,
    backgroundColor: C.glassBgStrong,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: C.text,
    letterSpacing: 0.2,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 8 },

  // Inline map
  mapSection: {
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
  },
  mapLabel: {
    fontSize: 17,
    fontWeight: "700",
    color: C.text,
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  mapBlur: {
    borderRadius: 18,
    overflow: "hidden",
    height: 185,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  mapInner: {
    flex: 1,
    backgroundColor: C.glassBg,
    borderRadius: 18,
    overflow: "hidden",
  },
  map: { width: "100%", height: "100%" },

  // Expand hint
  expandHint: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  expandHintText: {
    fontSize: 11,
    color: C.text,
    fontWeight: "600",
    letterSpacing: 0.2,
  },

  // Office markers
  markerOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.accentLight,
    borderWidth: 2,
    borderColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  markerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.accent,
  },

  // Searched location pin
  searchedMarkerOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 59, 92, 0.18)",
    borderWidth: 2.5,
    borderColor: C.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  searchedMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.danger,
  },

  // Fullscreen modal
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#e8ecf0",
  },

  // Top bar (search + close)
  fullscreenTopBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mapSearchBlur: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.glassBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  mapSearchInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.glassBgStrong,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 9,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    letterSpacing: 0.2,
  },

  // Close button
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.glassBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },

  // Suggestions dropdown
  suggestionsBox: {
    position: "absolute",
    left: 16,
    right: 16 + 44 + 10,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.glassBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  suggestionsInner: {
    backgroundColor: C.glassBgSolid,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: C.text,
    lineHeight: 18,
  },

  // Error
  errorBox: {
    position: "absolute",
    left: 16,
    right: 16 + 44 + 10,
    borderRadius: 12,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 59, 92, 0.25)",
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: C.danger,
    fontWeight: "500",
  },

  // My location button
  myLocationBtn: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.glassBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },

  // Sections
  section: { marginTop: 22 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.text,
    letterSpacing: 0.3,
  },
  seeAll: {
    fontSize: 13,
    color: C.accent,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  carouselContent: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },

  // Cards
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  cardImg: {
    width: "100%",
    height: CARD_WIDTH * 0.72,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(180, 200, 255, 0.10)",
  },
  cardImgIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.40)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardImgEmoji: { fontSize: 22 },
  cardBody: {
    padding: 10,
    gap: 2,
    backgroundColor: C.glassBgStrong,
  },
  cardName: {
    fontSize: 13,
    fontWeight: "700",
    color: C.text,
    letterSpacing: 0.2,
  },
  cardCity: {
    fontSize: 11,
    color: C.textSub,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  cardAmenity: {
    fontSize: 10,
    color: C.accent,
    fontWeight: "600",
  },
  cardBorderRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },

  // Search results list
  resultsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  resultsHeader: {
    fontSize: 13,
    color: C.textMuted,
    fontWeight: "500",
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  resultCard: {
    flexDirection: "row",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    minHeight: 110,
    position: "relative",
  },
  resultCardBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  resultCardImg: {
    width: 120,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(180,200,255,0.12)",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: C.glassBorder,
  },
  resultCardBody: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  resultCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 6,
  },
  resultCardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#1a2a6c",
    letterSpacing: 0.2,
  },
  resultCardCity: {
    fontSize: 12,
    color: C.textSub,
    marginTop: 2,
  },
  resultCardAddress: {
    fontSize: 11,
    color: C.textMuted,
    marginTop: 2,
  },
  resultCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 4,
  },
  amenityPill: {
    backgroundColor: C.accentLight,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  amenityPillText: {
    fontSize: 10,
    color: C.accent,
    fontWeight: "600",
  },
  amenityMore: {
    fontSize: 10,
    color: C.textMuted,
    fontWeight: "600",
    alignSelf: "center",
  },
  resultCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },

  // No results
  noResults: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  noResultsText: {
    fontSize: 15,
    fontWeight: "600",
    color: C.text,
    textAlign: "center",
  },
  noResultsSub: {
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
  },
});

// ─── Light map style ──────────────────────────────────────────────────────────

const lightMapStyle = [
  { elementType: "geometry",               stylers: [{ color: "#eef2ff" }] },
  { elementType: "labels.text.fill",       stylers: [{ color: "#4a5568" }] },
  { elementType: "labels.text.stroke",     stylers: [{ color: "#ffffff" }] },
  { featureType: "road",         elementType: "geometry",  stylers: [{ color: "#d6e0ff" }] },
  { featureType: "road.highway", elementType: "geometry",  stylers: [{ color: "#b3c5ff" }] },
  { featureType: "water",        elementType: "geometry",  stylers: [{ color: "#c8d8f0" }] },
  { featureType: "poi",          elementType: "labels",    stylers: [{ visibility: "off"  }] },
  { featureType: "transit",                                stylers: [{ visibility: "off"  }] },
];
