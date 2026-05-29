import React from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface Props {
  onClose?: () => void;
}

export default function PrivacyPolicyScreen({ onClose }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updated}>Last updated: May 2025</Text>

      <Text style={styles.section}>1. What we collect</Text>
      <Text style={styles.body}>
        <Text style={styles.bold}>Location data:</Text> When you submit a gum report, we record your precise GPS coordinates and accuracy. This data is stored permanently and displayed publicly on the map.{'\n\n'}
        <Text style={styles.bold}>Photos:</Text> If you attach a photo to a report, it is uploaded to our servers and may be displayed publicly on the map. Photos are processed by an AI service (Anthropic Claude) to verify they show gum.{'\n\n'}
        <Text style={styles.bold}>Account data:</Text> We store your email address and chosen username. Your email is never displayed publicly.
      </Text>

      <Text style={styles.section}>2. How we use your data</Text>
      <Text style={styles.body}>
        • To display gum reports on the public map{'\n'}
        • To maintain your leaderboard score and profile{'\n'}
        • To detect duplicate reports and prevent spam{'\n'}
        • To improve the accuracy and quality of the dataset{'\n'}
        • Aggregate, anonymised data may be shared with municipalities or researchers
      </Text>

      <Text style={styles.section}>3. Who can see your data</Text>
      <Text style={styles.body}>
        Your username and report locations are visible to all app users. Your email address is private. Individual reports are linked to your username publicly.
      </Text>

      <Text style={styles.section}>4. Data retention</Text>
      <Text style={styles.body}>
        Report data is retained indefinitely to maintain the integrity of the dataset. You may request deletion of your account and associated reports by contacting us.
      </Text>

      <Text style={styles.section}>5. Third-party services</Text>
      <Text style={styles.body}>
        We use Supabase for database and file storage, and Anthropic's Claude API for photo verification. Both services have their own privacy policies. Your photos may be sent to Anthropic's API for processing.
      </Text>

      <Text style={styles.section}>6. Your rights</Text>
      <Text style={styles.body}>
        You have the right to access, correct, or request deletion of your personal data. Contact us at privacy@gumapp.io to exercise these rights.
      </Text>

      <Text style={styles.section}>7. Contact</Text>
      <Text style={styles.body}>privacy@gumapp.io</Text>

      {onClose && (
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>Close</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 4 },
  updated: { color: '#555', fontSize: 12, marginBottom: 28 },
  section: { color: '#4CAF50', fontSize: 15, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  body: { color: '#ccc', fontSize: 14, lineHeight: 22 },
  bold: { fontWeight: '700', color: '#fff' },
  closeBtn: {
    marginTop: 36,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  closeBtnText: { color: '#ccc', fontWeight: '700' },
});
