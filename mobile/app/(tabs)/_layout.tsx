import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { SOCIAL_ENABLED } from "@/lib/social-config";

function TabBarBackground() {
  return <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.20)",
          backgroundColor: "rgba(255,255,255,0.55)",
          elevation: 0,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.3,
          marginBottom: Platform.OS === "ios" ? 0 : 4,
        },
      }}
    >
      {/* Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.iconActive : undefined}>
              <IconSymbol size={24} name="house.fill" color={color} />
            </View>
          ),
        }}
      />

      {/* Favourites */}
      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favourites",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.iconActive : undefined}>
              <IconSymbol size={24} name="heart.fill" color={color} />
            </View>
          ),
        }}
      />

      {/* Owner Dashboard */}
      <Tabs.Screen
        name="owner-tab"
        options={{
          title: "Owner",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.iconActive : undefined}>
              <Ionicons name="business-outline" size={24} color={color} />
            </View>
          ),
        }}
      />

      {/* People */}
      {SOCIAL_ENABLED && (
        <Tabs.Screen
          name="people"
          options={{
            title: "People",
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.iconActive : undefined}>
                <IconSymbol size={24} name="person.2.fill" color={color} />
              </View>
            ),
          }}
        />
      )}

      {!SOCIAL_ENABLED && <Tabs.Screen name="people" options={{ href: null }} />}

      {/* Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.iconActive : undefined}>
              <IconSymbol size={24} name="person.fill" color={color} />
            </View>
          ),
        }}
      />

      {/* Hide explore tab from the default template */}
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconActive: {
    backgroundColor: "rgba(46, 91, 255, 0.12)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});



//VARIANTA BUNA VECHE DE CARE AVEM NEVOIE IN PROIECT!!!!!!!!!!

// import { Tabs } from 'expo-router';
// import React from 'react';
// import { Platform, StyleSheet, View } from 'react-native';
// import { BlurView } from 'expo-blur';
// import { useSafeAreaInsets } from 'react-native-safe-area-context';

// import { HapticTab } from '@/components/haptic-tab';
// import { IconSymbol } from '@/components/ui/icon-symbol';
// import { Colors } from '@/constants/theme';
// import { useColorScheme } from '@/hooks/use-color-scheme';
// import { SOCIAL_ENABLED } from '@/lib/social-config';

// function TabBarBackground() {
//   return <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />;
// }

// export default function TabLayout() {
//   const colorScheme = useColorScheme();
//   const insets = useSafeAreaInsets();

//   return (
//     <Tabs
//       screenOptions={{
//         tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
//         headerShown: false,
//         tabBarButton: HapticTab,
//         tabBarBackground: () => <TabBarBackground />,
//         tabBarStyle: {
//           position: 'absolute',
//           borderTopWidth: 1,
//           borderTopColor: 'rgba(255,255,255,0.20)',
//           backgroundColor: 'rgba(255,255,255,0.55)',
//           elevation: 0,
//           height: 56 + insets.bottom,
//           paddingBottom: insets.bottom,
//           paddingTop: 8,
//         },
//         tabBarLabelStyle: {
//           fontSize: 11,
//           fontWeight: '600',
//           letterSpacing: 0.3,
//           marginBottom: Platform.OS === 'ios' ? 0 : 4,
//         },
//       }}
//     >
//       {/* ── Home — tapping again scrolls to top (handled in index.tsx) ── */}
//       <Tabs.Screen
//         name="index"
//         options={{
//           title: 'Home',
//           tabBarIcon: ({ color, focused }) => (
//             <View style={focused ? styles.iconActive : undefined}>
//               <IconSymbol size={24} name="house.fill" color={color} />
//             </View>
//           ),
//         }}
//       />

//       {/* ── Favourites ── */}
//       <Tabs.Screen
//         name="favorites"
//         options={{
//           title: 'Favourites',
//           tabBarIcon: ({ color, focused }) => (
//             <View style={focused ? styles.iconActive : undefined}>
//               <IconSymbol size={24} name="heart.fill" color={color} />
//             </View>
//           ),
//         }}
//       />

//       {SOCIAL_ENABLED && (
//         <Tabs.Screen
//           name="people"
//           options={{
//             title: 'People',
//             tabBarIcon: ({ color, focused }) => (
//               <View style={focused ? styles.iconActive : undefined}>
//                 <IconSymbol size={24} name="person.2.fill" color={color} />
//               </View>
//             ),
//           }}
//         />
//       )}

//       {!SOCIAL_ENABLED && (
//         <Tabs.Screen name="people" options={{ href: null }} />
//       )}

//       {/* ── Profile ── */}
//       <Tabs.Screen
//         name="profile"
//         options={{
//           title: 'Profile',
//           tabBarIcon: ({ color, focused }) => (
//             <View style={focused ? styles.iconActive : undefined}>
//               <IconSymbol size={24} name="person.fill" color={color} />
//             </View>
//           ),
//         }}
//       />

//       {/* Hide explore tab from the default template */}
//       <Tabs.Screen
//         name="explore"
//         options={{ href: null }}
//       />
//     </Tabs>
//   );
// }

// const styles = StyleSheet.create({
//   iconActive: {
//     backgroundColor: 'rgba(46, 91, 255, 0.12)',
//     borderRadius: 10,
//     paddingHorizontal: 10,
//     paddingVertical: 3,
//   },
// });



