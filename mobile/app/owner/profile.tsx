import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import {
  Feather,
  MaterialCommunityIcons,
  AntDesign,
} from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';

import { OwnerBottomBar } from '@/components/owner-bottom-bar';
import { UserAvatar } from '@/components/user-avatar';
import { resolveDisplayName } from '@/lib/display-name';
import { fetchMe } from '@/lib/profile';
import { supabase } from '@/lib/supabase';

const BG_IMAGE = require('../../assets/images/login_signup_background.jpg');

type ProfileUser = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

export default function OwnerProfileScreen() {
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
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={[styles.menuText, danger && styles.menuTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ImageBackground source={BG_IMAGE} style={styles.background} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.phoneFrame}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <BlurView intensity={45} tint="light" style={styles.titleCard}>
              <MaterialCommunityIcons
                name="account-circle-outline"
                size={24}
                color="#1A1A1A"
                style={styles.titleIcon}
              />
              <Text style={styles.title}>Profile</Text>
            </BlurView>

            <BlurView intensity={45} tint="light" style={styles.profileCard}>
              <View style={styles.avatar}>
                <UserAvatar
                  key={avatarRefreshKey}
                  uri={user.avatarUrl}
                  size={72}
                />
              </View>
              <View style={styles.userInfo}>
                {loading ? (
                  <ActivityIndicator color="#132457" />
                ) : (
                  <>
                    <Text style={styles.userName} numberOfLines={1}>
                      {user.name}
                    </Text>
                    <Text style={styles.userEmail} numberOfLines={1}>
                      {user.email}
                    </Text>
                    <Text style={styles.roleBadge}>Location owner</Text>
                  </>
                )}
              </View>
            </BlurView>

            <View style={styles.section}>
              <MenuItem
                icon={<MaterialCommunityIcons name="map-marker-outline" size={22} color="#132457" />}
                label="My Locations"
                onPress={() => router.push('/owner/locations')}
              />
              <View style={styles.separator} />
              <MenuItem
                icon={<Feather name="calendar" size={22} color="#132457" />}
                label="Bookings"
                onPress={() => router.push('/owner/bookings')}
              />
              <View style={styles.separator} />
              <MenuItem
                icon={<AntDesign name="poweroff" size={20} color="#132457" />}
                label="Log out"
                onPress={handleLogout}
                danger
              />
            </View>
          </ScrollView>

          <OwnerBottomBar />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#111111',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  safeArea: {
    flex: 1,
  },
  phoneFrame: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 17,
    paddingTop: 14,
    paddingBottom: 96,
  },
  titleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },
  titleIcon: {
    marginRight: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: 'rgba(19, 36, 87, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#12122A',
    fontFamily: Platform.select({
      ios: 'Georgia',
      android: 'serif',
      default: 'serif',
    }),
  },
  userEmail: {
    fontSize: 14,
    color: '#38385E',
    marginTop: 2,
  },
  roleBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '700',
    color: '#132457',
    backgroundColor: 'rgba(19, 36, 87, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  section: {
    backgroundColor: 'rgba(232,232,232,0.78)',
    borderRadius: 16,
    paddingVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  menuIcon: {
    width: 28,
    alignItems: 'center',
    marginRight: 14,
  },
  menuText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#12122A',
  },
  menuTextDanger: {
    color: '#132457',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: 16,
  },
});
