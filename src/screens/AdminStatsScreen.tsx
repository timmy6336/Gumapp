import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';

interface Stats {
  totalReports: number;
  activeReports: number;
  removedReports: number;
  verifiedReports: number;
  withPhoto: number;
  totalUsers: number;
  bySurface: Record<string, { total: number; verified: number }>;
}

export default function AdminStatsScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadStats() {
    const [reportsRes, profilesRes] = await Promise.all([
      supabase.from('gum_reports').select('status, is_verified, photo_url, surface_type'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ]);

    const reports = reportsRes.data ?? [];
    const bySurface: Record<string, { total: number; verified: number }> = {};

    let active = 0, removed = 0, verified = 0, withPhoto = 0;

    for (const r of reports) {
      if (r.status === 'active') active++;
      else removed++;
      if (r.is_verified) verified++;
      if (r.photo_url) withPhoto++;

      const surf = r.surface_type ?? 'unknown';
      if (!bySurface[surf]) bySurface[surf] = { total: 0, verified: 0 };
      bySurface[surf].total++;
      if (r.is_verified) bySurface[surf].verified++;
    }

    setStats({
      totalReports: reports.length,
      activeReports: active,
      removedReports: removed,
      verifiedReports: verified,
      withPhoto,
      totalUsers: profilesRes.count ?? 0,
      bySurface,
    });
    setLoading(false);
  }

  useEffect(() => { loadStats(); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#4CAF50" size="large" /></View>;
  }

  const verifyRate = stats && stats.totalReports > 0
    ? Math.round((stats.verifiedReports / stats.totalReports) * 100)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4CAF50" />}
    >
      <Text style={styles.title}>Admin Stats</Text>
      <Text style={styles.subtitle}>Pull down to refresh</Text>

      <View style={styles.grid}>
        <StatCard label="Total Reports" value={stats?.totalReports ?? 0} />
        <StatCard label="Active" value={stats?.activeReports ?? 0} color="#4CAF50" />
        <StatCard label="Removed" value={stats?.removedReports ?? 0} color="#888" />
        <StatCard label="Verified" value={stats?.verifiedReports ?? 0} color="#4CAF50" />
        <StatCard label="With Photo" value={stats?.withPhoto ?? 0} />
        <StatCard label="Users" value={stats?.totalUsers ?? 0} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verification rate</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${verifyRate}%` }]} />
        </View>
        <Text style={styles.sectionSub}>{verifyRate}% of all reports have verified photos</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>By surface type</Text>
        {Object.entries(stats?.bySurface ?? {})
          .sort((a, b) => b[1].total - a[1].total)
          .map(([surface, counts]) => (
            <View key={surface} style={styles.surfaceRow}>
              <Text style={styles.surfaceName}>{surface}</Text>
              <Text style={styles.surfaceCount}>{counts.total} reports</Text>
              <Text style={styles.surfaceVerified}>{counts.verified} verified</Text>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.card}>
      <Text style={[styles.cardValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
  subtitle: { color: '#555', fontSize: 12, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  card: {
    width: '30%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardValue: { color: '#fff', fontSize: 28, fontWeight: '800' },
  cardLabel: { color: '#666', fontSize: 11, marginTop: 4, textAlign: 'center' },
  section: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  sectionSub: { color: '#666', fontSize: 12, marginTop: 8 },
  progressBar: { height: 8, backgroundColor: '#2a2a2a', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
  surfaceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#222' },
  surfaceName: { color: '#ccc', flex: 1, fontWeight: '600', textTransform: 'capitalize' },
  surfaceCount: { color: '#888', fontSize: 13, marginRight: 12 },
  surfaceVerified: { color: '#4CAF50', fontSize: 13, fontWeight: '600' },
});
