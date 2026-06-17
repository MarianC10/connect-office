import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { getAccessToken } from '@/lib/api';
import { API_BASE_URL } from '@/lib/env';
import { BlurView } from 'expo-blur';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BG_IMAGE = require('@/assets/images/login_signup_background.jpg');

type LocationImage = {
  id: string;
  url: string;
};

type Amenity = {
  name: string;
  category: string;
};

type Location = {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  county: string;
  country: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  images: LocationImage[];
  amenities: Amenity[];
};

function getLocationMainImage(location: Location) {
  return location.images?.[0]?.url ?? null;
}

export default function FavouritesScreen() {
  const router = useRouter();

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const loadLocations = async () => {
      try {
        const token = await getAccessToken();

        const response = await fetch(`${API_BASE_URL}/locations`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Server error: HTTP ${response.status}`);
        }

        const data = (await response.json()) as Location[];

        if (!cancelled) {
          setLocations(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load locations.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadLocations();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ImageBackground
      source={BG_IMAGE}
      style={styles.background}
      resizeMode="cover"
      blurRadius={1.2}
    >
      <View style={styles.overlay} />

      <View style={styles.contentWrapper}>
        <View style={styles.screen}>
          {/* Header */}
          <View style={styles.headerCard}>
            <Ionicons
              name="heart-outline"
              size={30}
              color="#111"
              style={styles.headerIcon}
            />

            <Text style={styles.headerTitle}>Favorites</Text>
          </View>

          {/* Main content */}
          <View style={styles.contentCard}>
            {loading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color="#1E2A5E" />
                <Text style={styles.loadingText}>Loading locations...</Text>
              </View>
            ) : error ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Could not load locations</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : locations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No locations found</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.favouritesList}
              >
                {locations.map((item) => {
                  const imageUrl = getLocationMainImage(item);

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.8}
                      style={styles.favouriteCard}
                      onPress={() =>
                        router.push({
                          pathname: '/office/[id]',
                          params: { id: item.id },
                        } as never)
                      }
                    >
                        <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFill} />
                        <View style={styles.favouriteCardTint} />
                      {/* Image box */}
                      <View style={styles.favouriteImageBox}>
                        {imageUrl ? (
                          <Image
                            source={{ uri: imageUrl }}
                            style={styles.favouriteImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.imagePlaceholder}>
                            <Ionicons
                              name="business-outline"
                              size={36}
                              color="#555"
                            />
                          </View>
                        )}
                      </View>

                      {/* Info box */}
                      <View style={styles.favouriteInfoBox}>
                        <Text style={styles.favouriteName} numberOfLines={1}>
                          {item.name}
                        </Text>

                        <Text
                          style={styles.favouriteDescription}
                          numberOfLines={1}
                        >
                          {item.description || 'short description'}
                        </Text>

                        <View style={styles.bottomRow}>
                          <Text style={styles.priceText} numberOfLines={1}>
                            Price: 100 lei
                          </Text>

                          <View style={styles.ratingRow}>
                            <Ionicons name="star" size={14} color="#f2f2f2" />
                            <Text style={styles.ratingText}>4.5</Text>
                          </View>
                        </View>
                      </View>

                      {/* Heart box */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        style={styles.heartBox}
                        onPress={() => {
                          // later: remove from favourites
                        }}
                      >
                        <Ionicons
                          name="heart-outline"
                          size={26}
                          color="#4a4a4a"
                        />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },

  contentWrapper: {
    flex: 1,
  },

  screen: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 18,
    paddingBottom: 100,
  },

  headerCard: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'rgba(217,217,217,0.95)',
    borderRadius: 18,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  headerIcon: {
    marginRight: 8,
  },

  headerTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#222',
    fontFamily: 'serif',
  },

  contentCard: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 24,
  },

  favouritesList: {
    paddingBottom: 110,
  },

  favouriteCard: {
      height: 130,
    //   backgroundColor: 'rgba(255, 255, 255, 0.32)',
      borderRadius: 13,
      marginBottom: 12,
      padding: 8,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'hidden',
    },

    favouriteImageBox: {
      width: 130,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },

    favouriteInfoBox: {
      flex: 1,
      minWidth: 0,
      height: '100%',
      justifyContent: 'center',
      paddingLeft: 12,
      paddingRight: 4,
    },

    heartBox: {
      width: 34,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 4,
      flexShrink: 0,
    },
  

  favouriteImage: {
    width: 125,
    height: 110,
    borderRadius: 10,
  },

  imagePlaceholder: {
    width: 106,
    height: 88,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },


  favouriteName: {
    fontSize: 20,
    color: '#1E2A5E',
    fontWeight: '800',
    fontFamily: 'serif',
  },

  favouriteDescription: {
    fontSize: 14,
    color: '#f5f1ee',
    fontWeight: '700',
    fontFamily: 'serif',
    marginTop: 1,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 25,
  },

  priceText: {
    flex: 1,
    fontSize: 14,
    color: '#111',
    fontWeight: '700',
    fontFamily: 'serif',
    marginRight: 8,
  },

  favouriteCardTint: {
    ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255, 255, 255, 0.32)',
    },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  ratingText: {
    fontSize: 13,
    color: '#111',
    fontWeight: '700',
    fontFamily: 'serif',
  },


  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  emptyText: {
    textAlign: 'center',
    color: '#f5f1ee',
    fontSize: 26,
    fontWeight: '700',
    fontFamily: 'serif',
    lineHeight: 34,
  },

  loadingText: {
    marginTop: 12,
    color: '#f5f1ee',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'serif',
  },

  errorText: {
    marginTop: 8,
    color: '#f5f1ee',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'serif',
  },
});