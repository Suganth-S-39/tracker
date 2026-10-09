import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthContext, type AuthState } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading', session: null });

  useEffect(() => {
    // INITIAL_SESSION fires once the client has restored the stored session and exchanged any
    // ?code= in the URL, so it is the single source for the first state.
    // Do not call other supabase methods synchronously inside this callback (supabase-js docs).
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') queryClient.clear();
      setState(session ? { status: 'signedIn', session } : { status: 'signedOut', session: null });
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  return <AuthContext value={state}>{children}</AuthContext>;
}
