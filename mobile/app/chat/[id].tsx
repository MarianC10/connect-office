import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { UserAvatar } from '@/components/user-avatar';
import {
  ChatMessage,
  Conversation,
  fetchMessages,
  listConversations,
  sendMessage,
} from '@/lib/chat';
import {
  connectChatWS,
  sendChatMessageWS,
  subscribeChatWS,
} from '@/lib/chat-ws';
import { fetchMe } from '@/lib/profile';

const MAX_MESSAGE_LENGTH = 2000;

export default function ChatThreadScreen() {
  const router = useRouter();
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const loadConversationMeta = useCallback(async () => {
    if (!conversationId) return;
    const items = await listConversations();
    const found = items.find((c) => c.id === conversationId);
    if (found) {
      setConversation(found);
    }
  }, [conversationId]);

  const loadInitial = useCallback(async () => {
    if (!conversationId) return;
    try {
      const [me, history] = await Promise.all([
        fetchMe(),
        fetchMessages(conversationId, { limit: 50 }),
      ]);
      setMyUserId(me.id);
      setMessages(history.slice().reverse());
      await loadConversationMeta();
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not load chat.'
      );
      router.back();
    } finally {
      setLoading(false);
    }
  }, [conversationId, loadConversationMeta, router]);

  useEffect(() => {
    void loadInitial();
    void connectChatWS();
  }, [loadInitial]);

  useEffect(() => {
    if (!conversationId) return;
    return subscribeChatWS((event) => {
      if (event.type !== 'message.new') return;
      if (event.conversation_id !== conversationId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === event.message.id)) return prev;
        return [...prev, event.message];
      });
    });
  }, [conversationId]);

  const loadOlder = async () => {
    if (!conversationId || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const older = await fetchMessages(conversationId, {
        before: messages[0].id,
        limit: 50,
      });
      if (older.length > 0) {
        setMessages((prev) => [...older.slice().reverse(), ...prev]);
      }
    } catch {
      // pagination failure is non-fatal
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !conversationId || sending) return;
    if (body.length > MAX_MESSAGE_LENGTH) {
      Alert.alert('Too long', `Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`);
      return;
    }

    setSending(true);
    setDraft('');
    try {
      const sentViaWS = sendChatMessageWS(conversationId, body);
      if (!sentViaWS) {
        const msg = await sendMessage(conversationId, body);
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    } catch (err) {
      setDraft(body);
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Could not send message.'
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator size="large" color="#1E2A5E" />
      </View>
    );
  }

  const friendName = conversation?.friend.display_name ?? 'Chat';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#1E2A5E" />
        </TouchableOpacity>
        {conversation ? (
          <UserAvatar uri={conversation.friend.avatar_url} size={36} />
        ) : null}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {friendName}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          ListHeaderComponent={
            loadingOlder ? (
              <ActivityIndicator color="#1E2A5E" style={styles.olderLoader} />
            ) : messages.length > 0 ? (
              <TouchableOpacity onPress={() => void loadOlder()}>
                <Text style={styles.loadOlder}>Load earlier messages</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === myUserId;
            return (
              <View
                style={[
                  styles.bubbleRow,
                  mine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
                ]}
              >
                <View
                  style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
                >
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                    {item.body}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#999"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
            disabled={!draft.trim() || sending}
            onPress={() => void handleSend()}
          >
            {sending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Feather name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f6fb' },
  flex: { flex: 1 },
  centerScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f6fb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1E2A5E',
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexGrow: 1,
  },
  olderLoader: { marginBottom: 8 },
  loadOlder: {
    textAlign: 'center',
    color: '#1E2A5E',
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyText: { color: '#666' },
  bubbleRow: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: { backgroundColor: '#1E2A5E' },
  bubbleTheirs: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  bubbleText: { fontSize: 16, color: '#222' },
  bubbleTextMine: { color: '#fff' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(30,42,94,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#f9fafc',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E2A5E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
});
