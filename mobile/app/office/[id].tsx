import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAccessToken } from '@/lib/api';
import { API_BASE_URL } from '@/lib/env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Amenity = {
  name: string;
  category: string;
};

type LocationImage = {
  id: string;
  url: string;
};

type OfficeLocation = {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  county: string;
  country: string;
  latitude: number;
  longitude: number;
  images: LocationImage[];
  amenities: Amenity[];
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getStaticFilesBaseUrl() {
  return API_BASE_URL.replace(/\/$/, '').replace(/:\d+$/, ':8082');
}

function normalizeImageUrl(url?: string | null) {
  if (!url) return null;

  const staticFilesBaseUrl = getStaticFilesBaseUrl();

  return url
    .replace(/^http:\/\/localhost:8082/i, staticFilesBaseUrl)
    .replace(/^http:\/\/127\.0\.0\.1:8082/i, staticFilesBaseUrl)
    .replace(/^http:\/\/10\.0\.2\.2:8082/i, staticFilesBaseUrl);
}

function makeDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function makeDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);

  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function isDateAvailable(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentDate = new Date(date);
  currentDate.setHours(0, 0, 0, 0);

  const isPast = currentDate < today;
  const isSunday = currentDate.getDay() === 0;

  return !isPast && !isSunday;
}

function getAmenityIcon(name: string) {
  const lower = name.toLowerCase();

  if (
    lower.includes('wi') ||
    lower.includes('internet') ||
    lower.includes('fiber')
  ) {
    return <Ionicons name="wifi" size={22} color="#000" />;
  }

  if (lower.includes('coffee') || lower.includes('tea')) {
    return (
      <MaterialCommunityIcons
        name="coffee-outline"
        size={23}
        color="#000"
      />
    );
  }

  if (lower.includes('parking')) {
    return (
      <MaterialCommunityIcons name="car-outline" size={23} color="#000" />
    );
  }

  if (lower.includes('meeting')) {
    return (
      <MaterialCommunityIcons
        name="account-group-outline"
        size={23}
        color="#000"
      />
    );
  }

  if (lower.includes('desk') || lower.includes('workspace')) {
    return <MaterialCommunityIcons name="desk" size={23} color="#000" />;
  }

  return <Feather name="check-circle" size={21} color="#000" />;
}

export default function OfficeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const locationId = Array.isArray(id) ? id[0] : id;

  const [office, setOffice] = useState<OfficeLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [bookingVisible, setBookingVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadOffice = async () => {
      try {
        const token = await getAccessToken();

        const response = await fetch(`${API_BASE_URL}/locations/${locationId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Server error: HTTP ${response.status}`);
        }

        const data = (await response.json()) as OfficeLocation;

        if (!cancelled) {
          setOffice(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load office.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (locationId) {
      void loadOffice();
    }

    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const imageUrls = useMemo(() => {
    if (!office?.images) return [];

    return office.images
      .map((image) => normalizeImageUrl(image.url))
      .filter(Boolean) as string[];
  }, [office]);

  const handleShareOffice = async () => {
    if (!office) return;

    const mainImageUrl = imageUrls[0];

    const shareMessage = [
      `Check out this office: ${office.name}`,
      '',
      `Address: ${office.address}`,
      `City: ${office.city}`,
      '',
      office.description,
      mainImageUrl ? `\nPhoto: ${mainImageUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Share.share({
        title: office.name,
        message: shareMessage,
      });
    } catch {
      Alert.alert('Error', 'Could not open share options.');
    }
  };

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: (Date | null)[] = [];

    for (let i = 0; i < firstDay.getDay(); i += 1) {
      days.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      days.push(new Date(year, month, day));
    }

    return days;
  }, [calendarMonth]);

  const sortedSelectedDates = useMemo(() => {
    return [...selectedDates].sort();
  }, [selectedDates]);

  const toggleDate = (date: Date) => {
    if (!isDateAvailable(date)) return;

    const dateKey = makeDateKey(date);

    setSelectedDates((currentDates) => {
      if (currentDates.includes(dateKey)) {
        return currentDates.filter((item) => item !== dateKey);
      }

      return [...currentDates, dateKey];
    });
  };

  const goToPreviousMonth = () => {
    setCalendarMonth((current) => {
      return new Date(current.getFullYear(), current.getMonth() - 1, 1);
    });
  };

  const goToNextMonth = () => {
    setCalendarMonth((current) => {
      return new Date(current.getFullYear(), current.getMonth() + 1, 1);
    });
  };

  const handleConfirmBooking = () => {
    if (selectedDates.length === 0) {
      Alert.alert('No date selected', 'Please select at least one day.');
      return;
    }

    const selectedDatesText = sortedSelectedDates
      .map((dateKey) => makeDateLabel(dateKey))
      .join(', ');

    Alert.alert(
      'Booking selected',
      `Selected days: ${selectedDatesText}\n\nLater, this will be saved in the backend.`,
      [
        {
          text: 'OK',
          onPress: () => {
            setBookingVisible(false);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E2A5E" />
        </View>
      </View>
    );
  }

  if (error || !office) {
    return (
      <View style={styles.screen}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error || 'Office not found.'}</Text>

          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => router.back()}
          >
            <Text style={styles.errorButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.pageContent}
        >
          <View style={styles.topImageCard}>
            {imageUrls.length > 0 ? (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(event) => {
                    const index = Math.round(
                      event.nativeEvent.contentOffset.x / SCREEN_WIDTH
                    );
                    setActiveImageIndex(index);
                  }}
                >
                  {imageUrls.map((url) => (
                    <Image
                      key={url}
                      source={{ uri: url }}
                      style={styles.officeImage}
                    />
                  ))}
                </ScrollView>

                {imageUrls.length > 1 && (
                  <View style={styles.imageDots}>
                    {imageUrls.map((url, index) => (
                      <View
                        key={url}
                        style={[
                          styles.imageDot,
                          index === activeImageIndex && styles.imageDotActive,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Feather name="briefcase" size={56} color="#fff" />
              </View>
            )}

            <TouchableOpacity
              style={styles.backIcon}
              onPress={() => router.back()}
            >
              <Ionicons
                name="arrow-back-circle-outline"
                size={29}
                color="#000"
              />
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareIcon} onPress={handleShareOffice}>
              <Feather name="upload" size={23} color="#000" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.heartIcon}>
              <Ionicons name="heart-outline" size={29} color="#1E2A5E" />
            </TouchableOpacity>
          </View>

          <View style={styles.detailsCard}>
            <Text style={styles.officeName}>{office.name}</Text>

            <Text style={styles.addressText} numberOfLines={2}>
              adresa: {office.address}
            </Text>

            <View style={styles.line} />

            <View style={styles.infoRow}>
              <Feather name="map-pin" size={23} color="#000" />
              <Text style={styles.infoText}>{office.city}</Text>
            </View>

            {(office.amenities ?? []).slice(0, 4).map((amenity) => (
              <View key={amenity.name} style={styles.infoRow}>
                {getAmenityIcon(amenity.name)}
                <Text style={styles.infoText}>{amenity.name}</Text>
              </View>
            ))}

            <Text style={styles.descriptionTitle}>Description:</Text>

            <Text style={styles.descriptionText}>{office.description}</Text>

            <View style={styles.bookingBar}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.bookButton}
                onPress={() => setBookingVisible(true)}
              >
                <Text style={styles.bookButtonText}>book</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={bookingVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBookingVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bookingModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select booking days</Text>

              <TouchableOpacity onPress={() => setBookingVisible(false)}>
                <Ionicons name="close" size={26} color="#222" />
              </TouchableOpacity>
            </View>

            <View style={styles.monthHeader}>
              <TouchableOpacity
                onPress={goToPreviousMonth}
                style={styles.monthButton}
              >
                <Ionicons name="chevron-back" size={22} color="#1E2A5E" />
              </TouchableOpacity>

              <Text style={styles.monthTitle}>
                {MONTH_NAMES[calendarMonth.getMonth()]}{' '}
                {calendarMonth.getFullYear()}
              </Text>

              <TouchableOpacity
                onPress={goToNextMonth}
                style={styles.monthButton}
              >
                <Ionicons name="chevron-forward" size={22} color="#1E2A5E" />
              </TouchableOpacity>
            </View>

            <Text style={styles.calendarHint}>
              Available days are normal. Unavailable days are translucent.
            </Text>

            <View style={styles.weekRow}>
              {WEEK_DAYS.map((day) => (
                <Text key={day} style={styles.weekDayText}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const dateKey = makeDateKey(date);
                const selected = selectedDates.includes(dateKey);
                const available = isDateAvailable(date);

                return (
                  <TouchableOpacity
                    key={dateKey}
                    style={[
                      styles.dayCell,
                      styles.dayButton,
                      selected && styles.daySelected,
                      !available && styles.dayUnavailable,
                    ]}
                    disabled={!available}
                    onPress={() => toggleDate(date)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.dayTextSelected,
                        !available && styles.dayTextUnavailable,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {sortedSelectedDates.length > 0 && (
              <View style={styles.selectedDaysBox}>
                <Text style={styles.selectedDaysTitle}>Selected days:</Text>

                {sortedSelectedDates.map((dateKey) => (
                  <Text key={dateKey} style={styles.selectedDayText}>
                    {makeDateLabel(dateKey)}
                  </Text>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.confirmBookingButton}
              onPress={handleConfirmBooking}
            >
              <Text style={styles.confirmBookingText}>Confirm selection</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'rgba(217,217,217,0.97)',
  },

  safe: {
    flex: 1,
  },

  pageContent: {
    flexGrow: 1,
    backgroundColor: 'rgba(217,217,217,0.97)',
  },

  topImageCard: {
    width: '100%',
    height: 292,
    overflow: 'hidden',
    backgroundColor: '#bcbcbc',
  },

  officeImage: {
    width: SCREEN_WIDTH,
    height: 292,
  },

  imagePlaceholder: {
    flex: 1,
    backgroundColor: '#9c9c9c',
    alignItems: 'center',
    justifyContent: 'center',
  },

  imageDots: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },

  imageDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },

  imageDotActive: {
    width: 17,
    backgroundColor: '#fff',
  },

  backIcon: {
    position: 'absolute',
    top: 10,
    left: 9,
  },

  shareIcon: {
    position: 'absolute',
    top: 11,
    right: 52,
  },

  heartIcon: {
    position: 'absolute',
    top: 8,
    right: 12,
  },

  detailsCard: {
    width: '100%',
    flexGrow: 1,
    backgroundColor: 'rgba(217,217,217,0.97)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 32,
    paddingTop: 8,
    paddingBottom: 16,
    marginTop: -8,
  },

  officeName: {
    fontSize: 25,
    fontWeight: '800',
    color: '#000',
    fontFamily: 'serif',
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  addressText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'serif',
    textAlign: 'center',
    marginTop: 4,
  },

  line: {
    height: 1,
    backgroundColor: '#f2f2f2',
    marginTop: 7,
    marginBottom: 13,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  infoText: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'serif',
    color: '#000',
    marginLeft: 12,
  },

  descriptionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
    fontFamily: 'serif',
    marginTop: 2,
    marginBottom: 7,
  },

  descriptionText: {
    fontSize: 16,
    color: '#555',
    fontFamily: 'serif',
    lineHeight: 22,
    paddingHorizontal: 15,
    marginBottom: 18,
  },

  bookingBar: {
    height: 47,
    borderRadius: 14,
    backgroundColor: 'rgba(170,170,170,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  bookButton: {
    minWidth: 150,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(245,245,245,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bookButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'serif',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  errorText: {
    color: '#1E2A5E',
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 16,
  },

  errorButton: {
    backgroundColor: '#1E2A5E',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 18,
  },

  errorButtonText: {
    color: '#fff',
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'flex-end',
  },

  bookingModal: {
    backgroundColor: 'rgba(235,235,235,0.98)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#222',
    fontFamily: 'serif',
  },

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  monthButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  monthTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E2A5E',
    fontFamily: 'serif',
  },

  calendarHint: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'serif',
  },

  weekRow: {
    flexDirection: 'row',
    marginBottom: 7,
  },

  weekDayText: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    color: '#555',
    fontSize: 12,
    fontWeight: '700',
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  dayCell: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },

  dayButton: {
    borderRadius: 18,
  },

  daySelected: {
    backgroundColor: '#1E2A5E',
  },

  dayUnavailable: {
    opacity: 0.25,
  },

  dayText: {
    color: '#222',
    fontSize: 15,
    fontWeight: '700',
  },

  dayTextSelected: {
    color: '#fff',
  },

  dayTextUnavailable: {
    color: '#777',
  },

  selectedDaysBox: {
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },

  selectedDaysTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#222',
    fontFamily: 'serif',
    marginBottom: 6,
  },

  selectedDayText: {
    fontSize: 14,
    color: '#444',
    fontWeight: '600',
    marginBottom: 3,
  },

  confirmBookingButton: {
    backgroundColor: '#1E2A5E',
    borderRadius: 22,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },

  confirmBookingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'serif',
  },
});
