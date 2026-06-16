import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sentry from '@sentry/react-native';
import { supabase, IS_SUPABASE_CONFIGURED } from '../lib/supabase';

const MAX_IMAGE_DIMENSION = 1024;
const GPS_ACCURACY_THRESHOLD_METERS = 20;

async function resizeImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_IMAGE_DIMENSION } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

type SurfaceType = 'sidewalk' | 'road' | 'bench' | 'wall' | 'other';

const SURFACE_OPTIONS: { value: SurfaceType; label: string; icon: string }[] = [
  { value: 'sidewalk', label: 'Sidewalk', icon: '🚶' },
  { value: 'road', label: 'Road', icon: '🚗' },
  { value: 'bench', label: 'Bench', icon: '🪑' },
  { value: 'wall', label: 'Wall', icon: '🧱' },
  { value: 'other', label: 'Other', icon: '📍' },
];

export default function ReportScreen() {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [surfaceType, setSurfaceType] = useState<SurfaceType | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a picture.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  async function submitReport() {
    if (!IS_SUPABASE_CONFIGURED) {
      Alert.alert('Dev mode', 'Submission is disabled — set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to enable.');
      return;
    }
    setLoading(true);
    setLastStatus(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location needed', 'Enable location to report gum.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

      // Reject low-accuracy GPS readings
      if (loc.coords.accuracy && loc.coords.accuracy > GPS_ACCURACY_THRESHOLD_METERS) {
        Alert.alert(
          'GPS signal weak',
          `Your location accuracy is ±${Math.round(loc.coords.accuracy)}m. Move to an open area and try again.`
        );
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to report gum.');
        return;
      }

      // Rate limit check
      const { data: allowed } = await supabase.rpc('check_rate_limit', { p_user_id: user.id });
      if (!allowed) {
        Alert.alert('Slow down', 'You can submit up to 10 reports per hour. Try again later.');
        return;
      }

      // Proximity dedup check
      const { data: hasDuplicate } = await supabase.rpc('check_nearby_report', {
        p_lat: loc.coords.latitude,
        p_lng: loc.coords.longitude,
        p_meters: 10,
      });
      if (hasDuplicate) {
        Alert.alert(
          'Already reported',
          'There is already a gum report within 10 meters of this spot.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Report anyway', onPress: () => doSubmit(user.id, loc) },
          ]
        );
        return;
      }

      await doSubmit(user.id, loc);
    } catch (err: any) {
      Sentry.captureException(err);
      Alert.alert('Error', err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function doSubmit(
    userId: string,
    loc: Location.LocationObject
  ): Promise<void> {
    let photoUrl: string | null = null;

    if (photoUri) {
      // Resize before upload to stay within free storage limits
      const resizedUri = await resizeImage(photoUri);
      const fileName = `${userId}/${Date.now()}.jpg`;

      const response = await fetch(resizedUri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from('gum-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('gum-photos').getPublicUrl(fileName);
      photoUrl = urlData.publicUrl;
    }

    const { data: report, error: insertError } = await supabase
      .from('gum_reports')
      .insert({
        user_id: userId,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        gps_accuracy: loc.coords.accuracy,
        photo_url: photoUrl,
        surface_type: surfaceType,
        is_verified: false,
      })
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    await supabase.rpc('increment_profile_total', { p_user_id: userId });

    if (photoUrl && report) {
      setLastStatus('Verifying photo...');
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-gum', {
        body: { reportId: report.id, photoUrl },
      });

      if (!verifyError && verifyData?.isGum) {
        setLastStatus('✅ Verified! This gum counts toward your score.');
      } else {
        setLastStatus("📷 Photo submitted but couldn't be verified as gum.");
      }
    } else {
      setLastStatus('📍 Report saved! Add a photo next time for it to count toward your score.');
    }

    setPhotoUri(null);
    setLoading(false);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Report Gum</Text>
      <Text style={styles.subtitle}>Found some gum on the street? Report it!</Text>

      <View style={styles.photoSection}>
        {photoUri ? (
          <TouchableOpacity onPress={() => setPhotoUri(null)}>
            <Image source={{ uri: photoUri }} style={styles.preview} />
            <Text style={styles.removePhoto}>Tap to remove</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>No photo selected</Text>
            <Text style={styles.photoPlaceholderSub}>Add a photo to earn verified points</Text>
          </View>
        )}
      </View>

      <View style={styles.photoButtons}>
        <TouchableOpacity style={styles.photoBtn} onPress={takePhoto}>
          <Text style={styles.photoBtnIcon}>📷</Text>
          <Text style={styles.photoBtnText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
          <Text style={styles.photoBtnIcon}>🖼️</Text>
          <Text style={styles.photoBtnText}>Gallery</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.surfaceSection}>
        <Text style={styles.surfaceLabel}>Surface type <Text style={styles.optional}>(optional)</Text></Text>
        <View style={styles.surfaceOptions}>
          {SURFACE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.surfaceBtn, surfaceType === opt.value && styles.surfaceBtnActive]}
              onPress={() => setSurfaceType(surfaceType === opt.value ? null : opt.value)}
            >
              <Text style={styles.surfaceIcon}>{opt.icon}</Text>
              <Text style={[styles.surfaceBtnText, surfaceType === opt.value && styles.surfaceBtnTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {lastStatus && (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>{lastStatus}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
        onPress={submitReport}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitBtnText}>Submit Report</Text>
        )}
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>How scoring works</Text>
        <Text style={styles.infoText}>• Any report adds to your total count</Text>
        <Text style={styles.infoText}>• Only reports with a verified gum photo count toward your leaderboard score</Text>
        <Text style={styles.infoText}>• AI checks your photo to confirm it shows gum</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#888', marginBottom: 28 },
  photoSection: { marginBottom: 16 },
  preview: { width: '100%', height: 220, borderRadius: 16 },
  removePhoto: { color: '#888', fontSize: 12, textAlign: 'center', marginTop: 8 },
  photoPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: { color: '#666', fontSize: 15, fontWeight: '600' },
  photoPlaceholderSub: { color: '#444', fontSize: 12, marginTop: 6 },
  photoButtons: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  photoBtn: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  photoBtnIcon: { fontSize: 28, marginBottom: 6 },
  photoBtnText: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  statusBox: {
    backgroundColor: '#1e2e1e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2e4e2e',
  },
  statusText: { color: '#aaffaa', fontSize: 14 },
  submitBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 28,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  infoTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  infoText: { color: '#888', fontSize: 13, marginBottom: 6 },
  surfaceSection: { marginBottom: 24 },
  surfaceLabel: { color: '#ccc', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  optional: { color: '#555', fontWeight: '400' },
  surfaceOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  surfaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e1e1e',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  surfaceBtnActive: { borderColor: '#4CAF50', backgroundColor: '#1a2a1a' },
  surfaceIcon: { fontSize: 14 },
  surfaceBtnText: { color: '#888', fontSize: 13 },
  surfaceBtnTextActive: { color: '#4CAF50', fontWeight: '700' },
});
