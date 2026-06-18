import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import {
  Booking,
  cancelBooking,
  formatBookingDateLabel,
  listBookings,
} from '@/lib/bookings';

export default function AllBookingsScreen() {
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadBookings = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const items = await listBookings();
      setBookings(items);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not load bookings.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const openOffice = (locationId: string) => {
    router.push({
      pathname: '/office/[id]',
      params: { id: locationId },
    });
  };

  const handleCancel = (booking: Booking) => {
    Alert.alert(
      'Cancel booking',
      `Cancel your booking at ${booking.location.name} on ${formatBookingDateLabel(booking.booking_date)}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(booking.id);
            try {
              await cancelBooking(booking.id);
              setBookings((current) =>
                current.filter((item) => item.id !== booking.id)
              );
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : 'Could not cancel booking.'
              );
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <ImageBackground
      source={require('@/assets/images/login_signup_background.jpg')}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay}>
        <View style={styles.screen}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.headerCard}
            onPress={() => router.back()}
          >
            <Feather
              name="calendar"
              size={27}
              color="#2f2f2f"
              style={styles.headerIcon}
            />
            <Text style={styles.headerTitle}>All Bookings</Text>
          </TouchableOpacity>

          <View style={styles.contentCard}>
            {loading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color="#1E2A5E" />
              </View>
            ) : bookings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No bookings yet</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.bookingsList}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => void loadBookings(true)}
                  />
                }
              >
                {bookings.map((booking) => {
                  const imageUrl = booking.location.image_url;
                  const isCancelling = cancellingId === booking.id;

                  return (
                    <TouchableOpacity
                      key={booking.id}
                      style={styles.bookingCard}
                      activeOpacity={0.8}
                      onPress={() => openOffice(booking.location.id)}
                    >
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.bookingImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.bookingImage, styles.imagePlaceholder]}>
                          <Feather name="briefcase" size={28} color="#888" />
                        </View>
                      )}

                      <View style={styles.bookingInfo}>
                        <View style={styles.bookingTopRow}>
                          <View style={styles.titleBlock}>
                            <Text style={styles.officeName} numberOfLines={1}>
                              {booking.location.name}
                            </Text>
                            <Text style={styles.description} numberOfLines={1}>
                              {booking.location.city}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.bookingBottomRow}>
                          <Text style={styles.dateText} numberOfLines={2}>
                            {formatBookingDateLabel(booking.booking_date)}
                          </Text>

                          <TouchableOpacity
                            activeOpacity={0.7}
                            style={styles.cancelButton}
                            disabled={isCancelling}
                            onPress={() => handleCancel(booking)}
                          >
                            {isCancelling ? (
                              <ActivityIndicator size="small" color="#1E2A5E" />
                            ) : (
                              <>
                                <Ionicons
                                  name="close-circle-outline"
                                  size={16}
                                  color="#1E2A5E"
                                />
                                <Text style={styles.cancelText}>Cancel</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
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
  },

  backgroundImage: {
    opacity: 0.28,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  screen: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 18,
    paddingBottom: 22,
  },

  headerCard: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'rgba(217,217,217,0.95)',
    borderRadius: 20,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  headerIcon: {
    marginRight: 12,
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    fontFamily: 'serif',
  },

  contentCard: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'rgba(217,217,217,0.72)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  bookingsList: {
    paddingBottom: 10,
  },

  bookingCard: {
    width: '100%',
    minHeight: 122,
    flexDirection: 'row',
    backgroundColor: 'rgba(217,217,217,0.95)',
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
  },

  bookingImage: {
    width: 116,
    height: 102,
    borderRadius: 10,
    backgroundColor: '#cfcfcf',
    alignItems: 'center',
    justifyContent: 'center',
  },

  imagePlaceholder: {
    backgroundColor: '#d8d8d8',
  },

  bookingInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between',
  },

  bookingTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  titleBlock: {
    flex: 1,
    paddingRight: 8,
  },

  officeName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E2A5E',
    fontFamily: 'serif',
  },

  description: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
    marginTop: 2,
    fontFamily: 'serif',
  },

  bookingBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  dateText: {
    flex: 1,
    fontSize: 13,
    color: '#222',
    fontWeight: '700',
    fontFamily: 'serif',
    marginRight: 8,
  },

  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  cancelText: {
    fontSize: 13,
    color: '#1E2A5E',
    fontWeight: '700',
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
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'serif',
    lineHeight: 38,
  },
});
