import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useAuth } from './src/hooks/useAuth';
import AppNavigator from './src/navigation/AppNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import EmailVerificationBanner from './src/components/EmailVerificationBanner';

const sentryDsn = Constants.expoConfig?.extra?.sentryDsn;
if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn, tracesSampleRate: 0.2 });
}

function RootApp() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f0f' }}>
        <ActivityIndicator color="#4CAF50" size="large" />
      </View>
    );
  }

  const emailUnverified =
    session && !session.user.email_confirmed_at;

  return (
    <NavigationContainer>
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
