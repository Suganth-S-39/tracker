import { cx } from '@/lib/cx';
import type { Profile } from './api';

const SIZES = {
  sm: 'size-9 text-base',
  lg: 'size-16 text-2xl',
} as const;

/**
 * The person's photo, or the first letter of their name (or email) on a tint. Decorative: it's
 * always inside something that's already labelled (the Settings link, the account section).
 */
export function Avatar({ profile, size = 'sm', className }: { profile: Profile | undefined; size?: keyof typeof SIZES; className?: string }) {
  const photo = profile?.avatar_data_url;
  if (photo) {
    return <img src={photo} alt="" className={cx('shrink-0 rounded-full object-cover', SIZES[size], className)} />;
  }
  const initial = (profile?.display_name?.trim() || profile?.email || '').charAt(0).toLocaleUpperCase();
  return (
    <span aria-hidden="true" className={cx('grid shrink-0 place-items-center rounded-full bg-accent-tint font-semibold text-accent-strong', SIZES[size], className)}>
      {initial}
    </span>
  );
}
