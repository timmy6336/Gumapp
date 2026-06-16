import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || '';

// True when the app was built with real Supabase credentials.
// False in dev/test builds without env vars — auth is skipped and
// Supabase calls fail gracefully (network error) rather than crashing.
export const IS_SUPABASE_CONFIGURED = Boolean(supabaseUrl);

export const supabase = createClient(
  // Fall back to a syntactically-valid placeholder so createClient never
  // throws on URL construction when credentials are absent.
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
