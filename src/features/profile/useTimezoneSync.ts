import { useEffect, useRef } from 'react';
import { browserTimezone, useProfile, useUpdateProfile } from './api';

/**
 * Keeps profiles.timezone equal to the browser's timezone (spec section 8). The scheduled jobs
 * use it to decide when "today" starts for this user. Updates silently, at most once per
 * timezone value per session (so a rejected value does not retry in a loop).
 */
export function useTimezoneSync(): void {
  const { data: profile } = useProfile();
  const { mutate } = useUpdateProfile();
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const timezone = browserTimezone();
    if (!timezone || timezone === profile.timezone || attempted.current === timezone) return;
    attempted.current = timezone;
    mutate({ timezone });
  }, [profile, mutate]);
}
