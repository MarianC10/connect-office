import React, { useState } from 'react';
import {
  Dimensions,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BG_IMAGE = require('@/assets/images/login_signup_background.jpg');

const C = {
  glassBgStrong: 'rgba(255, 255, 255, 0.32)',
  text: '#12122A',
  textSub: '#38385E',
  textMuted: '#6f6f84',
  accentDark: '#132457',
  white: '#FFFFFF',
} as const;

// Replace with real data fetched from your backend
const MOCK_COMPANY = {
  companyName: 'Acme Workspaces SRL',
  email: 'contact@acmeworkspaces.ro',
  description:
    'We provide modern, flexible coworking spaces across Romania, designed for freelancers, startups, and enterprise teams alike.',
  address: 'Str. Universitatii 10',
  city: 'Cluj-Napoca',
  county: 'Cluj',
  country: 'Romania',
};

export default function CompanyInformationScreen() {
  const router = useRouter();
  const company = MOCK_COMPANY;

  return (
    <ImageBackground
      source={BG_IMAGE}
      style={styles.bgImage}
      resizeMode="cover"
      blurRadius={1.2}
    >
      <View style={styles.bgOverlay} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.75}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={C.white} />
            </TouchableOpacity>

            <Text style={styles.title}>Company Information</Text>

            <View style={styles.iconButton} />
          </View>

          <View style={styles.formCard}>

            {/* Company Avatar */}
            <View style={styles.avatarBlock}>
              <View style={styles.avatarCircle}>
                <MaterialCommunityIcons name="office-building-outline" size={40} color="#333" />
              </View>
            </View>

            {/* BASIC INFORMATION */}
            <DisplaySection title="Basic Information">
              <InfoRow
                icon={<MaterialCommunityIcons name="office-building-outline" size={20} color={C.accentDark} />}
                label="Company Name"
                value={company.companyName}
              />
              <InfoRow
                icon={<Feather name="mail" size={20} color={C.accentDark} />}
                label="Email"
                value={company.email}
              />
              <InfoRow
                icon={<Feather name="file-text" size={20} color={C.accentDark} />}
                label="Description"
                value={company.description}
              />
            </DisplaySection>

            {/* LOCATION */}
            <DisplaySection title="Location">
              <InfoRow
                icon={<Feather name="map-pin" size={20} color={C.accentDark} />}
                label="Address"
                value={company.address}
              />
              <InfoRow
                icon={<Ionicons name="location-outline" size={20} color={C.accentDark} />}
                label="City"
                value={company.city}
              />
              <InfoRow
                icon={<Ionicons name="map-outline" size={20} color={C.accentDark} />}
                label="County"
                value={company.county}
              />
              <InfoRow
                icon={<MaterialCommunityIcons name="earth" size={20} color={C.accentDark} />}
                label="Country"
                value={company.country}
                last
              />
            </DisplaySection>

          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

function DisplaySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        {children}
      </View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <>
      <View style={styles.infoRow}>
        <View style={styles.infoIcon}>{icon}</View>
        <View style={styles.infoText}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue}>{value}</Text>
        </View>
      </View>
      {!last && <View style={styles.separator} />}
    </>
  );
}

const styles = StyleSheet.create({
  bgImage: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 120,
  },
  headerRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: C.white,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
    fontFamily: 'serif',
  },

  avatarBlock: {
    alignItems: 'center',
    marginBottom: 20,
    },

  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 217, 217, 0.9)',
    overflow: 'hidden',
  },

  formCard: {
    borderRadius: 30,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: C.white,
    fontSize: 19,
    fontWeight: '800',
    fontFamily: 'serif',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  sectionCard: {
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoIcon: {
    width: 28,
    alignItems: 'center',
    marginRight: 12,
    paddingTop: 2,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textMuted,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: C.text,
    lineHeight: 22,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.07)',
    marginHorizontal: 16,
  },
});