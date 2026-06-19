import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSession } from '@/hooks/use-session';

export const unstable_settings = {
  anchor: '(tabs)',
};

function BootLoader() {
  return (
    <View style={styles.bootLoader}>
      <ActivityIndicator size="large" color="#132457" />
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading } = useSession();

  if (isLoading) {
    return <BootLoader />;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="index" options={{ gestureEnabled: false }} />
          <Stack.Screen name="login" options={{ gestureEnabled: false }} />
          <Stack.Screen name="signup" options={{ gestureEnabled: false }} />
        </Stack.Protected>

        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="owner" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="office"
            options={{ gestureEnabled: true, animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="profile"
            options={{ gestureEnabled: true, animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="people"
            options={{ gestureEnabled: true, animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="users"
            options={{ gestureEnabled: true, animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="chat"
            options={{ gestureEnabled: true, animation: 'slide_from_right' }}
          />
          <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  bootLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
});
