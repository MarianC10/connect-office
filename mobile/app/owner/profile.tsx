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
    danger,
  }: {
    icon: React.ReactNode;
    label: string;
    onPress?: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={[styles.menuText, danger && styles.menuTextDanger]}>{label}</Text>
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
              icon={<MaterialCommunityIcons name="office-building-outline" size={22} color="#333" />}
              label="Company Information"
              onPress={() => router.push('/owner/company-information')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={<MaterialCommunityIcons name="map-marker-outline" size={22} color="#333" />}
              label="My Locations"
              onPress={() => router.push('/owner/locations')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={<Feather name="calendar" size={22} color="#333" />}
              label="Bookings"
              onPress={() => router.push('/owner/bookings')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={<Ionicons name="settings-outline" size={22} color="#333" />}
              label="Settings"
              onPress={() => router.push('/owner/owner-settings')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={<AntDesign name="poweroff" size={20} color="#132457" />}
              label="Log out"
              onPress={handleLogout}
              danger
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
    width: '85%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 30,
    padding: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
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
    color: '#000',
    fontFamily: 'serif',
  },

  menuTextDanger: {
    color: '#132457',
  },

  separator: {
    height: 1,
    backgroundColor: '#c2c2c2',
    marginHorizontal: 18,
  },
});