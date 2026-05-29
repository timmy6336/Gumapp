import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'GumApp',
  slug: 'gumapp',
  plugins: [
    ...(config.plugins ?? []),
    // Uncomment once you have a Sentry project:
    // ['@sentry/react-native/expo', { organization: 'your-org', project: 'gumapp' }],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  },
});
