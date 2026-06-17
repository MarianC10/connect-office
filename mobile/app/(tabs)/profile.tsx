import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
  AntDesign,
} from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { UserAvatar } from '@/components/user-avatar';
import { resolveDisplayName } from '@/lib/display-name';
import { fetchMe } from '@/lib/profile';

type ProfileUser = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

export default function ProfileScreen() {
  const router = useRouter();

  const [user, setUser] = useState<ProfileUser>({
    name: 'User',
    email: '',
    avatarUrl: null,
  });

  const [loading, setLoading] = useState(true);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);

  const loadProfile = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const currentUser = session?.user;

    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      const me = await fetchMe();
      setUser({
        name: resolveDisplayName(me.display_name, currentUser.user_metadata),
        email: me.email ?? currentUser.email ?? '',
        avatarUrl: me.avatar_url,
      });
      setAvatarRefreshKey((key) => key + 1);
    } catch {
      setUser({
        name: 'User',
        email: currentUser.email ?? '',
        avatarUrl: null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const MenuItem = ({
    icon,
    label,
    onPress,
  }: {
    icon: React.ReactNode;
    label: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={styles.menuText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={{
        uri: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72',
      }}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {/* Profile Card */}
          <TouchableOpacity
            style={styles.profileCard}
            activeOpacity={0.85}
          >
            <View style={styles.avatar}>
              <UserAvatar
                key={avatarRefreshKey}
                uri={user.avatarUrl}
                size={68}
              />
            </View>

            <View style={styles.userInfo}>
              {loading ? (
                <ActivityIndicator color="#333" />
              ) : (
                <>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* Section 1 */}
          <View style={styles.section}>
            <MenuItem
              icon={<Feather name="edit-2" size={22} color="#333" />}
              label="Edit Profile"
              onPress={() => router.push('/profile/edit')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={<Feather name="lock" size={22} color="#333" />}
              label="Change Password"
              onPress={() => router.push('/profile/change_password')}
            />
          </View>

          {/* Section 2 */}
          <View style={styles.section}>
            <MenuItem
              icon={
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color="#333"
                />
              }
              label="Notifications"
              onPress={() => router.push('/profile/notifications')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={<Feather name="calendar" size={22} color="#333" />}
              label="All bookings"
              onPress={() => router.push('/profile/bookings')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={
                <MaterialCommunityIcons
                  name="tune-variant"
                  size={22}
                  color="#333"
                />
              }
              label="Preferences"
              // onPress={() => router.push('/profile/preferences')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={<Feather name="credit-card" size={22} color="#333" />}
              label="Subscription"
              onPress={() => router.push('/profile/subscription')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={<AntDesign name="poweroff" size={20} color="#333" />}
              label="LogOut"
              onPress={handleLogout}
            />
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    justifyContent: 'center',
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 217, 217, 0.9)',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    alignSelf: 'center',
    width: '95%',
  },

  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },

  userInfo: {
    flex: 1,
  },

  userName: {
    fontSize: 34,
    fontWeight: '700',
    color: '#222',
    fontFamily: 'serif',
  },

  userEmail: {
    fontSize: 16,
    color: '#444',
    marginTop: -2,
  },

  section: {
    backgroundColor: 'rgba(217, 217, 217, 0.9)',
    borderRadius: 18,
    marginBottom: 16,
    paddingVertical: 6,
    alignSelf: 'center',
    width: '95%',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 18,
  },

  menuIcon: {
    width: 28,
    alignItems: 'center',
    marginRight: 14,
  },

  menuText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    fontFamily: 'serif',
  },

  separator: {
    height: 1,
    backgroundColor: '#c2c2c2',
    marginHorizontal: 18,
  },
});