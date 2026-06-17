import React, { useMemo, useState } from 'react';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type NotificationItem = {
  id: string;
  text: string;
  read: boolean;
};

export default function NotificationsScreen() {
  const router = useRouter();

  /**
   * Leave this empty for now until you have backend notifications.
   */
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  //TESTING DATA WHEN NOTIFICATIONS EXIST
  //To test the design, comment the empty state above and uncomment this:

  // const [notifications, setNotifications] = useState<NotificationItem[]>([
  //    { id: '1', text: 'Booking confirmed for Cluj Office', read: false },
  //    { id: '2', text: 'Your subscription renews tomorrow', read: false },
  //    { id: '3', text: 'Payment received successfully', read: true },
  //    { id: '4', text: 'Your booking was updated', read: true },
  // ]);

  const markNotificationAsRead = (notificationId: string) => {
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => {
      if (a.read === b.read) return 0;
      return a.read ? 1 : -1;
    });
  }, [notifications]);

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
            <Ionicons
              name="notifications-outline"
              size={28}
              color="#2f2f2f"
              style={styles.headerIcon}
            />

            <Text style={styles.headerTitle}>Notifications</Text>
          </TouchableOpacity>

          {/* Main content */}
          <View style={styles.contentCard}>
            {sortedNotifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No notifications yet</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.notificationsList}
              >
                {sortedNotifications.map((item, index) => (
                  <View key={item.id}>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      style={styles.notificationRow}
                      onPress={() => markNotificationAsRead(item.id)}
                    >
                      <Text
                        style={[
                          styles.notificationText,
                          item.read
                            ? styles.readNotificationText
                            : styles.unreadNotificationText,
                        ]}
                      >
                        {item.text}
                      </Text>
                    </TouchableOpacity>

                    {index < sortedNotifications.length - 1 && (
                      <View style={styles.separator} />
                    )}
                  </View>
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
    backgroundColor: 'rgba(217,217,217,0.95)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  notificationsList: {
    paddingBottom: 10,
  },

  notificationRow: {
    paddingVertical: 12,
    paddingHorizontal: 6,
  },

  notificationText: {
    fontSize: 18,
    color: '#222',
    fontFamily: 'serif',
  },

  unreadNotificationText: {
    fontWeight: '700',
  },

  readNotificationText: {
    fontWeight: '400',
  },

  separator: {
    height: 1,
    backgroundColor: '#e6e6e6',
    marginHorizontal: 2,
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