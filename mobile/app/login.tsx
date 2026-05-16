import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  ImageBackground,
  Image,
  TouchableOpacity,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { syncCurrentUserWithBackend } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { isValidEmail } from '@/utils/validation';

export default function LoginScreen() {
  const router = useRouter();
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      Alert.alert('Missing fields', 'Enter email and password.');
      return;
    }
    if (!isValidEmail(trimmed)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      const { data: { session }, error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) {
        Alert.alert('Sign in failed', error.message);
        return;
      }
      if (!session?.access_token) {
        Alert.alert('Sign in failed', 'No session returned.');
        return;
      }
      await syncCurrentUserWithBackend(session.access_token);
      router.replace('/(tabs)');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Could not sync with API', msg);
    } finally {
      setBusy(false);
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
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.glassContainer}>
            <Text style={styles.title}>LOGIN</Text>
            <Text style={styles.subtitle}>Please Sign In to continue.</Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#555" style={styles.icon} />
              <TextInput
                placeholder="Email:"
                style={styles.input}
                placeholderTextColor="#777"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!busy}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#555" style={styles.icon} />
              <TextInput
                placeholder="Password:"
                secureTextEntry={!showPassword}
                style={styles.input}
                placeholderTextColor="#777"
                value={password}
                onChangeText={setPassword}
                editable={!busy}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={busy}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#555"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.rememberRow}>
              <Text style={styles.rememberText}>Remember me</Text>
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                disabled={busy}
                trackColor={{ false: '#767577', true: '#2C3E50' }}
                thumbColor="#fff"
              />
            </View>

            <TouchableOpacity
              style={[styles.signInButton, busy && styles.signInButtonDisabled]}
              onPress={() => void handleLogin()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signInText}>LOGIN</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/signup')} disabled={busy}>
              <Text style={styles.footerText}>
                Don&apos;t have an account?{' '}
                <Text style={styles.footerLink}>SignUp</Text>
              </Text>
            </TouchableOpacity>
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

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  logo: {
    width: 350,
    height: undefined,
    aspectRatio: 280 / 120,
    marginBottom: 20,
  },

  glassContainer: {
    width: '85%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 30,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255, 0.2)',
    marginBottom: 32,
  },

  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },

  subtitle: {
    color: '#fff',
    marginBottom: 30,
    fontSize: 14,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 25,
    paddingHorizontal: 15,
    marginBottom: 15,
    width: '100%',
    height: 50,
  },

  icon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: '#000',
    fontSize: 16,
  },

  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    marginBottom: 25,
    paddingHorizontal: 10,
  },

  rememberText: {
    color: '#fff',
    fontSize: 14,
  },

  signInButton: {
    backgroundColor: '#1E2A5E',
    paddingVertical: 14,
    width: '90%',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    minHeight: 48,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },

  signInText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },

  footerText: {
    color: '#fff',
    fontSize: 12,
  },

  footerLink: {
    fontStyle: 'italic',
    textDecorationLine: 'underline',
  },
});
