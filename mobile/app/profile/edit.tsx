import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

import { UserAvatar } from '@/components/user-avatar';
import {
  isLikelyAutoDisplayName,
  resolveDisplayName,
  syncDisplayNameToSupabase,
} from '@/lib/display-name';
import { fetchMe, updateMe, uploadAvatar } from '@/lib/profile';
import { SOCIAL_ENABLED } from '@/lib/social-config';
import { supabase } from '@/lib/supabase';

export default function EditProfileScreen() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const isValidEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  };

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUser = session?.user;

      if (!currentUser) {
        Alert.alert('Error', 'You are not logged in. Please log in again.');
        router.replace('/login');
        return;
      }

      setEmail(currentUser.email ?? '');
      setOriginalEmail(currentUser.email ?? '');

      try {
        const me = await fetchMe();
        setDisplayName(
          resolveDisplayName(me.display_name, currentUser.user_metadata)
        );
        setIsPublic(me.is_public);
        setAvatarUrl(me.avatar_url);
      } catch (err) {
        Alert.alert(
          'Error',
          err instanceof Error ? err.message : 'Could not load profile.'
        );
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [router]);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const me = await uploadAvatar(asset.uri, asset.mimeType ?? 'image/jpeg');
      setAvatarUrl(me.avatar_url);
      Alert.alert('Updated', 'Profile picture saved.');
    } catch (err) {
      Alert.alert(
        'Upload failed',
        err instanceof Error ? err.message : 'Could not upload profile picture.'
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    const cleanName = displayName.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanEmail) {
      Alert.alert('Error', 'Please complete all fields.');
      return;
    }

    if (cleanName.length < 2) {
      Alert.alert('Error', 'Display name must have at least 2 characters.');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    setSaving(true);

    try {
      await updateMe({
        display_name: cleanName,
        is_public: SOCIAL_ENABLED ? isPublic : undefined,
      });

      try {
        await syncDisplayNameToSupabase(cleanName);
      } catch (syncErr) {
        Alert.alert(
          'Partially saved',
          syncErr instanceof Error
            ? `Profile saved on the server, but Supabase sync failed: ${syncErr.message}`
            : 'Profile saved on the server, but Supabase sync failed.'
        );
        return;
      }

      const emailChanged = cleanEmail !== originalEmail;
      if (emailChanged) {
        const { error } = await supabase.auth.updateUser({ email: cleanEmail });
        if (error) {
          Alert.alert('Error', error.message);
          return;
        }

        Alert.alert(
          'Profile updated',
          'Your profile was updated. Please check your inbox to confirm the new email address.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }

      Alert.alert('Success', 'Your profile was updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/login_signup_background.jpg')}
      style={styles.background}
      imageStyle={{ opacity: 0.4 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.glassContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#1E2A5E" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => void pickAvatar()}
              disabled={uploadingAvatar || !SOCIAL_ENABLED}
            >
              {uploadingAvatar ? (
                <ActivityIndicator color="#1E2A5E" />
              ) : (
                <UserAvatar uri={avatarUrl} size={82} />
              )}
              {SOCIAL_ENABLED && (
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.title}>Edit Profile</Text>

            {loading ? (
              <ActivityIndicator color="#1E2A5E" size="large" />
            ) : (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Display name</Text>

                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color="#555"
                      style={styles.icon}
                    />

                    <TextInput
                      value={displayName}
                      onChangeText={setDisplayName}
                      style={styles.input}
                      placeholder="Enter display name"
                      placeholderTextColor="#777"
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Email</Text>

                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color="#555"
                      style={styles.icon}
                    />

                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      style={styles.input}
                      placeholder="Enter email"
                      placeholderTextColor="#777"
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                {SOCIAL_ENABLED && (
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleTextWrap}>
                      <Text style={styles.toggleLabel}>Public profile</Text>
                      <Text style={styles.toggleHint}>
                        Public profiles appear in name search.
                      </Text>
                    </View>
                    <Switch
                      value={isPublic}
                      onValueChange={setIsPublic}
                      trackColor={{ false: '#ccc', true: '#8ea0d8' }}
                      thumbColor={isPublic ? '#1E2A5E' : '#f4f4f4'}
                    />
                  </View>
                )}

                <Text style={styles.infoText}>
                  If you change your email, you may need to confirm it from your
                  inbox.
                </Text>

                <TouchableOpacity
                  style={[styles.button, saving && styles.buttonDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>SAVE CHANGES</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => router.back()}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>CANCEL</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },

  glassContainer: {
    width: '85%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 30,
    padding: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarButton: {
    marginBottom: 14,
    position: 'relative',
  },

  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E2A5E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },

  fieldGroup: {
    width: '100%',
    marginBottom: 15,
  },

  label: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 6,
    marginLeft: 5,
    fontWeight: '500',
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 50,
    width: '100%',
  },

  icon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: '#000',
    fontSize: 16,
  },

  toggleRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  toggleTextWrap: {
    flex: 1,
    paddingRight: 12,
  },

  toggleLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  toggleHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },

  infoText: {
    width: '100%',
    color: '#fff',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
    marginBottom: 20,
  },

  button: {
    backgroundColor: '#1E2A5E',
    paddingVertical: 14,
    width: '90%',
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 8,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  cancelButton: {
    marginTop: 14,
    paddingVertical: 8,
  },

  cancelButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
