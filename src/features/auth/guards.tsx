import { Navigate, Outlet, useLocation } from 'react-router';
import { Splash } from '@/components/ui/Splash';
import { ErrorState } from '@/components/ui/ErrorState';
import { useProfile } from '@/features/profile/api';
import { useAuth } from './auth-context';

type FromState = { from?: string } | null;

/** Signed-in routes. Remembers where the user was going. */
export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <Splash />;
  if (auth.status === 'signedOut') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** App routes need a base currency; until onboarding is done, send the user to /welcome. */
export function RequireOnboarded() {
  const profile = useProfile();
  if (profile.isPending) return <Splash />;
  if (profile.isError && profile.data === undefined) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} fullScreen />;
  if (!profile.data.base_currency) return <Navigate to="/welcome" replace />;
  return <Outlet />;
}

/** Sign-in, sign-up and forgot-password pages: signed-in users go straight to the app. */
export function GuestOnly() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <Splash />;
  if (auth.status === 'signedIn') {
    const from = (location.state as FromState)?.from;
    return <Navigate to={from && from.startsWith('/') ? from : '/'} replace />;
  }
  return <Outlet />;
}
