import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setProfile(data as Profile);
      setNewUsername(data.username);
      fetchRank(data.verified_reports);
    }
    setLoading(false);
  }, []);

  async function fetchRank(verifiedCount: number) {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gt('verified_reports', verifiedCount);
    setRank((count ?? 0) + 1);
  }

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }

  async function saveUsername() {
    if (newUsername.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ username: newUsername })
      .eq('id', user.id);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setProfile((prev) => prev ? { ...prev, username: newUsername } : prev);
      setEditingUsername(false);
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#4CAF50" size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#4CAF50" />}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.username?.charAt(0).toUpperCase() ?? '?'}
          </Text>
        </View>
        {editingUsername ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.usernameInput}
              value={newUsername}
              onChangeText={setNewUsername}
              autoFocus
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={saveUsername} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingUsername(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditingUsername(true)}>
            <Text style={styles.username}>{profile?.username ?? 'Unknown'} ✏️</Text>
          </TouchableOpacity>
        )}
        {rank !== null && (
          <Text style={styles.rankBadge}>
            {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`} on leaderboard
          </Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{profile?.total_reports ?? 0}</Text>
          <Text style={styles.statLabel}>Total Reports</Text>
        </View>
        <View style={[styles.statCard, styles.statCardGreen]}>
          <Text style={[styles.statNumber, styles.statNumberGreen]}>
            {profile?.verified_reports ?? 0}
          </Text>
          <Text style={styles.statLabel}>Verified ✅</Text>
        </View>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Verification rate</Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: profile && profile.total_reports > 0
                  ? `${Math.round((profile.verified_reports / profile.total_reports) * 100)}%`
                  : '0%',
              },
            ]}
          />
        </View>
        <Text style={styles.infoText}>
          {profile && profile.total_reports > 0
            ? `${Math.round((profile.verified_reports / profile.total_reports) * 100)}% of your reports have verified photos`
            : 'Start reporting gum to build your score!'}
        </Text>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' },
  content: { padding: 24, paddingBottom: 40 },
  avatarContainer: { alignItems: 'center', marginBottom: 32 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: { color: '#fff', fontSize: 38, fontWeight: '800' },
  username: { color: '#fff', fontSize: 22, fontWeight: '700' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  usernameInput: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    borderBottomWidth: 2,
    borderColor: '#4CAF50',
    paddingVertical: 4,
    minWidth: 120,
  },
  saveBtn: { backgroundColor: '#4CAF50', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  cancelBtn: { padding: 6 },
  cancelBtnText: { color: '#888', fontSize: 16 },
  rankBadge: { color: '#888', fontSize: 14, marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 14, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statCardGreen: { borderColor: '#2a4a2a', backgroundColor: '#1a2a1a' },
  statNumber: { color: '#fff', fontSize: 36, fontWeight: '800' },
  statNumberGreen: { color: '#4CAF50' },
  statLabel: { color: '#888', fontSize: 13, marginTop: 4 },
  infoBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  infoTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  progressBar: {
    height: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 4 },
  infoText: { color: '#888', fontSize: 13 },
  signOutBtn: {
    borderWidth: 1,
    borderColor: '#ff4444',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  signOutText: { color: '#ff4444', fontSize: 15, fontWeight: '700' },
});
