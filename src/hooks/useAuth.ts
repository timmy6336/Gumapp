import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, IS_SUPABASE_CONFIGURED } from '../lib/supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!IS_SUPABASE_CONFIGURED) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}
