// import React from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   // SafeAreaView,
//   TouchableOpacity,
//   ImageBackground,
// } from 'react-native';
// import {
//   Feather,
//   Ionicons,
//   MaterialCommunityIcons,
//   AntDesign,
// } from '@expo/vector-icons';
// import { SafeAreaView } from 'react-native-safe-area-context';

// export default function ProfileScreen() {
//   const user = {
//     name: 'User name',
//     email: 'user_email',
//   };

//   const MenuItem = ({
//     icon,
//     label,
//     onPress,
//   }: {
//     icon: React.ReactNode;
//     label: string;
//     onPress?: () => void;
//   }) => (
//     <TouchableOpacity style={styles.menuItem} onPress={onPress}>
//       <View style={styles.menuIcon}>{icon}</View>
//       <Text style={styles.menuText}>{label}</Text>
//     </TouchableOpacity>
//   );

//   return (
//     <ImageBackground
//       source={{
//         uri: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72',
//       }}
//       style={styles.background}
//       resizeMode="cover"
//     >
//       {/* Dark overlay */}
//       <View style={styles.overlay}>
//         <SafeAreaView style={styles.container}>

//           {/* Profile Card */}
//           <View style={styles.profileCard}>
//             <View style={styles.avatar}>
//               <Feather name="user" size={42} color="#333" />
//             </View>

//             <View style={styles.userInfo}>
//               <Text style={styles.userName}>{user.name}</Text>
//               <Text style={styles.userEmail}>{user.email}</Text>
//             </View>
//           </View>

//           {/* Section 1 */}
//           <View style={styles.section}>
//             <MenuItem
//               icon={<Feather name="edit-2" size={22} color="#333" />}
//               label="Edit Profile"
//             />
//             <View style={styles.separator} />
//             <MenuItem
//               icon={<Feather name="lock" size={22} color="#333" />}
//               label="Change Password"
//             />
//           </View>

//           {/* Section 2 */}
//           <View style={styles.section}>
//             <MenuItem
//               icon={<Ionicons name="notifications-outline" size={22} color="#333" />}
//               label="Notifications"
//             />
//             <View style={styles.separator} />

//             <MenuItem
//               icon={<Feather name="calendar" size={22} color="#333" />}
//               label="All bookings"
//             />
//             <View style={styles.separator} />

//             <MenuItem
//               icon={
//                 <MaterialCommunityIcons
//                   name="tune-variant"
//                   size={22}
//                   color="#333"
//                 />
//               }
//               label="Preferences"
//             />
//             <View style={styles.separator} />

//             <MenuItem
//               icon={<Feather name="credit-card" size={22} color="#333" />}
//               label="Subscription"
//             />
//             <View style={styles.separator} />

//             <MenuItem
//               icon={<AntDesign name="poweroff" size={20} color="#333" />}
//               label="LogOut"
//             />
//           </View>
//         </SafeAreaView>
//       </View>
//     </ImageBackground>
//   );
// }

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
  AntDesign,
} from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();

  const user = {
    name: 'User name',
    email: 'user_email',
  };

  const MenuItem = ({
    icon,
    label,
    onPress,
  }: {
    icon: React.ReactNode;
    label: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={styles.menuText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={{
        uri: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72',
      }}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {/* Profile Card (also pressable if you want) */}
          <TouchableOpacity
            style={styles.profileCard}
            activeOpacity={0.85}
            // onPress={() => router.push('/profile/edit')}
          >
            <View style={styles.avatar}>
              <Feather name="user" size={42} color="#333" />
            </View>

            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          </TouchableOpacity>

          {/* Section 1 */}
          <View style={styles.section}>
            <MenuItem
              icon={<Feather name="edit-2" size={22} color="#333" />}
              label="Edit Profile"
              // onPress={() => router.push('/profile/edit')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={<Feather name="lock" size={22} color="#333" />}
              label="Change Password"
              onPress={() => router.push('/profile/change_password')}
            />
          </View>

          {/* Section 2 */}
          <View style={styles.section}>
            <MenuItem
              icon={
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color="#333"
                />
              }
              label="Notifications"
              // onPress={() => router.push('/profile/notifications')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={<Feather name="calendar" size={22} color="#333" />}
              label="All bookings"
              // onPress={() => router.push('/profile/bookings')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={
                <MaterialCommunityIcons
                  name="tune-variant"
                  size={22}
                  color="#333"
                />
              }
              label="Preferences"
              // onPress={() => router.push('/profile/preferences')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={<Feather name="credit-card" size={22} color="#333" />}
              label="Subscription"
              // onPress={() => router.push('/profile/subscription')}
            />
            <View style={styles.separator} />

            <MenuItem
              icon={<AntDesign name="poweroff" size={20} color="#333" />}
              label="LogOut"
              onPress={() => router.replace('/login')}
            />
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    justifyContent: 'center',
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 217, 217, 0.9)',
    // backgroundColor: '#d9d9d9',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    alignSelf: 'center',
    width: '95%',
  },

  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  userInfo: {
    flex: 1,
  },

  userName: {
    fontSize: 34,
    fontWeight: '700',
    color: '#222',
    fontFamily: 'serif',
  },

  userEmail: {
    fontSize: 16,
    color: '#444',
    marginTop: -2,
  },

  section: {
    // backgroundColor: '#d9d9d9',
    backgroundColor: 'rgba(217, 217, 217, 0.9)',
    borderRadius: 18,
    marginBottom: 16,
    paddingVertical: 6,
    alignSelf: 'center',
    width: '95%',
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 18,
  },

  menuIcon: {
    width: 28,
    alignItems: 'center',
    marginRight: 14,
  },

  menuText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    fontFamily: 'serif',
  },

  separator: {
    height: 1,
    backgroundColor: '#c2c2c2',
    marginHorizontal: 18,
  },
});
