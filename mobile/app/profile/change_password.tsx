import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  ImageBackground,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [showPasswordRules, setShowPasswordRules] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordRules = [
    {
      label: 'At least 6 characters',
      isValid: newPassword.length >= 6,
    },
    {
      label: 'One uppercase letter',
      isValid: /[A-Z]/.test(newPassword),
    },
    {
      label: 'One lowercase letter',
      isValid: /[a-z]/.test(newPassword),
    },
    {
      label: 'One number',
      isValid: /\d/.test(newPassword),
    },
  ];

  const resetFields = () => {
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const isValidPassword = (password: string) => {
    return (
      password.length >= 6 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password)
    );
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please complete all fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New password does not match.');
      return;
    }

    if (!isValidPassword(newPassword)) {
      Alert.alert(
        'Invalid password',
        'Please make sure your new password meets all the requirements.'
      );
      return;
    }

    if (oldPassword === newPassword) {
      Alert.alert(
        'Error',
        'The new password must be different from the old password.'
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const email = session?.user?.email;

      if (!email) {
        Alert.alert('Error', 'You are not logged in. Please log in again.');
        router.replace('/login');
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: oldPassword,
      });

      if (signInError) {
        Alert.alert('Error', 'Old password is incorrect.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        Alert.alert('Error', updateError.message);
        return;
      }

      Alert.alert('Success', 'Password changed successfully.', [
        {
          text: 'OK',
          onPress: () => {
            resetFields();
            router.back();
          },
        },
      ]);
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
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
          {/* LOGO */}
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.glassContainer}>
            {/* OLD PASSWORD */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Old Password</Text>

              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#555"
                  style={styles.icon}
                />

                <TextInput
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  secureTextEntry={!showOld}
                  style={styles.input}
                  placeholder="Enter old password"
                  placeholderTextColor="#777"
                  autoCapitalize="none"
                />

                <TouchableOpacity onPress={() => setShowOld(!showOld)}>
                  <Ionicons
                    name={showOld ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#555"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* NEW PASSWORD */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New Password</Text>

              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#555"
                  style={styles.icon}
                />

                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showNew}
                  style={styles.input}
                  placeholder="Enter new password"
                  placeholderTextColor="#777"
                  autoCapitalize="none"
                  onFocus={() => setShowPasswordRules(true)}
                  onBlur={() => setShowPasswordRules(false)}
                />

                <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                  <Ionicons
                    name={showNew ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#555"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {showPasswordRules && (
              <View style={styles.passwordRulesBox}>
                {passwordRules.map((rule) => (
                  <View key={rule.label} style={styles.passwordRuleRow}>
                    <Ionicons
                      name={
                        rule.isValid
                          ? 'checkmark-circle'
                          : 'ellipse-outline'
                      }
                      size={17}
                      color={rule.isValid ? '#38D9A9' : 'rgba(255,255,255,0.85)'}
                      style={styles.passwordRuleIcon}
                    />

                    <Text
                      style={[
                        styles.passwordRuleText,
                        rule.isValid && styles.passwordRuleTextValid,
                      ]}
                    >
                      {rule.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* CONFIRM PASSWORD */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm New Password</Text>

              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#555"
                  style={styles.icon}
                />

                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirm}
                  style={styles.input}
                  placeholder="Confirm new password"
                  placeholderTextColor="#777"
                  autoCapitalize="none"
                />

                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                  <Ionicons
                    name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#555"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* BUTTON */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleChangePassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>CHANGE PASSWORD</Text>
              )}
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
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 30,
    maxHeight: 560,
    padding: 45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255, 0.2)',
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

  passwordRulesBox: {
    width: '100%',
    backgroundColor: 'rgba(30, 42, 94, 0.45)',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: -4,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  passwordRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },

  passwordRuleIcon: {
    marginRight: 8,
  },

  passwordRuleText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
  },

  passwordRuleTextValid: {
    color: '#38D9A9',
    fontWeight: '700',
  },

  button: {
    backgroundColor: '#1E2A5E',
    paddingVertical: 14,
    width: '90%',
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 25,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});