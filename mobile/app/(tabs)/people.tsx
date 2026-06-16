import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { UserAvatar } from '@/components/user-avatar';
import {
  acceptRequest,
  declineRequest,
  fetchInbox,
  Friend,
  FriendRequest,
  listFriends,
} from '@/lib/friends';

export default function PeopleScreen() {
  const router = useRouter();
  const [inbox, setInbox] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [inboxItems, friendItems] = await Promise.all([
        fetchInbox(),
        listFriends(),
      ]);
      setInbox(inboxItems);
      setFriends(friendItems);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not load people data.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const handleAccept = async (requestId: string) => {
    setActingOn(requestId);
    try {
      await acceptRequest(requestId);
      await load();
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not accept request.'
      );
    } finally {
      setActingOn(null);
    }
  };

  const handleDecline = async (requestId: string) => {
    setActingOn(requestId);
    try {
      await declineRequest(requestId);
      await load();
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not decline request.'
      );
    } finally {
      setActingOn(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>People</Text>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => router.push('/people/search')}
        >
          <Feather name="search" size={20} color="#1E2A5E" />
          <Text style={styles.searchButtonText}>Find people</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E2A5E" />
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            inbox.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Friend requests</Text>
                {inbox.map((req) => (
                  <View key={req.id} style={styles.requestRow}>
                    <TouchableOpacity
                      style={styles.requestMain}
                      onPress={() =>
                        router.push({
                          pathname: '/users/[id]',
                          params: { id: req.from_user_id },
                        } as never)
                      }
                    >
                      <UserAvatar uri={req.avatar_url} size={44} />
                      <View style={styles.requestText}>
                        <Text style={styles.requestName}>{req.display_name}</Text>
                        <Text style={styles.requestMeta}>Wants to connect</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        disabled={actingOn === req.id}
                        onPress={() => void handleAccept(req.id)}
                      >
                        {actingOn === req.id ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Feather name="check" size={18} color="#fff" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.declineBtn}
                        disabled={actingOn === req.id}
                        onPress={() => void handleDecline(req.id)}
                      >
                        <Feather name="x" size={18} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No friends yet</Text>
              <Text style={styles.emptyText}>
                Search for people or add someone by email.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.friendRow}
              onPress={() =>
                router.push({
                  pathname: '/users/[id]',
                  params: { id: item.id },
                } as never)
              }
            >
              <UserAvatar uri={item.avatar_url} size={48} />
              <View style={styles.friendText}>
                <Text style={styles.friendName}>{item.display_name}</Text>
                <Text style={styles.friendMeta}>
                  {item.is_public ? 'Public profile' : 'Private profile'}
                </Text>
              </View>
              <Feather name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1E2A5E',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(30,42,94,0.12)',
  },
  searchButtonText: {
    color: '#1E2A5E',
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E2A5E',
    marginBottom: 8,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  requestMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requestText: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  requestMeta: {
    fontSize: 13,
    color: '#666',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E2A5E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ececec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  friendText: {
    flex: 1,
  },
  friendName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#222',
  },
  friendMeta: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptyText: {
    marginTop: 6,
    color: '#666',
    textAlign: 'center',
  },
});
