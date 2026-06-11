import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  ImageBackground,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@/lib/supabase';
import { isValidEmail, isValidPassword } from '../utils/validation';

export default function SignUpScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [busy, setBusy] = useState(false);

  const handleSignUp = async () => {
    if (!email || !username || !password || !confirmPassword) {
      Alert.alert('Missing fields', 'Please complete all fields.');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Invalid email');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password error', 'Passwords do not match.');
      return;
    }

    if (!isValidPassword(password)) {
      Alert.alert('Invalid password', 'Password must be at least 6 characters long and contain uppercase, lowercase, and a number.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { preferred_username: username.trim() } },
      });
      if (error) {
        Alert.alert('Sign up failed', error.message);
        return;
      }
      Alert.alert(
        'Success',
        'If email confirmation is enabled in Supabase, check your inbox before signing in.',
      );
      router.push('/login');
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
              <Text style={styles.title}>Register</Text>
              <Text style={styles.subtitle}>Please SignUp to login.</Text>

              {/* email */}
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color="#555"
                  style={styles.icon}
                />
                <TextInput
                  placeholder="E-mail:"
                  style={styles.input}
                  placeholderTextColor="#777"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              {/* username */}
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#555"
                  style={styles.icon}
                />
                <TextInput
                  placeholder="Username:"
                  style={styles.input}
                  placeholderTextColor="#777"
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                />
              </View>

              {/* password */}
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#555"
                  style={styles.icon}
                />
                <TextInput
                  placeholder="Password:"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  placeholderTextColor="#777"
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#555"
                  />
                </TouchableOpacity>
              </View>

              {/* confirm password */}
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#555"
                  style={styles.icon}
                />
                <TextInput
                  placeholder="Confirm password:"
                  secureTextEntry={!showConfirmPassword}
                  style={styles.input}
                  placeholderTextColor="#777"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                >
                  <Ionicons
                    name={
                      showConfirmPassword ? 'eye-off-outline' : 'eye-outline'
                    }
                    size={20}
                    color="#555"
                  />
                </TouchableOpacity>
              </View>

              {/* sign up button */}
              <TouchableOpacity
                style={[styles.signUpButton, busy && styles.signUpButtonDisabled]}
                onPress={() => void handleSignUp()}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.signUpText}>SIGN UP</Text>
                )}
              </TouchableOpacity>

              {/* footer */}
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.footerText}>
                  Already have an account?{' '}
                  <Text style={styles.footerLink}>Login</Text>
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
    backgroundColor:'rgba(0,0,0,0.3)'
    
  },

  scrollContent:{
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    // paddingTop: 0,             
  },
  logo:{
    //  logo is still in the same place but the box is moved up a bit
    width:350,
    height:undefined,
    aspectRatio: 280 / 120,
    marginBottom:0,
  },

  glassContainer:{
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
    marginBottom: 10
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

  icon:{
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: '#000',
    fontSize: 16,
  },

  signUpButton:{
    backgroundColor: '#1E2A5E',
    paddingVertical: 14,
    width: '90%',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    minHeight: 48,
  },
  signUpButtonDisabled: {
    opacity: 0.7,
  },

  signUpText:{
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },

  footerText:{
    color: '#fff',
    fontSize: 12,
  },

  footerLink:{
    fontStyle: 'italic',
    textDecorationLine:'underline'
  }
  
  
});