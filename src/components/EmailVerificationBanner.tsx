import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

export default function EmailVerificationBanner() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      await supabase.auth.resend({ type: 'signup', email: user.email });
    }
    setSending(false);
    setSent(true);
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        📧 Please verify your email address to unlock all features.
      </Text>
      {!sent ? (
        <TouchableOpacity onPress={resend} disabled={sending} style={styles.btn}>
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>Resend email</Text>
          )}
        </TouchableOpacity>
      ) : (
        <Text style={styles.sent}>Email sent ✓</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#2a2000',
    borderBottomWidth: 1,
    borderColor: '#4a3800',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: { color: '#ffcc44', fontSize: 12, flex: 1 },
  btn: {
    backgroundColor: '#4a3800',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btnText: { color: '#ffcc44', fontSize: 12, fontWeight: '700' },
  sent: { color: '#4CAF50', fontSize: 12, fontWeight: '700' },
});
