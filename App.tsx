import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useAuth } from './src/hooks/useAuth';
import { useOnboarding } from './src/hooks/useOnboarding';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import AppNavigator from './src/navigation/AppNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import EmailVerificationBanner from './src/components/EmailVerificationBanner';

const sentryDsn = Constants.expoConfig?.extra?.sentryDsn;
if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn, tracesSampleRate: 0.2 });
}

// Deep link configuration
const linking = {
  prefixes: ['gumapp://', 'https://gumapp.io'],
  config: {
    screens: {
      Map: 'map',
      Report: 'report',
      Leaderboard: 'leaderboard',
      Profile: 'profile',
    },
  },
};

function RootApp() {
  const { session, loading } = useAuth();
  const { showOnboarding, checked, completeOnboarding } = useOnboarding();

  usePushNotifications(session?.user.id ?? null);

  if (loading || !checked) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' }}>
        <ActivityIndicator color="#4CAF50" size="large" />
      </View>
    );
  }

  // Show onboarding once regardless of auth state
  if (showOnboarding) {
    return (
      <NavigationContainer linking={linking}>
        <StatusBar style="light" />
        <OnboardingScreen onComplete={completeOnboarding} />
      </NavigationContainer>
    );
  }

  const emailUnverified = session && !session.user.email_confirmed_at;

  return (
    <NavigationContainer linking={linking}>
      <StatusBar style="light" />
      {session ? (
        <>
          {emailUnverified && <EmailVerificationBanner />}
          <AppNavigator />
        </>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}

export default Sentry.wrap(RootApp);
