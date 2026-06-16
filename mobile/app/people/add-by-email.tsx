import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { FriendRequestConflictError, sendFriendRequest } from '@/lib/friends';

export default function AddFriendByEmailScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }

    setSending(true);
    try {
      await sendFriendRequest({ email: trimmed });
      Alert.alert('Sent', 'Friend request sent.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
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

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#1E2A5E" />
          </TouchableOpacity>
          <Text style={styles.title}>Add by email</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.description}>
            Send a friend request using someone&apos;s exact account email. This
            works for private profiles that do not appear in name search.
          </Text>

          <Text style={styles.label}>Email address</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="friend@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={styles.input}
          />

          <TouchableOpacity
            style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
            disabled={sending}
            onPress={() => void handleSend()}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendBtnText}>Send friend request</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: '#1E2A5E' },
  content: { padding: 16 },
  description: {
    color: '#555',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    marginBottom: 16,
  },
  sendBtn: {
    backgroundColor: '#1E2A5E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.7 },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
