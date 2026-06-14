import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';

export default function EditProfileScreen() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const getUsernameFromMetadata = (metadata: any) => {
    return (
      metadata?.preferred_username ||
      metadata?.user_name ||
      metadata?.username ||
      ''
    );
  };

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

      setUsername(getUsernameFromMetadata(currentUser.user_metadata));
      setEmail(currentUser.email ?? '');
      setOriginalEmail(currentUser.email ?? '');
      setLoading(false);
    };

    void loadProfile();
  }, [router]);

  const handleSave = async () => {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!cleanUsername || !cleanEmail) {
      Alert.alert('Error', 'Please complete all fields.');
      return;
    }

    if (cleanUsername.length < 2) {
      Alert.alert('Error', 'Username must have at least 2 characters.');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    setSaving(true);

    try {
      const emailChanged = cleanEmail !== originalEmail;

      const { error } = await supabase.auth.updateUser({
        email: emailChanged ? cleanEmail : undefined,
        data: {
          preferred_username: cleanUsername,
        },
      });

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (emailChanged) {
        Alert.alert(
          'Profile updated',
          'Your username was updated. Please check your inbox to confirm the new email address.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
        return;
      }

      Alert.alert('Success', 'Your profile was updated successfully.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
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

            <View style={styles.headerIcon}>
              <Ionicons name="person-outline" size={42} color="#1E2A5E" />
            </View>

            <Text style={styles.title}>Edit Profile</Text>

            {loading ? (
              <ActivityIndicator color="#1E2A5E" size="large" />
            ) : (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Username</Text>

                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color="#555"
                      style={styles.icon}
                    />

                    <TextInput
                      value={username}
                      onChangeText={setUsername}
                      style={styles.input}
                      placeholder="Enter username"
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

  headerIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
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