import { isAuthError, isAuthRetryableFetchError } from '@supabase/auth-js';
import { strings } from '@/strings/en';

/**
 * Turns any error from Supabase (Auth or PostgREST) into a friendly sentence.
 * SQL functions raise machine-readable messages (e.g. 'base_currency_locked'); Auth errors and
 * Postgres errors carry a `code`. All are looked up in strings.errors.byCode.
 */
export function errorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) return strings.errors.network;
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) return strings.errors.network;

  if (isAuthError(error) && error.code) {
    const known = strings.errors.byCode[error.code];
    if (known) return known;
  }

  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') {
      const known = strings.errors.byCode[error.message];
      if (known) return known;
    }
    if ('code' in error && typeof error.code === 'string') {
      const known = strings.errors.byCode[error.code];
      if (known) return known;
    }
  }

  return strings.errors.generic;
}
