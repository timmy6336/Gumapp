import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

interface WeekStat {
  week_start: string;
  grid_lat: number;
  grid_lng: number;
  total_reports: number;
  verified_reports: number;
  removed_reports: number;
  most_common_surface: string | null;
}

interface WeeklySummary {
  weekStart: string;
  totalReports: number;
  verifiedReports: number;
  removedReports: number;
  topSurface: string | null;
  cells: number;
}

function aggregateByWeek(rows: WeekStat[]): WeeklySummary[] {
  const byWeek: Record<string, WeeklySummary> = {};
  for (const r of rows) {
    if (!byWeek[r.week_start]) {
      byWeek[r.week_start] = {
        weekStart: r.week_start,
        totalReports: 0,
        verifiedReports: 0,
        removedReports: 0,
        topSurface: r.most_common_surface,
        cells: 0,
      };
    }
    const w = byWeek[r.week_start];
    w.totalReports += r.total_reports;
    w.verifiedReports += r.verified_reports;
    w.removedReports += r.removed_reports;
    w.cells++;
  }
  return Object.values(byWeek).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

export default function TrendsScreen() {
  const [weeks, setWeeks] = useState<WeeklySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadTrends() {
    let lat = 40.7128, lng = -74.006;
    try {
      const loc = await Location.getLastKnownPositionAsync();
      if (loc) { lat = loc.coords.latitude; lng = loc.coords.longitude; }
    } catch { /* use default */ }

    const delta = 0.15; // ~15km radius
    const { data } = await supabase
      .from('neighbourhood_stats')
      .select('*')
      .gte('grid_lat', lat - delta)
      .lte('grid_lat', lat + delta)
      .gte('grid_lng', lng - delta)
      .lte('grid_lng', lng + delta)
      .order('week_start', { ascending: false })
      .limit(200);

    setWeeks(aggregateByWeek(data ?? []));
    setLoading(false);
  }

  useEffect(() => { loadTrends(); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadTrends();
    setRefreshing(false);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#4CAF50" size="large" /></View>;
  }

  const maxReports = Math.max(...weeks.map((w) => w.totalReports), 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4CAF50" />}
    >
      <Text style={styles.title}>Nearby Trends</Text>
      <Text style={styles.subtitle}>Weekly gum activity within ~15km of you</Text>

      {weeks.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No trend data yet.</Text>
          <Text style={styles.emptySubText}>Stats are refreshed weekly. Check back after the first reports come in.</Text>
        </View>
      ) : (
        weeks.map((week) => (
          <View key={week.weekStart} style={styles.weekCard}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>
                Week of {new Date(week.weekStart).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
              </Text>
              {week.topSurface && (
                <Text style={styles.weekSurface}>Top: {week.topSurface}</Text>
              )}
            </View>

            {/* Bar chart row */}
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>New</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(week.totalReports / maxReports) * 100}%` }]} />
              </View>
              <Text style={styles.barValue}>{week.totalReports}</Text>
            </View>
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Verified</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, styles.barFillGreen, { width: `${(week.verifiedReports / maxReports) * 100}%` }]} />
              </View>
              <Text style={styles.barValue}>{week.verifiedReports}</Text>
            </View>
            <View style={styles.barRow}>
              <Text style={styles.barLabel}>Cleaned</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, styles.barFillGray, { width: `${(week.removedReports / maxReports) * 100}%` }]} />
              </View>
              <Text style={styles.barValue}>{week.removedReports}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle: { color: '#555', fontSize: 12, marginBottom: 24 },
  emptyBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  emptyText: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptySubText: { color: '#666', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  weekCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  weekLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
  weekSurface: { color: '#666', fontSize: 12, textTransform: 'capitalize' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barLabel: { color: '#666', fontSize: 11, width: 52 },
  barTrack: { flex: 1, height: 8, backgroundColor: '#2a2a2a', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#ff8800', borderRadius: 4 },
  barFillGreen: { backgroundColor: '#4CAF50' },
  barFillGray: { backgroundColor: '#555' },
  barValue: { color: '#ccc', fontSize: 12, width: 30, textAlign: 'right' },
});
