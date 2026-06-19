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

import { authFetch } from '@/lib/api';
import {
  Booking,
  BookingConflictError,
  createBooking,
  formatBookingDateLabel,
  getBookingWindowDateKeys,
  getLocationAvailability,
  listBookings,
  LocationAvailability,
  todayInBucharest,
} from '@/lib/bookings';
import {
  CheckInConflictError,
  checkOut,
  createCheckIn,
  fetchMyCheckIns,
  formatWorkingHoursSummary,
  type MyCheckIns,
} from '@/lib/checkins';
import { fetchMySubscription, type MySubscription } from '@/lib/subscriptions';
import * as Location from 'expo-location';
import { UserAvatar } from '@/components/user-avatar';
import {
  fetchVisibleBookings,
  VisibleBookingPerson,
} from '@/lib/profile';
import { SOCIAL_ENABLED } from '@/lib/social-config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  capacity?: number;
  timezone?: string;
  weekday_open?: string;
  weekday_close?: string;
  weekend_open?: string;
  weekend_close?: string;
  images: LocationImage[];
  amenities: Amenity[];
};

function makeDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

type OfficePerson = VisibleBookingPerson;

function PersonList({
  people,
  emptyMessage,
  onPressPerson,
}: {
  people: OfficePerson[];
  emptyMessage: string;
  onPressPerson: (userId: string) => void;
}) {
  if (people.length === 0) {
    return <Text style={styles.peopleEmpty}>{emptyMessage}</Text>;
  }

  return (
    <>
      {people.map((person) => (
        <TouchableOpacity
          key={person.user_id}
          style={styles.personRow}
          onPress={() => onPressPerson(person.user_id)}
        >
          <UserAvatar uri={person.avatar_url} size={40} />
          <View style={styles.personText}>
            <Text style={styles.personName}>{person.display_name}</Text>
            <Text style={styles.personMeta}>
              {person.is_friend ? 'Friend' : 'Public profile'}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </>
  );
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

function availabilityBannerText(availability: LocationAvailability | null) {
  if (!availability) return null;

  if (availability.status === 'busy') {
    return 'This office is busy on this day — seating may be limited.';
  }

  if (availability.status === 'full') {
    return 'Fully booked for this day.';
  }

  return null;
}

export default function OfficeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const locationId = Array.isArray(id) ? id[0] : id;
  const bookingWindowSet = useMemo(
    () => new Set(getBookingWindowDateKeys()),
    []
  );

  const [office, setOffice] = useState<OfficeLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [bookingVisible, setBookingVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    parseDateKey(todayInBucharest())
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [userBookingsByDate, setUserBookingsByDate] = useState<
    Map<string, Booking>
  >(new Map());
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [availability, setAvailability] = useState<LocationAvailability | null>(
    null
  );
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [bookedPeople, setBookedPeople] = useState<VisibleBookingPerson[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleDate, setPeopleDate] = useState(() => todayInBucharest());

  const [subscription, setSubscription] = useState<MySubscription | null>(null);
  const [myCheckIns, setMyCheckIns] = useState<MyCheckIns | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInBusy, setCheckInBusy] = useState(false);

  const activeCheckIn = myCheckIns?.active ?? null;
  const activeAtThisOffice =
    activeCheckIn != null && activeCheckIn.location_id === locationId;
  const activeElsewhere =
    activeCheckIn != null && activeCheckIn.location_id !== locationId;

  useEffect(() => {
    let cancelled = false;

    const loadOffice = async () => {
      try {
        const response = await authFetch(`/locations/${locationId}`);

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

  useEffect(() => {
    if (!SOCIAL_ENABLED || !locationId) {
      setBookedPeople([]);
      return;
    }

    let cancelled = false;
    setPeopleLoading(true);

    const loadPeople = async () => {
      try {
        const booked = await fetchVisibleBookings(locationId, peopleDate);
        if (!cancelled) {
          setBookedPeople(booked);
        }
      } catch {
        if (!cancelled) {
          setBookedPeople([]);
        }
      } finally {
        if (!cancelled) {
          setPeopleLoading(false);
        }
      }
    };

    void loadPeople();

    return () => {
      cancelled = true;
    };
  }, [locationId, peopleDate]);

  useEffect(() => {
    if (!locationId) {
      setSubscription(null);
      setMyCheckIns(null);
      return;
    }

    let cancelled = false;

    const loadCheckInState = async () => {
      setCheckInLoading(true);
      try {
        const [sub, checkIns] = await Promise.all([
          fetchMySubscription(),
          fetchMyCheckIns(),
        ]);
        if (!cancelled) {
          setSubscription(sub);
          setMyCheckIns(checkIns);
        }
      } catch {
        if (!cancelled) {
          setSubscription(null);
          setMyCheckIns({ history: [] });
        }
      } finally {
        if (!cancelled) {
          setCheckInLoading(false);
        }
      }
    };

    void loadCheckInState();

    return () => {
      cancelled = true;
    };
  }, [locationId]);

  useEffect(() => {
    if (!bookingVisible || !selectedDate) {
      return;
    }
    setPeopleDate(selectedDate);
  }, [bookingVisible, selectedDate]);

  useEffect(() => {
    if (!bookingVisible) {
      return;
    }

    let cancelled = false;
    setBookingsLoading(true);

    const loadUserBookings = async () => {
      try {
        const bookings = await listBookings();
        if (cancelled) return;

        const byDate = new Map<string, Booking>();
        for (const booking of bookings) {
          byDate.set(booking.booking_date, booking);
        }
        setUserBookingsByDate(byDate);
      } catch (err) {
        if (!cancelled) {
          Alert.alert(
            'Error',
            err instanceof Error ? err.message : 'Could not load your bookings.'
          );
        }
      } finally {
        if (!cancelled) {
          setBookingsLoading(false);
        }
      }
    };

    void loadUserBookings();

    return () => {
      cancelled = true;
    };
  }, [bookingVisible]);

  useEffect(() => {
    if (!bookingVisible || !locationId || !selectedDate) {
      setAvailability(null);
      return;
    }

    if (userBookingsByDate.has(selectedDate)) {
      setAvailability(null);
      return;
    }

    let cancelled = false;
    setAvailabilityLoading(true);

    const loadAvailability = async () => {
      try {
        const data = await getLocationAvailability(locationId, selectedDate);
        if (!cancelled) {
          setAvailability(data);
        }
      } catch (err) {
        if (!cancelled) {
          setAvailability(null);
          Alert.alert(
            'Error',
            err instanceof Error ? err.message : 'Could not load availability.'
          );
        }
      } finally {
        if (!cancelled) {
          setAvailabilityLoading(false);
        }
      }
    };

    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [bookingVisible, locationId, selectedDate, userBookingsByDate]);

  const imageUrls = useMemo(() => {
    if (!office?.images) return [];

    return office.images.map((image) => image.url).filter(Boolean);
  }, [office]);

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

  const selectedUserBooking = selectedDate
    ? userBookingsByDate.get(selectedDate)
    : undefined;

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

  const closeBookingModal = () => {
    setBookingVisible(false);
    setPeopleDate(todayInBucharest());
  };

  const openBookingModal = () => {
    const todayKey = todayInBucharest();
    setCalendarMonth(parseDateKey(todayKey));
    setSelectedDate(todayKey);
    setAvailability(null);
    setBookingVisible(true);
  };

  const selectDate = (date: Date) => {
    const dateKey = makeDateKey(date);
    if (!bookingWindowSet.has(dateKey)) {
      return;
    }
    setSelectedDate(dateKey);
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

  const handleReserve = async () => {
    if (!locationId || !selectedDate) {
      Alert.alert('No date selected', 'Please select a day to book.');
      return;
    }

    if (userBookingsByDate.has(selectedDate)) {
      return;
    }

    if (availability?.status === 'full') {
      return;
    }

    setReserving(true);

    try {
      const booking = await createBooking({
        locationId,
        bookingDate: selectedDate,
      });

      setUserBookingsByDate((current) => {
        const next = new Map(current);
        next.set(booking.booking_date, booking);
        return next;
      });

      Alert.alert(
        'Booking confirmed',
        `Reserved ${office?.name ?? 'this office'} on ${formatBookingDateLabel(booking.booking_date)}.`,
        [
          {
            text: 'OK',
            onPress: () => closeBookingModal(),
          },
        ]
      );
    } catch (err) {
      if (err instanceof BookingConflictError) {
        if (err.reason === 'already_booked') {
          Alert.alert(
            'Already booked',
            'You already have a booking on this day. You can only book one office per day.'
          );
        } else if (err.reason === 'location_full') {
          Alert.alert(
            'Fully booked',
            'This office is fully booked for the selected day.'
          );
        } else {
          Alert.alert('Could not book', err.message);
        }
      } else {
        Alert.alert(
          'Error',
          err instanceof Error ? err.message : 'Could not create booking.'
        );
      }
    } finally {
      setReserving(false);
    }
  };

  const refreshCheckInState = async () => {
    const [sub, checkIns] = await Promise.all([
      fetchMySubscription(),
      fetchMyCheckIns(),
    ]);
    setSubscription(sub);
    setMyCheckIns(checkIns);
  };

  const handleCheckIn = async () => {
    if (!locationId || checkInBusy || activeElsewhere) {
      return;
    }

    setCheckInBusy(true);
    try {
      let coords: { latitude: number; longitude: number } | undefined;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.granted) {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        }
      } catch {
        // optional GPS — proceed without coordinates
      }

      const record = await createCheckIn(locationId, coords);
      setMyCheckIns((current) => ({
        active: record,
        history: current?.history ?? [],
      }));
      Alert.alert('Checked in', `You are checked in at ${office?.name ?? 'this office'}.`);
    } catch (err) {
      if (err instanceof CheckInConflictError) {
        Alert.alert('Cannot check in', err.message);
      } else {
        Alert.alert(
          'Check-in failed',
          err instanceof Error ? err.message : 'Could not check in.'
        );
      }
      await refreshCheckInState();
    } finally {
      setCheckInBusy(false);
    }
  };

  const handleCheckOut = async () => {
    if (!activeCheckIn || checkInBusy) {
      return;
    }

    setCheckInBusy(true);
    try {
      await checkOut(activeCheckIn.id);
      setMyCheckIns((current) => ({
        active: null,
        history: current?.history ?? [],
      }));
      Alert.alert('Checked out', 'You have checked out of this office.');
    } catch (err) {
      Alert.alert(
        'Check-out failed',
        err instanceof Error ? err.message : 'Could not check out.'
      );
      await refreshCheckInState();
    } finally {
      setCheckInBusy(false);
    }
  };

  const checkInDisabledReason = (() => {
    if (checkInLoading) {
      return null;
    }
    if (activeElsewhere && activeCheckIn) {
      return `Checked in at ${activeCheckIn.location_name ?? 'another office'}. Check out first.`;
    }
    if (!subscription) {
      return 'An active subscription is required to check in.';
    }
    if (subscription.status !== 'active') {
      return 'Your subscription is not active.';
    }
    if (
      subscription.plan_type === 'entrances_10' &&
      subscription.entrances_remaining === 0
    ) {
      return 'No entrances remaining on your subscription.';
    }
    if (
      (subscription.plan_type === 'monthly' || subscription.plan_type === 'yearly') &&
      subscription.expires_at &&
      new Date(subscription.expires_at).getTime() <= Date.now()
    ) {
      return 'Your subscription has expired.';
    }
    return null;
  })();

  const bannerText = selectedUserBooking
    ? selectedUserBooking.location.id === locationId
      ? `You already have a booking at ${office?.name ?? 'this office'} on this day.`
      : `You already have a booking at ${selectedUserBooking.location.name} on this day.`
    : availabilityBannerText(availability);

  const reserveDisabled =
    !selectedDate ||
    reserving ||
    bookingsLoading ||
    availabilityLoading ||
    !!selectedUserBooking ||
    availability?.status === 'full';

  const openUserProfile = (userId: string) => {
    router.push({
      pathname: '/users/[id]',
      params: { id: userId },
    } as never);
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
                  {imageUrls.map((url, index) => (
                    <Image
                      key={`${url}-${index}`}
                      source={{ uri: url }}
                      style={styles.officeImage}
                    />
                  ))}
                </ScrollView>

                {imageUrls.length > 1 && (
                  <View style={styles.imageDots}>
                    {imageUrls.map((url, index) => (
                      <View
                        key={`dot-${url}-${index}`}
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

            {SOCIAL_ENABLED && (
              <View style={styles.peopleSection}>
                <Text style={styles.peopleTitle}>
                  Booked · {formatBookingDateLabel(peopleDate)}
                </Text>
                <Text style={styles.peopleSubtitle}>
                  Friends and public profiles with a reservation for this day
                </Text>
                {peopleLoading ? (
                  <ActivityIndicator color="#1E2A5E" style={styles.peopleLoader} />
                ) : (
                  <PersonList
                    people={bookedPeople}
                    emptyMessage="No friends or public bookers for this day yet."
                    onPressPerson={openUserProfile}
                  />
                )}
              </View>
            )}

            {office && (
              <View style={styles.hoursSection}>
                <Text style={styles.hoursTitle}>Working hours</Text>
                <Text style={styles.hoursText}>
                  {formatWorkingHoursSummary(office)}
                </Text>
                {activeElsewhere && activeCheckIn && (
                  <Text style={styles.checkInHint}>
                    You are checked in at {activeCheckIn.location_name ?? 'another office'}.
                  </Text>
                )}
                {checkInDisabledReason && !activeAtThisOffice && (
                  <Text style={styles.checkInHint}>{checkInDisabledReason}</Text>
                )}
              </View>
            )}

            <View style={styles.bookingBar}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.bookButton}
                onPress={openBookingModal}
              >
                <Ionicons name="calendar-outline" size={18} color="#1E2A5E" />
                <Text style={styles.bookButtonText}>Book a day</Text>
              </TouchableOpacity>
              <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.checkInButton,
                    (checkInBusy ||
                      (!activeAtThisOffice &&
                        (checkInDisabledReason != null || checkInLoading))) &&
                      styles.checkInButtonDisabled,
                  ]}
                  disabled={
                    checkInBusy ||
                    checkInLoading ||
                    (!activeAtThisOffice && checkInDisabledReason != null)
                  }
                  onPress={activeAtThisOffice ? handleCheckOut : handleCheckIn}
                >
                  {checkInBusy ? (
                    <ActivityIndicator color="#1E2A5E" size="small" />
                  ) : (
                    <Text style={styles.checkInButtonText}>
                      {activeAtThisOffice ? 'Check out' : 'Check in'}
                    </Text>
                  )}
                </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={bookingVisible}
        animationType="slide"
        transparent
        onRequestClose={closeBookingModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bookingModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select booking day</Text>

              <TouchableOpacity onPress={closeBookingModal}>
                <Ionicons name="close" size={26} color="#222" />
              </TouchableOpacity>
            </View>

            <Text style={styles.calendarHint}>
              Bookable days are within the next 10 days (Europe/Bucharest).
              Days with a dot are already booked by you.
            </Text>

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
                const inWindow = bookingWindowSet.has(dateKey);
                const selected = selectedDate === dateKey;
                const userBooking = userBookingsByDate.get(dateKey);
                const bookedHere = userBooking?.location.id === locationId;

                return (
                  <TouchableOpacity
                    key={dateKey}
                    style={[
                      styles.dayCell,
                      styles.dayButton,
                      selected && styles.daySelected,
                      !inWindow && styles.dayUnavailable,
                      userBooking && styles.dayUserBooked,
                      bookedHere && styles.dayBookedHere,
                    ]}
                    disabled={!inWindow}
                    onPress={() => selectDate(date)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.dayTextSelected,
                        !inWindow && styles.dayTextUnavailable,
                        userBooking && !selected && styles.dayTextBooked,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    {userBooking && (
                      <View
                        style={[
                          styles.bookedDot,
                          bookedHere && styles.bookedDotHere,
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedDate && (
              <View style={styles.selectedDateBox}>
                <Text style={styles.selectedDateLabel}>
                  {formatBookingDateLabel(selectedDate)}
                </Text>
                {bookingsLoading || availabilityLoading ? (
                  <ActivityIndicator size="small" color="#1E2A5E" />
                ) : selectedUserBooking ? (
                  <Text style={styles.availabilityMeta}>
                    {selectedUserBooking.location.name}
                  </Text>
                ) : availability ? (
                  <Text style={styles.availabilityMeta}>
                    {availability.booked_count} / {availability.capacity} booked
                  </Text>
                ) : null}
              </View>
            )}

            {bannerText && (
              <View
                style={[
                  styles.banner,
                  (availability?.status === 'full' || selectedUserBooking) &&
                    styles.bannerFull,
                ]}
              >
                <Text style={styles.bannerText}>{bannerText}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.confirmBookingButton,
                reserveDisabled && styles.confirmBookingButtonDisabled,
              ]}
              disabled={reserveDisabled}
              onPress={() => void handleReserve()}
            >
              {reserving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmBookingText}>Reserve</Text>
              )}
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
    height: 340,
    overflow: 'hidden',
    backgroundColor: '#bcbcbc',
  },

  officeImage: {
    width: SCREEN_WIDTH,
    height: 340,
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
    top: 45,
    left: 9,
  },

  shareIcon: {
    position: 'absolute',
    top: 46,
    right: 52,
  },

  heartIcon: {
    position: 'absolute',
    top: 43,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 10,
  },

  bookButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(30, 42, 94, 0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1E2A5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },

  checkInButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#1E2A5E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E2A5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },

  checkInButtonDisabled: {
    opacity: 0.45,
  },

  checkInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'serif',
  },

  hoursSection: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  hoursTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E2A5E',
    fontFamily: 'serif',
    marginBottom: 4,
  },

  hoursText: {
    fontSize: 14,
    color: '#444',
    fontFamily: 'serif',
  },

  checkInHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#8a4b12',
    fontFamily: 'serif',
  },

  bookButtonText: {
    color: '#1E2A5E',
    fontSize: 16,
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

  calendarHint: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
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

  dayUserBooked: {
    backgroundColor: 'rgba(46, 125, 50, 0.18)',
  },

  dayBookedHere: {
    backgroundColor: 'rgba(46, 125, 50, 0.32)',
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

  dayTextBooked: {
    color: '#2e7d32',
  },

  bookedDot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#2e7d32',
  },

  bookedDotHere: {
    backgroundColor: '#1b5e20',
  },

  selectedDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },

  selectedDateLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#222',
    fontFamily: 'serif',
    flex: 1,
  },

  availabilityMeta: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
    maxWidth: '45%',
    textAlign: 'right',
  },

  banner: {
    backgroundColor: 'rgba(255, 193, 7, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },

  bannerFull: {
    backgroundColor: 'rgba(220, 53, 69, 0.18)',
  },

  bannerText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'serif',
  },

  confirmBookingButton: {
    backgroundColor: '#1E2A5E',
    borderRadius: 22,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },

  confirmBookingButtonDisabled: {
    opacity: 0.45,
  },

  confirmBookingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'serif',
  },

  peopleSection: {
    marginTop: 18,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(30, 42, 94, 0.06)',
  },

  peopleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E2A5E',
    marginBottom: 4,
    fontFamily: 'serif',
  },

  peopleSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontFamily: 'serif',
  },

  peopleLoader: {
    marginVertical: 8,
  },

  peopleEmpty: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'serif',
  },

  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },

  personText: {
    flex: 1,
  },

  personName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    fontFamily: 'serif',
  },

  personMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 1,
  },
});
