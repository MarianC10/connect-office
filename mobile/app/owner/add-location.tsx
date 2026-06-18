import React, { useState } from 'react';
import {
  Dimensions,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BG_IMAGE = require('@/assets/images/login_signup_background.jpg');

const COUNTRIES = [
  'Romania', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands',
  'Belgium', 'Austria', 'Poland', 'Czech Republic', 'Hungary', 'Portugal',
  'Sweden', 'Denmark', 'Norway', 'Finland', 'Switzerland', 'Greece',
];

const AMENITIES = [
  'Wi-Fi', 'Parking', 'Coffee', 'Meeting Room',
  'Air Conditioning', 'Printer', 'Kitchen', '24/7 Access',
];

const C = {
  glassBgStrong: 'rgba(255, 255, 255, 0.32)',
  inputGreyDark: 'rgba(217, 217, 217, 0.78)',
  text: '#12122A',
  textSub: '#38385E',
  textMuted: '#6f6f84',
  accentDark: '#132457',
  white: '#FFFFFF',
} as const;

const CARD_PADDING = 14;
const TILE_GAP = 8;
const TILE_SIZE = (SCREEN_WIDTH - 36 - CARD_PADDING * 2 - TILE_GAP * 2) / 3;

type LocationDraft = {
  officeName: string;
  description: string;
  address: string;
  city: string;
  county: string;
  country: string;
};

export default function AddLocationScreen() {
  const router = useRouter();

  const [draft, setDraft] = useState<LocationDraft>({
    officeName: '',
    description: '',
    address: '',
    city: '',
    county: '',
    country: 'Romania',
  });

  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const updateField = (field: keyof LocationDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity]
    );
  };

  const handlePickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 20,
    });

    if (!result.canceled) {
      const newUris = result.assets.map((a) => a.uri);
      setImages((current) => [...current, ...newUris]);
    }
  };

  const handleRemoveImage = (uri: string) => {
    setImages((current) => current.filter((img) => img !== uri));
  };

  const handleSave = () => {
    Alert.alert(
      'Pentru MARIAN',
      'The form is ready, but make the database connection :(((((.'
    );
  };

  return (
    <ImageBackground
      source={BG_IMAGE}
      style={styles.bgImage}
      resizeMode="cover"
      blurRadius={1.2}
    >
      <View style={styles.bgOverlay} />

      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.iconButton}
                activeOpacity={0.75}
                onPress={() => router.back()}
              >
                <Ionicons name="arrow-back" size={24} color={C.white} />
              </TouchableOpacity>

              <Text style={styles.title}>Add Location</Text>

              <View style={styles.iconButton} />
            </View>

            <View style={styles.formCard}>

              <FormSection title="Basic Information">
                <FieldLabel>Office Name</FieldLabel>
                <TextInput
                  value={draft.officeName}
                  onChangeText={(value) => updateField('officeName', value)}
                  style={styles.input}
                  placeholder="Enter office name"
                  placeholderTextColor={C.textSub}
                  autoCapitalize="words"
                />

                <FieldLabel>Description</FieldLabel>
                <View style={styles.descriptionWrapper}>
                  <TextInput
                    value={draft.description}
                    onChangeText={(value) => updateField('description', value)}
                    style={styles.descriptionInput}
                    onFocus={() => setDescriptionFocused(true)}
                    onBlur={() => setDescriptionFocused(false)}
                    multiline
                    textAlignVertical="center"
                  />
                  {!draft.description && !descriptionFocused && (
                    <Text style={styles.descriptionPlaceholder}>Enter description</Text>
                  )}
                </View>
              </FormSection>

              <FormSection title="Images">
                <TouchableOpacity
                  style={styles.imageAddButton}
                  activeOpacity={0.78}
                  onPress={handlePickImages}
                >
                  <Ionicons name="images-outline" size={28} color={C.accentDark} />
                  <Text style={styles.imageAddText}>Tap to add photos</Text>
                </TouchableOpacity>

                {images.length > 0 && (
                  <View style={styles.imageGrid}>
                    {images.map((uri) => (
                      <View key={uri} style={styles.imageTileWrapper}>
                        <Image source={{ uri }} style={styles.imageTile} />
                        <TouchableOpacity
                          style={styles.imageRemoveBtn}
                          onPress={() => handleRemoveImage(uri)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle" size={20} color={C.white} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </FormSection>

              <FormSection title="Location">
                <FieldLabel>Address</FieldLabel>
                <TextInput
                  value={draft.address}
                  onChangeText={(value) => updateField('address', value)}
                  style={styles.input}
                  placeholder="Enter address"
                  placeholderTextColor={C.textSub}
                  autoCapitalize="words"
                />

                <View style={styles.twoColumnRow}>
                  <View style={styles.halfField}>
                    <FieldLabel>City</FieldLabel>
                    <TextInput
                      value={draft.city}
                      onChangeText={(value) => updateField('city', value)}
                      style={styles.input}
                      placeholder="Enter city"
                      placeholderTextColor={C.textSub}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={styles.halfField}>
                    <FieldLabel>County</FieldLabel>
                    <TextInput
                      value={draft.county}
                      onChangeText={(value) => updateField('county', value)}
                      style={styles.input}
                      placeholder="Enter county"
                      placeholderTextColor={C.textSub}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <FieldLabel>Country</FieldLabel>
                <TouchableOpacity
                  style={styles.selectInput}
                  activeOpacity={0.8}
                  onPress={() => setCountryPickerVisible((v) => !v)}
                >
                  <Text style={[styles.selectText, { color: C.accentDark }]}>{draft.country}</Text>
                  <Ionicons
                    name={countryPickerVisible ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={C.textMuted}
                  />
                </TouchableOpacity>

                {countryPickerVisible && (
                  <View style={styles.countryDropdown}>
                    {COUNTRIES.map((country) => {
                      const selected = draft.country === country;
                      return (
                        <TouchableOpacity
                          key={country}
                          style={[styles.countryOption, selected && styles.countryOptionSelected]}
                          activeOpacity={0.75}
                          onPress={() => {
                            updateField('country', country);
                            setCountryPickerVisible(false);
                          }}
                        >
                          <Text style={[styles.countryOptionText, selected && styles.countryOptionTextSelected]}>
                            {country}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </FormSection>

              <FormSection title="Amenities" compact>
                <View style={styles.amenitiesGrid}>
                  {AMENITIES.map((amenity) => {
                    const selected = selectedAmenities.includes(amenity);
                    return (
                      <TouchableOpacity
                        key={amenity}
                        activeOpacity={0.78}
                        style={[styles.amenityChip, selected && styles.amenityChipSelected]}
                        onPress={() => toggleAmenity(amenity)}
                      >
                        <Text style={[styles.amenityText, selected && styles.amenityTextSelected]}>
                          {amenity}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </FormSection>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.saveButton}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Save Location</Text>
              </TouchableOpacity>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

function FormSection({
  title,
  compact = false,
  children,
}: {
  title: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, compact && styles.sectionCompact]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
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
  safe: { flex: 1 },
  keyboardView: { flex: 1 },
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
  section: { marginBottom: 20 },
  sectionCompact: { marginBottom: 18 },
  sectionTitle: {
    color: C.white,
    fontSize: 19,
    fontWeight: '800',
    fontFamily: 'serif',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  label: {
    color: 'rgba(255,255,255,0.90)',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 13 : 9,
    marginBottom: 12,
  },
  descriptionWrapper: {
    width: '100%',
    minHeight: 50,
    marginBottom: 12,
    justifyContent: 'center',
  },
  descriptionInput: {
    width: '100%',
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 16 : 14,
    paddingBottom: Platform.OS === 'ios' ? 10 : 6,
  },
  descriptionPlaceholder: {
    position: 'absolute',
    left: 15,
    color: C.textSub,
    fontSize: 14,
    fontWeight: '700',
    pointerEvents: 'none',
  },
  imageAddButton: {
    width: '100%',
    height: 60,
    borderRadius: 18,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  imageAddText: {
    color: C.accentDark,
    fontSize: 13,
    fontWeight: '700',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  imageTileWrapper: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: TILE_GAP,
    marginBottom: TILE_GAP,
  },
  imageTile: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfField: { flex: 1 },
  selectInput: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginBottom: 4,
  },
  selectText: {
    fontSize: 14,
    fontWeight: '700',
  },
  countryDropdown: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginTop: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  countryOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: C.glassBgStrong,
  },
  countryOptionSelected: {
    backgroundColor: C.accentDark,
  },
  countryOptionText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    fontWeight: '700',
  },
  countryOptionTextSelected: {
    color: C.white,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    minWidth: 88,
    minHeight: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: C.glassBgStrong,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  amenityChipSelected: {
    backgroundColor: C.accentDark,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  amenityText: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    fontWeight: '800',
  },
  amenityTextSelected: {
    color: C.white,
  },
  saveButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: C.accentDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  saveButtonText: {
    color: C.white,
    fontSize: 15,
    fontWeight: '800',
  },
});