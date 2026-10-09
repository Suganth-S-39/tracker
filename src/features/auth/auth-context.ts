import type { Session } from '@supabase/auth-js';
import { createContext, useContext } from 'react';

export type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'signedOut'; session: null }
  | { status: 'signedIn'; session: Session };

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/** The signed-in user's id. Only call below a route guard that guarantees a session. */
export function useUserId(): string {
  const auth = useAuth();
  if (auth.status !== 'signedIn') throw new Error('useUserId called without a session');
  return auth.session.user.id;
}
