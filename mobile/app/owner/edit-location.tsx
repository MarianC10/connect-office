import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import {
  deleteOwnerLocationImage,
  fetchAmenities,
  fetchOwnerLocation,
  updateOwnerLocation,
  uploadOwnerLocationImage,
  type AmenityCatalogItem,
  type LocationImage,
} from '@/lib/owner';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BG_IMAGE = require('@/assets/images/login_signup_background.jpg');

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
  weekdayOpen: string;
  weekdayClose: string;
  weekendOpen: string;
  weekendClose: string;
};

export default function EditLocationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const locationId = typeof id === 'string' ? id : '';

  const [draft, setDraft] = useState<LocationDraft>({
    officeName: '',
    description: '',
    weekdayOpen: '09:00',
    weekdayClose: '18:00',
    weekendOpen: '10:00',
    weekendClose: '16:00',
  });
  const [amenities, setAmenities] = useState<AmenityCatalogItem[]>([]);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const [images, setImages] = useState<LocationImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [catalog, loc] = await Promise.all([
        fetchAmenities(),
        fetchOwnerLocation(locationId),
      ]);
      setAmenities(catalog);
      setDraft({
        officeName: loc.name,
        description: loc.description,
        weekdayOpen: loc.weekday_open ?? '09:00',
        weekdayClose: loc.weekday_close ?? '18:00',
        weekendOpen: loc.weekend_open ?? '10:00',
        weekendClose: loc.weekend_close ?? '16:00',
      });
      setSelectedAmenityIds(loc.amenity_ids);
      setImages(loc.images ?? []);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load location');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [locationId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateField = (field: keyof LocationDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const toggleAmenity = (amenityId: string) => {
    setSelectedAmenityIds((current) =>
      current.includes(amenityId)
        ? current.filter((item) => item !== amenityId)
        : [...current, amenityId]
    );
  };

  const handlePickImages = async () => {
    if (!locationId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });

    if (!result.canceled) {
      try {
        for (const asset of result.assets) {
          const uploaded = await uploadOwnerLocationImage(
            locationId,
            asset.uri,
            asset.mimeType ?? 'image/jpeg'
          );
          setImages((current) => [...current, uploaded]);
        }
      } catch (e) {
        Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload image');
      }
    }
  };

  const handleRemoveImage = async (image: LocationImage) => {
    if (!locationId) return;
    try {
      await deleteOwnerLocationImage(locationId, image.id);
      setImages((current) => current.filter((img) => img.id !== image.id));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not remove image');
    }
  };

  const handleSave = async () => {
    if (!locationId) return;
    if (!draft.officeName.trim()) {
      Alert.alert('Missing name', 'Enter an office name.');
      return;
    }
    setSaving(true);
    try {
      await updateOwnerLocation(locationId, {
        name: draft.officeName.trim(),
        description: draft.description.trim(),
        weekday_open: draft.weekdayOpen.trim(),
        weekday_close: draft.weekdayClose.trim(),
        weekend_open: draft.weekendOpen.trim(),
        weekend_close: draft.weekendClose.trim(),
        amenity_ids: selectedAmenityIds,
        images,
      });
      Alert.alert('Saved', 'Location updated successfully.');
      router.back();
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#132457" />
      </View>
    );
  }

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

              <Text style={styles.title}>Edit Location</Text>

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

              <FormSection title="Working hours">
                <Text style={styles.hoursLabel}>Weekdays (Mon–Fri)</Text>
                <View style={styles.hoursRow}>
                  <TextInput
                    value={draft.weekdayOpen}
                    onChangeText={(value) => updateField('weekdayOpen', value)}
                    style={styles.hoursInput}
                    placeholder="09:00"
                    placeholderTextColor={C.textMuted}
                  />
                  <Text style={styles.hoursDash}>–</Text>
                  <TextInput
                    value={draft.weekdayClose}
                    onChangeText={(value) => updateField('weekdayClose', value)}
                    style={styles.hoursInput}
                    placeholder="18:00"
                    placeholderTextColor={C.textMuted}
                  />
                </View>
                <Text style={styles.hoursLabel}>Weekends (Sat–Sun)</Text>
                <View style={styles.hoursRow}>
                  <TextInput
                    value={draft.weekendOpen}
                    onChangeText={(value) => updateField('weekendOpen', value)}
                    style={styles.hoursInput}
                    placeholder="10:00"
                    placeholderTextColor={C.textMuted}
                  />
                  <Text style={styles.hoursDash}>–</Text>
                  <TextInput
                    value={draft.weekendClose}
                    onChangeText={(value) => updateField('weekendClose', value)}
                    style={styles.hoursInput}
                    placeholder="16:00"
                    placeholderTextColor={C.textMuted}
                  />
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
                    {images.map((img) => (
                      <View key={img.id} style={styles.imageTileWrapper}>
                        <Image source={{ uri: img.url }} style={styles.imageTile} />
                        <TouchableOpacity
                          style={styles.imageRemoveBtn}
                          onPress={() => handleRemoveImage(img)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close-circle" size={20} color={C.white} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </FormSection>

              <FormSection title="Amenities" compact>
                <View style={styles.amenitiesGrid}>
                  {amenities.map((amenity) => {
                    const selected = selectedAmenityIds.includes(amenity.id);
                    return (
                      <TouchableOpacity
                        key={amenity.id}
                        activeOpacity={0.78}
                        style={[styles.amenityChip, selected && styles.amenityChipSelected]}
                        onPress={() => toggleAmenity(amenity.id)}
                      >
                        <Text style={[styles.amenityText, selected && styles.amenityTextSelected]}>
                          {amenity.name}
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
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Text>
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
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
  },
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
  hoursLabel: {
    color: C.textSub,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  hoursInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0E0E0',
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 14,
    textAlign: 'center',
  },
  hoursDash: {
    color: C.textSub,
    fontSize: 16,
    fontWeight: '700',
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