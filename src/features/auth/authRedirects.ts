// Where Supabase Auth sends the browser back to. Each URL must be allowed in the Supabase
// project's redirect URL list (local: supabase/config.toml; hosted: dashboard).

export const redirectUrls = {
  /**
   * Email confirmation link. If the code exchange succeeds the user is signed in and redirected
   * into the app; if it can't (opened on another device), the sign-in page says the email is
   * confirmed.
   */
  emailConfirmed: () => `${window.location.origin}/sign-in?confirmed=1`,
  passwordReset: () => `${window.location.origin}/reset-password`,
};
