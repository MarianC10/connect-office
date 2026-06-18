import React, { useCallback, useEffect, useState } from 'react';
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
import { Conversation, listConversations } from '@/lib/chat';
import {
  subscribeChatWS,
} from '@/lib/chat-ws';
import {
  acceptRequest,
  cancelOutgoingRequest,
  declineRequest,
  fetchInbox,
  fetchOutgoing,
  Friend,
  FriendRequest,
  listFriends,
  OutgoingFriendRequest,
} from '@/lib/friends';

type Segment = 'requests' | 'friends' | 'chats';

function formatPreviewTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString();
}

export default function PeopleScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('friends');
  const [inbox, setInbox] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingFriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [inboxItems, outgoingItems, friendItems, chatItems] = await Promise.all([
        fetchInbox(),
        fetchOutgoing(),
        listFriends(),
        listConversations(),
      ]);
      setInbox(inboxItems);
      setOutgoing(outgoingItems);
      setFriends(friendItems);
      setConversations(chatItems);
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

  useEffect(() => {
    const unsub = subscribeChatWS((event) => {
      if (event.type === 'friend_request.new') {
        setInbox((prev) => {
          if (prev.some((r) => r.id === event.request.id)) return prev;
          return [event.request, ...prev];
        });
        return;
      }
      if (event.type === 'friend_request.accepted') {
        setFriends((prev) => {
          if (prev.some((f) => f.id === event.friend.id)) return prev;
          return [...prev, event.friend].sort((a, b) =>
            a.display_name.localeCompare(b.display_name)
          );
        });
        void load();
        return;
      }
      if (event.type === 'message.new') {
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === event.conversation_id);
          if (idx === -1) {
            void load();
            return prev;
          }
          const updated: Conversation = {
            ...prev[idx],
            last_message: {
              id: event.message.id,
              body: event.message.body,
              created_at: event.message.created_at,
            },
          };
          const next = [...prev];
          next.splice(idx, 1);
          return [updated, ...next];
        });
      }
    });
    return unsub;
  }, [load]);

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

  const handleCancelOutgoing = async (requestId: string) => {
    setActingOn(requestId);
    try {
      await cancelOutgoingRequest(requestId);
      await load();
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not cancel request.'
      );
    } finally {
      setActingOn(null);
    }
  };

  const renderRequests = () => (
    <FlatList
      data={[
        ...(inbox.length > 0
          ? [{ type: 'header' as const, key: 'incoming-header', title: 'Incoming' }]
          : []),
        ...inbox.map((req) => ({ type: 'incoming' as const, key: req.id, req })),
        ...(outgoing.length > 0
          ? [{ type: 'header' as const, key: 'outgoing-header', title: 'Sent' }]
          : []),
        ...outgoing.map((req) => ({ type: 'outgoing' as const, key: req.id, req })),
      ]}
      keyExtractor={(item) => item.key}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No pending requests</Text>
          <Text style={styles.emptyText}>
            Incoming and sent friend requests will appear here.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        if (item.type === 'header') {
          return <Text style={styles.sectionHeader}>{item.title}</Text>;
        }
        if (item.type === 'incoming') {
          const req = item.req;
          return (
            <View style={styles.requestRow}>
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
          );
        }
        const req = item.req;
        return (
          <View style={styles.requestRow}>
            <TouchableOpacity
              style={styles.requestMain}
              onPress={() =>
                router.push({
                  pathname: '/users/[id]',
                  params: { id: req.to_user_id },
                } as never)
              }
            >
              <UserAvatar uri={req.avatar_url} size={44} />
              <View style={styles.requestText}>
                <Text style={styles.requestName}>{req.display_name}</Text>
                <Text style={styles.requestMeta}>Request pending</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineBtn}
              disabled={actingOn === req.id}
              onPress={() => void handleCancelOutgoing(req.id)}
            >
              {actingOn === req.id ? (
                <ActivityIndicator color="#666" size="small" />
              ) : (
                <Feather name="x" size={18} color="#666" />
              )}
            </TouchableOpacity>
          </View>
        );
      }}
      contentContainerStyle={styles.listContent}
    />
  );

  const renderFriends = () => (
    <FlatList
      data={friends}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
  );

  const renderChats = () => (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No chats yet</Text>
          <Text style={styles.emptyText}>
            Message a friend from their profile to start a conversation.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.friendRow}
          onPress={() =>
            router.push({
              pathname: '/chat/[id]',
              params: { id: item.id },
            } as never)
          }
        >
          <UserAvatar uri={item.friend.avatar_url} size={48} />
          <View style={styles.friendText}>
            <Text style={styles.friendName}>{item.friend.display_name}</Text>
            <Text style={styles.chatPreview} numberOfLines={1}>
              {item.last_message?.body ?? 'No messages yet'}
            </Text>
          </View>
          {item.last_message ? (
            <Text style={styles.chatTime}>
              {formatPreviewTime(item.last_message.created_at)}
            </Text>
          ) : null}
        </TouchableOpacity>
      )}
      contentContainerStyle={styles.listContent}
    />
  );

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

      <View style={styles.segmentRow}>
        {(['requests', 'friends', 'chats'] as const).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.segment, segment === key && styles.segmentActive]}
            onPress={() => setSegment(key)}
          >
            <Text
              style={[
                styles.segmentText,
                segment === key && styles.segmentTextActive,
              ]}
            >
              {key === 'requests'
                ? `Requests${
                    inbox.length + outgoing.length > 0
                      ? ` (${inbox.length + outgoing.length})`
                      : ''
                  }`
                : key.charAt(0).toUpperCase() + key.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E2A5E" />
        </View>
      ) : segment === 'requests' ? (
        renderRequests()
      ) : segment === 'friends' ? (
        renderFriends()
      ) : (
        renderChats()
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
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#e8ecf5',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#fff',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  segmentTextActive: {
    color: '#1E2A5E',
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
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
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
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
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
  chatPreview: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  chatTime: {
    fontSize: 12,
    color: '#999',
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
