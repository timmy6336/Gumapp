import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { GumReport } from '../types';

const DEFAULT_REGION: Region = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [reports, setReports] = useState<GumReport[]>([]);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [locationReady, setLocationReady] = useState(false);
  const [selectedReport, setSelectedReport] = useState<GumReport | null>(null);

  useEffect(() => {
    requestLocation();
    fetchReports();
    const sub = subscribeToReports();
    return () => { sub.unsubscribe(); };
  }, []);

  async function requestLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location needed', 'Enable location to see gum near you.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const newRegion: Region = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setRegion(newRegion);
    setLocationReady(true);
    mapRef.current?.animateToRegion(newRegion, 800);
  }

  async function fetchReports() {
    const { data, error } = await supabase
      .from('gum_reports')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && data) setReports(data as GumReport[]);
  }

  function subscribeToReports() {
    return supabase
      .channel('gum_reports_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gum_reports' }, (payload) => {
        setReports((prev) => [payload.new as GumReport, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gum_reports' }, (payload) => {
        setReports((prev) => prev.map((r) => r.id === payload.new.id ? payload.new as GumReport : r));
      })
      .subscribe();
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {reports.map((report) => (
          <Marker
            key={report.id}
            coordinate={{ latitude: report.latitude, longitude: report.longitude }}
            onPress={() => setSelectedReport(report)}
          >
            <View style={[styles.markerContainer, report.is_verified && styles.markerVerified]}>
              <Text style={styles.markerText}>🍬</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <TouchableOpacity style={styles.locButton} onPress={requestLocation}>
        <Text style={styles.locButtonText}>📍</Text>
      </TouchableOpacity>

      <View style={styles.countBadge}>
        <Text style={styles.countText}>{reports.length} reports</Text>
      </View>

      <Modal
        visible={!!selectedReport}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReport(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedReport(null)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {selectedReport?.is_verified ? '✅ Verified Gum' : '📍 Unverified Report'}
            </Text>
            {selectedReport?.photo_url ? (
              <Image source={{ uri: selectedReport.photo_url }} style={styles.modalImage} />
            ) : (
              <View style={styles.noPhotoBox}>
                <Text style={styles.noPhotoText}>No photo</Text>
              </View>
            )}
            <Text style={styles.modalMeta}>
              Reported by {selectedReport?.profiles?.username ?? 'Unknown'}
            </Text>
            <Text style={styles.modalDate}>
              {selectedReport?.created_at
                ? new Date(selectedReport.created_at).toLocaleDateString()
                : ''}
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  markerContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: '#ccc',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  markerVerified: { borderColor: '#4CAF50' },
  markerText: { fontSize: 18 },
  locButton: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: '#fff',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  locButtonText: { fontSize: 22 },
  countBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 12 },
  noPhotoBox: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  noPhotoText: { color: '#666', fontSize: 14 },
  modalMeta: { color: '#ccc', fontSize: 14 },
  modalDate: { color: '#666', fontSize: 12, marginTop: 4 },
});
