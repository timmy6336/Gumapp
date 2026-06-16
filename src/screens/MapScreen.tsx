import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  Modal,
  Image,
  Platform,
} from 'react-native';
import MapView, { Marker, Circle, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase, IS_SUPABASE_CONFIGURED } from '../lib/supabase';
import { GumReport } from '../types';

const DEFAULT_REGION: Region = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

// Build a simple density grid for the heatmap view
function buildDensityCells(reports: GumReport[], region: Region) {
  const GRID = 12;
  const latStep = (region.latitudeDelta * 1.5) / GRID;
  const lngStep = (region.longitudeDelta * 1.5) / GRID;
  const cells: Record<string, { lat: number; lng: number; count: number }> = {};

  for (const r of reports) {
    if (r.status === 'removed') continue;
    const row = Math.floor((r.latitude - (region.latitude - region.latitudeDelta)) / latStep);
    const col = Math.floor((r.longitude - (region.longitude - region.longitudeDelta)) / lngStep);
    const key = `${row}:${col}`;
    if (!cells[key]) {
      cells[key] = {
        lat: region.latitude - region.latitudeDelta + row * latStep + latStep / 2,
        lng: region.longitude - region.longitudeDelta + col * lngStep + lngStep / 2,
        count: 0,
      };
    }
    cells[key].count++;
  }
  return Object.values(cells);
}

function heatColor(count: number, max: number): string {
  const t = Math.min(count / Math.max(max, 1), 1);
  if (t < 0.33) return `rgba(255, 200, 0, ${0.3 + t * 0.4})`;
  if (t < 0.66) return `rgba(255, 120, 0, ${0.4 + t * 0.3})`;
  return `rgba(220, 30, 30, ${0.5 + t * 0.3})`;
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [reports, setReports] = useState<GumReport[]>([]);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [selectedReport, setSelectedReport] = useState<GumReport | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED) return;
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
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
        setReports((prev) => prev.map((r) => r.id === payload.new.id ? { ...r, ...payload.new } as GumReport : r));
      })
      .subscribe();
  }

  async function markRemoved(reportId: string) {
    const { error } = await supabase.rpc('mark_report_removed', { p_report_id: reportId });
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setReports((prev) => prev.map((r) => r.id === reportId ? { ...r, status: 'removed' } : r));
    setSelectedReport(null);
  }

  function handleMarkRemoved() {
    if (!selectedReport) return;
    Alert.alert(
      'Mark as cleaned up?',
      'This will remove the marker from the map.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark removed', style: 'destructive', onPress: () => markRemoved(selectedReport.id) },
      ]
    );
  }

  const activeReports = reports.filter((r) => r.status !== 'removed');
  const densityCells = showHeatmap ? buildDensityCells(activeReports, region) : [];
  const maxCount = densityCells.reduce((m, c) => Math.max(m, c.count), 1);
  const cellRadius = Math.max(30, region.latitudeDelta * 3000);

  if (!IS_SUPABASE_CONFIGURED) {
    return (
      <View style={styles.devContainer}>
        <Text style={styles.devIcon}>🗺️</Text>
        <Text style={styles.devTitle}>Map unavailable in dev mode</Text>
        <Text style={styles.devBody}>
          To enable the live map, add these secrets in your GitHub repository settings
          (Settings → Secrets → Actions) and rebuild:
        </Text>
        <Text style={styles.devCode}>
          {'EXPO_PUBLIC_SUPABASE_URL\nEXPO_PUBLIC_SUPABASE_ANON_KEY\nGOOGLE_MAPS_API_KEY'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {showHeatmap
          ? densityCells.map((cell, i) => (
              <Circle
                key={i}
                center={{ latitude: cell.lat, longitude: cell.lng }}
                radius={cellRadius}
                strokeWidth={0}
                fillColor={heatColor(cell.count, maxCount)}
              />
            ))
          : activeReports.map((report) => (
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

      {/* Controls */}
      <View style={styles.topControls}>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{activeReports.length} active</Text>
        </View>
        <TouchableOpacity
          style={[styles.toggleBtn, showHeatmap && styles.toggleBtnActive]}
          onPress={() => setShowHeatmap((v) => !v)}
        >
          <Text style={styles.toggleBtnText}>{showHeatmap ? '🔥 Heatmap' : '📍 Markers'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.locButton} onPress={requestLocation}>
        <Text style={styles.locButtonText}>📍</Text>
      </TouchableOpacity>

      {/* Report detail modal */}
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
              {selectedReport?.surface_type ? `  ·  ${selectedReport.surface_type}` : ''}
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
            <TouchableOpacity style={styles.removeBtn} onPress={handleMarkRemoved}>
              <Text style={styles.removeBtnText}>🧹 Mark as cleaned up</Text>
            </TouchableOpacity>
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
  topControls: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  countText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  toggleBtn: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleBtnActive: { borderColor: '#ff6600', backgroundColor: 'rgba(80,30,0,0.85)' },
  toggleBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
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
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  modalImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 12 },
  noPhotoBox: {
    width: '100%',
    height: 80,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  noPhotoText: { color: '#666', fontSize: 14 },
  modalMeta: { color: '#ccc', fontSize: 14 },
  modalDate: { color: '#666', fontSize: 12, marginTop: 4 },
  removeBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  removeBtnText: { color: '#aaa', fontSize: 13 },
  devContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  devIcon: { fontSize: 64, marginBottom: 20 },
  devTitle: { color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  devBody: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  devCode: {
    color: '#4CAF50',
    fontSize: 12,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 10,
    textAlign: 'left',
    lineHeight: 20,
    width: '100%',
  },
});
