import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'GumApp',
  slug: 'gumapp',
  scheme: 'gumapp',
  android: {
    ...config.android,
    config: {
      googleMaps: {
        // Set GOOGLE_MAPS_API_KEY in your .env.local or as a GitHub Actions secret.
        // Without it the map tiles still load on most devices, but you'll see a
        // "This app is not authorized to use Google Maps" watermark.
        apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
      },
    },
  },
  plugins: [
    ...(config.plugins ?? []),
    [
      'expo-location',
      { locationWhenInUsePermission: 'GumApp needs your location to show gum near you.' },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'GumApp needs photo access to attach pictures to reports.',
        cameraPermission: 'GumApp needs camera access to photograph gum.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#4CAF50',
        sounds: [],
      },
    ],
    // Uncomment once you have a Sentry project:
    // ['@sentry/react-native/expo', { organization: 'your-org', project: 'gumapp' }],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '' },
  },
});
