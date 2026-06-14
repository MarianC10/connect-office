import React, { useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type BookingItem = {
  id: string;
  officeName: string;
  description: string;
  rentedDate: string;
  rating: number;
  imageUrl: string;
  isFavorite: boolean;
};

export default function AllBookingsScreen() {
  const router = useRouter();

  /**
   * Leave this empty for now until you have real bookings from the backend.
   */
  const [bookings] = useState<BookingItem[]>([]);


  const sortedBookings = useMemo(() => {
    return [...bookings];
  }, [bookings]);

  return (
    <ImageBackground
      source={require('@/assets/images/login_signup_background.jpg')}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay}>
        <View style={styles.screen}>
          {/* Header */}
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

          {/* Main content */}
          <View style={styles.contentCard}>
            {sortedBookings.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No bookings yet</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.bookingsList}
              >
                {sortedBookings.map((booking) => (
                  <TouchableOpacity
                    key={booking.id}
                    style={styles.bookingCard}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: booking.imageUrl }}
                      style={styles.bookingImage}
                      resizeMode="cover"
                    />

                    <View style={styles.bookingInfo}>
                      <View style={styles.bookingTopRow}>
                        <View style={styles.titleBlock}>
                          <Text style={styles.officeName} numberOfLines={1}>
                            {booking.officeName}
                          </Text>

                          <Text style={styles.description} numberOfLines={1}>
                            {booking.description}
                          </Text>
                        </View>

                        <TouchableOpacity activeOpacity={0.7}>
                          <Ionicons
                            name={
                              booking.isFavorite ? 'heart' : 'heart-outline'
                            }
                            size={25}
                            color="#4a4a4a"
                          />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.bookingBottomRow}>
                        <Text style={styles.dateText} numberOfLines={1}>
                          Date: {booking.rentedDate}
                        </Text>

                        <View style={styles.ratingWrap}>
                          <Ionicons name="star" size={14} color="#ffffff" />
                          <Text style={styles.ratingText}>
                            {booking.rating.toFixed(1)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
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
    paddingTop: 22,
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
    color: '#ffffff',
    fontWeight: '700',
    marginTop: -2,
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

  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  ratingText: {
    fontSize: 13,
    color: '#222',
    fontWeight: '700',
    marginLeft: 5,
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