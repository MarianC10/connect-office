import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { UserAvatar } from '@/components/user-avatar';
import {
  FriendRequestConflictError,
  listFriends,
  sendFriendRequest,
  unfriend,
} from '@/lib/friends';
import { getConversationWithFriend, listConversations } from '@/lib/chat';
import { fetchUserProfile, PublicProfile } from '@/lib/profile';

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [hasConversation, setHasConversation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [unfriending, setUnfriending] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const load = async () => {
      try {
        const [user, friends, conversations] = await Promise.all([
          fetchUserProfile(id),
          listFriends(),
          listConversations(),
        ]);
        if (cancelled) return;
        setProfile(user);
        setIsFriend(friends.some((f) => f.id === id));
        setHasConversation(conversations.some((c) => c.friend.id === id));
      } catch (err) {
        if (!cancelled) {
          Alert.alert(
            'Error',
            err instanceof Error ? err.message : 'Could not load profile.'
          );
          router.back();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const handleMessage = async () => {
    if (!profile) return;
    setOpeningChat(true);
    try {
      const conv = await getConversationWithFriend(profile.id);
      router.push({
        pathname: '/chat/[id]',
        params: { id: conv.id },
      } as never);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not open chat.'
      );
    } finally {
      setOpeningChat(false);
    }
  };

  const handleUnfriend = () => {
    if (!profile) return;
    Alert.alert(
      'Unfriend',
      `Remove ${profile.display_name} from your friends? You can still view your chat history, but you won't be able to send new messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfriend',
          style: 'destructive',
          onPress: () => {
            setUnfriending(true);
            void (async () => {
              try {
                await unfriend(profile.id);
                setIsFriend(false);
              } catch (err) {
                Alert.alert(
                  'Error',
                  err instanceof Error ? err.message : 'Could not unfriend.'
                );
              } finally {
                setUnfriending(false);
              }
            })();
          },
        },
      ]
    );
  };

  const canOpenChat = isFriend || hasConversation;

  const handleAddFriend = async () => {
    if (!profile) return;
    setSending(true);
    try {
      await sendFriendRequest({ user_id: profile.id });
      Alert.alert('Sent', `Friend request sent to ${profile.display_name}.`);
    } catch (err) {
      if (err instanceof FriendRequestConflictError) {
        Alert.alert('Already sent', err.message);
        return;
      }
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not send request.'
      );
    } finally {
      setSending(false);
    }
  };

  if (loading || !profile) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color="#1E2A5E" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Feather name="arrow-left" size={22} color="#1E2A5E" />
      </TouchableOpacity>

      <View style={styles.card}>
        <UserAvatar uri={profile.avatar_url} size={96} />
        <Text style={styles.name}>{profile.display_name}</Text>
        <Text style={styles.meta}>
          {profile.is_public ? 'Public profile' : 'Private profile'}
        </Text>

        {!isFriend && (
          <TouchableOpacity
            style={styles.primaryBtn}
            disabled={sending}
            onPress={() => void handleAddFriend()}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Add friend</Text>
            )}
          </TouchableOpacity>
        )}

        {canOpenChat && (
          <TouchableOpacity
            style={styles.primaryBtn}
            disabled={openingChat}
            onPress={() => void handleMessage()}
          >
            {openingChat ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isFriend ? 'Message' : 'View chat'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {isFriend && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            disabled={unfriending}
            onPress={handleUnfriend}
          >
            {unfriending ? (
              <ActivityIndicator color="#c0392b" />
            ) : (
              <Text style={styles.secondaryBtnText}>Unfriend</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f6fb', padding: 16 },
  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f6fb',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  name: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: '700',
    color: '#1E2A5E',
    textAlign: 'center',
  },
  meta: {
    marginTop: 4,
    color: '#666',
    fontSize: 15,
  },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: '#1E2A5E',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 28,
    minWidth: 180,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    marginTop: 12,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 28,
    minWidth: 180,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192,57,43,0.35)',
  },
  secondaryBtnText: {
    color: '#c0392b',
    fontWeight: '600',
    fontSize: 16,
  },
  friendBadge: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eef1fb',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  friendBadgeText: {
    color: '#1E2A5E',
    fontWeight: '600',
  },
  disabledBtn: {
    marginTop: 12,
    paddingVertical: 10,
  },
  disabledBtnText: {
    color: '#999',
    fontWeight: '600',
  },
});
