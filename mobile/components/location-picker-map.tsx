import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import {
  geocodeLocation,
  parseNominatimAddress,
  reverseGeocodeLocation,
  type MapCoordinate,
  type NominatimResult,
} from "@/lib/geocoding";

const DEFAULT_REGION: Region = {
  latitude: 46.77,
  longitude: 23.6,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

export type LocationPickerValue = MapCoordinate & {
  label?: string;
  address?: string;
  city?: string;
  county?: string;
  country?: string;
};

type LocationPickerMapProps = {
  value: LocationPickerValue | null;
  onChange: (value: LocationPickerValue) => void;
  height?: number;
};

export function LocationPickerMap({ value, onChange, height = 220 }: LocationPickerMapProps) {
  const mapRef = useRef<MapView>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolvingPin, setResolvingPin] = useState(false);
  const [searchError, setSearchError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animateTo = useCallback((coord: MapCoordinate, delta = 0.02) => {
    mapRef.current?.animateToRegion(
      {
        latitude: coord.latitude,
        longitude: coord.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      600
    );
  }, []);

  const applySelection = useCallback(
    (coord: MapCoordinate, parsed: ReturnType<typeof parseNominatimAddress>) => {
      onChange({
        latitude: coord.latitude,
        longitude: coord.longitude,
        label: parsed.label,
        address: parsed.address,
        city: parsed.city,
        county: parsed.county,
        country: parsed.country,
      });
      setQuery(parsed.label);
      setSuggestions([]);
      Keyboard.dismiss();
    },
    [onChange]
  );

  const selectResult = useCallback(
    (result: NominatimResult) => {
      const coord = {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
      };
      const parsed = parseNominatimAddress(result.display_name, result.address);
      applySelection(coord, parsed);
      animateTo(coord);
    },
    [animateTo, applySelection]
  );

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setSearchError("");
    if (!text.trim()) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await geocodeLocation(text);
        setSuggestions(results.slice(0, 5));
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleMapPress = async (e: { nativeEvent: { coordinate: MapCoordinate } }) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setResolvingPin(true);
    setSearchError("");
    try {
      const result = await reverseGeocodeLocation(latitude, longitude);
      const coord = {
        latitude: parseFloat(result.lat) || latitude,
        longitude: parseFloat(result.lon) || longitude,
      };
      const parsed = parseNominatimAddress(result.display_name, result.address);
      applySelection(coord, parsed);
      animateTo(coord);
    } catch {
      onChange({ latitude, longitude });
      setSearchError("Could not resolve address for this point. Fill in the fields below.");
    } finally {
      setResolvingPin(false);
    }
  };

  const initialRegion: Region = value
    ? {
        latitude: value.latitude,
        longitude: value.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : DEFAULT_REGION;

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#6f6f84" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search address on map"
          placeholderTextColor="#6f6f84"
          value={query}
          onChangeText={handleQueryChange}
          onSubmitEditing={async () => {
            if (!query.trim()) return;
            setSearching(true);
            setSearchError("");
            try {
              const results = await geocodeLocation(query);
              if (results.length === 0) {
                setSearchError("Location not found");
                return;
              }
              selectResult(results[0]);
            } catch {
              setSearchError("Search failed");
            } finally {
              setSearching(false);
            }
          }}
          returnKeyType="search"
        />
        {(searching || resolvingPin) && (
          <ActivityIndicator size="small" color="#132457" />
        )}
      </View>

      {searchError ? <Text style={styles.error}>{searchError}</Text> : null}

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((s) => (
            <TouchableOpacity
              key={`${s.place_id}-${s.lat}`}
              style={styles.suggestionItem}
              onPress={() => selectResult(s)}
            >
              <Text style={styles.suggestionText} numberOfLines={2}>
                {s.display_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View
        style={[styles.mapWrap, { height }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
      >
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={initialRegion}
          onPress={handleMapPress}
          scrollEnabled
          zoomEnabled
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {value && (
            <Marker coordinate={{ latitude: value.latitude, longitude: value.longitude }} />
          )}
        </MapView>
      </View>

      <Text style={styles.hint}>Pan, zoom, or tap the map to set the office location</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(217, 217, 217, 0.78)",
    borderRadius: 12,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#12122A",
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
  },
  error: {
    color: "#c0392b",
    fontSize: 13,
  },
  suggestions: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 10,
    overflow: "hidden",
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  suggestionText: {
    fontSize: 14,
    color: "#12122A",
  },
  mapWrap: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
  },
  hint: {
    fontSize: 12,
    color: "#6f6f84",
    textAlign: "center",
  },
});
