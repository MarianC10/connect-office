import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { UserAvatar } from '@/components/user-avatar';
import {
  FriendRequestConflictError,
  sendFriendRequest,
} from '@/lib/friends';
import { PublicProfile, searchUsers } from '@/lib/profile';

export default function PeopleSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const runSearch = async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      Alert.alert('Search', 'Enter at least 2 characters.');
      return;
    }

    setLoading(true);
    try {
      setResults(await searchUsers(trimmed));
    } catch (err) {
      setResults([]);
      Alert.alert(
        'Search',
        err instanceof Error ? err.message : 'Search failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (user: PublicProfile) => {
    setSendingTo(user.id);
    try {
      await sendFriendRequest({ user_id: user.id });
      Alert.alert('Sent', `Friend request sent to ${user.display_name}.`);
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
      setSendingTo(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#1E2A5E" />
        </TouchableOpacity>
        <Text style={styles.title}>Find people</Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by display name"
          autoCapitalize="words"
          style={styles.input}
          returnKeyType="search"
          onSubmitEditing={() => void runSearch()}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => void runSearch()}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Feather name="search" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.emailBtn}
        onPress={() => router.push('/people/add-by-email')}
      >
        <Feather name="mail" size={18} color="#1E2A5E" />
        <Text style={styles.emailBtnText}>Add friend by email</Text>
      </TouchableOpacity>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.resultRow}>
            <TouchableOpacity
              style={styles.resultMain}
              onPress={() =>
                router.push({
                  pathname: '/users/[id]',
                  params: { id: item.id },
                } as never)
              }
            >
              <UserAvatar uri={item.avatar_url} size={48} />
              <View style={styles.resultText}>
                <Text style={styles.resultName}>{item.display_name}</Text>
                <Text style={styles.resultMeta}>Public profile</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addBtn}
              disabled={sendingTo === item.id}
              onPress={() => void handleAddFriend(item)}
            >
              {sendingTo === item.id ? (
                <ActivityIndicator color="#1E2A5E" size="small" />
              ) : (
                <Feather name="user-plus" size={18} color="#1E2A5E" />
              )}
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.hint}>
              Search finds public profiles by display name. Use &quot;Add friend by
              email&quot; for private users.
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f6fb' },
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
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#1E2A5E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(30,42,94,0.15)',
  },
  emailBtnText: {
    color: '#1E2A5E',
    fontWeight: '600',
    fontSize: 15,
  },
  list: { padding: 16, paddingBottom: 40 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  resultMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultText: { flex: 1 },
  resultName: { fontSize: 17, fontWeight: '600', color: '#222' },
  resultMeta: { fontSize: 13, color: '#777', marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef1fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { color: '#666', textAlign: 'center', marginTop: 20, lineHeight: 20 },
});
