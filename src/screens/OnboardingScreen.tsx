import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
} from 'react-native';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '🍬',
    title: 'Welcome to GumApp',
    body: 'The world\'s first crowdsourced gum-tracking app. Help map where gum ends up on city streets.',
  },
  {
    icon: '🗺️',
    title: 'See Gum Near You',
    body: 'The map shows every reported piece of gum in your area — updated in real time as people report new ones.',
  },
  {
    icon: '📍',
    title: 'Report What You Find',
    body: 'Spot some gum? Hit the Report tab, take a photo, and pin it. Your GPS location is saved automatically.',
  },
  {
    icon: '✅',
    title: 'Earn Verified Points',
    body: 'Our AI checks your photo to confirm it shows gum. Verified reports count toward your leaderboard score — unverified ones don\'t.',
  },
  {
    icon: '🏆',
    title: 'Climb the Leaderboard',
    body: 'Compete with other gum spotters. Only verified photo reports count. Quality over quantity.',
  },
  {
    icon: '📸',
    title: 'Privacy Note',
    body: 'We store your GPS coordinates and optional photos publicly. Your email is always private. See the Privacy Policy in your Profile.',
  },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const [slide, setSlide] = useState(0);
  const isLast = slide === SLIDES.length - 1;

  function next() {
    if (isLast) {
      onComplete();
    } else {
      setSlide((s) => s + 1);
    }
  }

  const current = SLIDES[slide];

  return (
    <View style={styles.container}>
      <View style={styles.slideArea}>
        <Text style={styles.icon}>{current.icon}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>
      </View>

      {/* Dot indicators */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === slide && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={styles.btn} onPress={next}>
        <Text style={styles.btnText}>{isLast ? 'Get Started' : 'Next'}</Text>
      </TouchableOpacity>

      {!isLast && (
        <TouchableOpacity onPress={onComplete} style={styles.skip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  slideArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    maxWidth: 340,
  },
  icon: { fontSize: 80, marginBottom: 24 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 24,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  dotActive: { backgroundColor: '#4CAF50', width: 20 },
  btn: {
    backgroundColor: '#4CAF50',
    borderRadius: 14,
    paddingHorizontal: 48,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skip: { padding: 12 },
  skipText: { color: '#555', fontSize: 14 },
});
