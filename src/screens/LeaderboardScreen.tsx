import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { LeaderboardEntry } from '../types';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
    fetchLeaderboard();
  }, []);

  async function fetchLeaderboard() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, verified_reports, total_reports')
      .order('verified_reports', { ascending: false })
      .limit(50);
    if (!error && data) setEntries(data as LeaderboardEntry[]);
    setLoading(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  }

  function renderItem({ item, index }: { item: LeaderboardEntry; index: number }) {
    const isMe = item.id === currentUserId;
    return (
      <View style={[styles.row, isMe && styles.rowHighlight]}>
        <Text style={styles.rank}>
          {index < 3 ? MEDALS[index] : `#${index + 1}`}
        </Text>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.username.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.username}>{item.username}{isMe ? ' (you)' : ''}</Text>
          <Text style={styles.total}>{item.total_reports} total reports</Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreNumber}>{item.verified_reports}</Text>
          <Text style={styles.scoreLabel}>verified</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4CAF50" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Top gum spotters — verified reports only</Text>
      </View>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4CAF50" />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No reports yet — be the first!</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' },
  header: { padding: 24, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  rowHighlight: {
    borderColor: '#4CAF50',
    backgroundColor: '#1a2a1a',
  },
  rank: { fontSize: 22, width: 40, textAlign: 'center' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  username: { color: '#fff', fontSize: 15, fontWeight: '700' },
  total: { color: '#666', fontSize: 12, marginTop: 2 },
  score: { alignItems: 'flex-end' },
  scoreNumber: { color: '#4CAF50', fontSize: 22, fontWeight: '800' },
  scoreLabel: { color: '#666', fontSize: 11, marginTop: 1 },
  empty: { color: '#666', textAlign: 'center', marginTop: 60, fontSize: 15 },
});
