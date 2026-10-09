# Manual test checklist (owner)

Everything else is automated (`npm test`, `npm run test:db`, `npm run test:e2e`,
`npm run lighthouse`). These need a real phone, a real inbox or a real day passing. Run them on
the production site after deploying (docs/SETUP.md). Note anything that fails and send it back.

## Install and update

- [ ] **Android (Chrome):** Settings → **Install app**. The app icon appears on the home screen, opens full screen without the browser bar, and the icon isn't cropped oddly.
- [ ] **iPhone (Safari):** Settings shows the "Share → Add to Home Screen" hint. After adding, the app opens full screen; the top bar sits below the notch / Dynamic Island and the bottom bar above the home indicator.
- [ ] **Update prompt:** keep the installed app open, deploy any change (or press **Redeploy** in Vercel). Within an hour, or on reopening, "A new version of Tracker is available" appears. **Update** loads the new version; **Later** keeps working on the current one.

## Feel on a real phone (ideally a mid-range Android)

- [ ] Scroll Transactions with 100+ entries: smooth, no blank gaps or jumps.
- [ ] Open and close the Add sheet a few times; glass panels don't stutter.
- [ ] Swipe a transaction left to delete, then **Undo** in the toast.
- [ ] Amount fields open the number keypad with a decimal point.
- [ ] Rotate to landscape and back; nothing is cut off.
- [ ] Switch the phone between light and dark mode with the app on **System**: the app follows.
- [ ] With **Reduce motion** (and on iPhone **Reduce transparency**) turned on, animations are minimal and panels are solid.

## Screen readers

- [ ] **VoiceOver (iPhone)** and **TalkBack (Android):** sign in, add an expense, move between tabs. Each page's name is announced, the Add sheet keeps focus inside until closed, amounts are read with their sign (minus for expenses, plus for income), and every button has a name.

## Email

- [ ] Sign up with a new address: the confirmation email arrives, the link opens the site and signs you in (or shows "Your email is confirmed. Sign in to continue" if opened in another browser or device).
- [ ] On iPhone, sign up inside the installed app and open the email link (it opens Safari): you land on the confirmed message and can sign in back in the app.
- [ ] Settings → **Change password** sends a reset email; its link lets you set a new password and sign in with it.

## Things that need a day to pass

- [ ] **Exchange rates:** the day after deploying, the Add form's conversion shows a rate dated that day (or the latest working day). In Vercel, **Settings → Cron Jobs** shows the run succeeded.
- [ ] **Recurring:** create an expense with **Repeat: Daily**. The next day it appears in Transactions without opening the app first.
- [ ] **Free-tier pausing:** after a week of not using the app, the Supabase dashboard still shows the project as active.

## Offline

- [ ] Turn on airplane mode with the app open: the offline banner appears, your data stays visible, and Add / Save / Delete are disabled. Turn it off: everything is enabled again and nothing was saved twice.

## Account deletion

- [ ] Create a throwaway account, add a transaction, then Settings → **Delete account** (type DELETE). You return to Sign in; signing in with that account fails; signing up again with the same email works and starts empty.

## Security headers (2 minutes, desktop)

- [ ] Open the live site with the browser's developer tools → Console, then visit Home, Transactions, Reports and Settings: no "Content Security Policy" errors.
- [ ] https://securityheaders.com with the production URL: grade A or better.
