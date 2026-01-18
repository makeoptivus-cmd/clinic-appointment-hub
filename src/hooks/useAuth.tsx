import React from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

type AuthEventLog = { time: string; event: string; hasUser: boolean }

export function useAuthDiagnostics() {
  const [sessionUserId, setSessionUserId] = React.useState<string | null>(null)
  const [lastEvent, setLastEvent] = React.useState<AuthEventLog | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const envOk = React.useMemo(() => {
    const url = (import.meta as any).env?.VITE_SUPABASE_URL
    const key = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY
    return Boolean(url && key)
  }, [])

  React.useEffect(() => {
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        setSessionUserId(data.session?.user?.id ?? null)
      } catch (e: any) {
        setError(e?.message ?? 'Failed to get session')
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setLastEvent({ time: new Date().toISOString(), event, hasUser: Boolean(session?.user) })
      setSessionUserId(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { envOk, sessionUserId, lastEvent, error }
}

export const useAuth = () => {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
};
