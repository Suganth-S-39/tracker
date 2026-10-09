# Decisions and assumptions

Every assumption is flagged here and in code comments, and kept easy to change.
"Open item N" refers to WEB_SPEC.md section 13.

## Owner changes to the spec

| Date | Change | Effect |
|---|---|---|
| 2026-10-09 | **No Google sign-in.** Supabase Auth email/password only (spec sections 3, 4, 10 and 12 mention Google). | Google button, logo and OAuth redirect removed; no Google Cloud setup step. Email verification and password reset are unchanged. |
| 2026-10-09 | **Monthly income-vs-expense bar chart** on Reports (spec section 3 lists bar charts as out of scope). | Last 12 months ending at the selected month (6 on phones); each month is a button that opens that month app-wide. Follows the Reports "Exclude IOU movements" switch. Query: `public.monthly_totals`. |
| 2026-10-09 | **Premium, Apple-inspired redesign** replacing spec section 7's palette: no purple or dark blue, high-quality type, glassmorphism, light and dark themes. | See *Design system* below. Accent themes are now Graphite (default), Green, Teal, Gold, Rose (database enum changed before any deploy). Income is green, expense is red. |

## Open items (spec section 13)

| # | Item | Assumption used | Where to change it |
|---|---|---|---|
| 1 | Base currency changes | Chosen once at first run, then locked. | `private.profiles_guard()` in the user-tables migration |
| 2 | Exchange-rate provider | **Frankfurter** (frankfurter.dev): no API key, no quotas (rate-limited only against abuse), daily updates, ~180 currencies from central banks including INR, KWD, AED, SAR. The app supports the 154 ISO 4217 currencies it publishes. | `public.currencies` seed; rate job (phase 2) |
| 3 | Typography | San Francisco on Apple devices (built in, no download); Geist (variable, self-hosted via Fontsource) everywhere else. Tabular figures for amounts. | `src/main.tsx`, `--font-sans` / `--font-display` in `index.css` |
| 4 | Hero gradient per accent | A deep, dark "card" gradient in the accent's hue with a soft sheen (graphite by default, lifted to gray in dark mode). White text, checked for AA on every stop. | `--hero-*` in `tokens.css` |
| 5 | Donut category colors | Fixed 7-color palette plus gray for "Other", independent of the accent, distinct from income green and expense red, assigned by rank. Each color is checked for 3:1 on glass in both themes. | `--chart-*` in `tokens.css` |
| 6 | Notifications | None in v1. | n/a |
| 7 | Analytics, error reporting | None in v1. | n/a |
| 8 | Browser support | Last two versions of Chrome, Edge, Firefox, Safari (desktop and mobile). Allows `color-mix()`, `dvh`, `:has()`. | n/a |
| 9 | App name and icon | Placeholder "Tracker"; icon is green/red arrows on a graphite card. | `strings.app.name`, `vite.config.ts` manifest, `public/icon.svg` then `npm run icons` |
| 10 | Budget warning thresholds | 80% "Nearing limit", 100% "Over budget" (whole percent, rounded down; integer math). | `src/domain/budget.ts` |
| 11 | Rate for back-dated entries | Latest available rate, editable. No historical rates. | phase 2 |
| 12 | Hosting | **Vercel** (Hobby): simplest SPA deploys with preview URLs. Hobby is for non-commercial use only; if this becomes commercial, switch to Netlify or a paid plan. | phase 5 |
| 13 | Layout breakpoint | 48rem (768px): sidebar from tablet width up. | `--breakpoint-wide` in `index.css` |

## Gaps in the spec, and what was decided

**Accounts and email**
- **Who signs up:** assumed personal use (the owner plus a few people). Supabase's built-in email only delivers to project team members, at 2 emails/hour. Before strangers can sign up with email/password, configure a custom SMTP provider (for example Resend). See docs/SETUP.md.
- **Supabase free tier pauses** projects after about 7 days of low activity, and pg_cron stops while paused. Decision: trigger the daily exchange-rate fetch from an outside scheduler (Vercel Cron, see Deployment), which also counts as activity. Recurring generation stays on pg_cron. (Phase 2/4.)
- **Account settings:** display name editable; email read-only; password changes send Supabase's reset email (reuses the tested reset flow and proves the person still has the inbox; no in-app "current password" form). Deleting the account requires typing DELETE.
- **Account deletion:** the `delete-account` Edge Function deletes the auth user with the admin API (server-side secret key); every user table cascades from `auth.users`, so all rows go in the same operation. The app then signs out locally and does a full page load to Sign in, so no cached data or in-flight queries survive. (A SQL function can't delete auth users.)
- **Privacy policy** is public (no sign-in), linked from Settings and from Sign up so it can be read before giving an email.
- **Timezone:** when the browser's timezone differs from the profile, the profile updates silently.

**Data model additions** (not in spec section 6)
- `public.currencies (code, name, exponent)`: shared, read-only. SQL needs each currency's minor-unit exponent for half-even rounding.
- `categories.system_key`: stable key for the four reserved IOU categories, so code never matches on (localisable) names.
- `recurring_rules.anchor_day`: day of month a monthly/yearly rule was created for. Short months clamp to their last day; the rule returns to the anchor day when the month allows (Jan 31 → Feb 28 → Mar 31).
- `budgets.amount_minor` allows 0, used to clear a carried-forward budget from a given month on (see Budgets).
- Composite `(user_id, id)` foreign keys on every child row. Postgres FK checks bypass RLS, so without these a user could attach a row to another user's category.

**Budgets**
- Budgets carry forward: a budget set for a month applies to that month and later months until changed. Setting 0 ("Remove from this month on") clears it from that month on. `public.set_budget` / `public.budget_status`.
- Category budgets are for expense categories only (database-enforced).

**Recurring**
- A back-dated Repeat back-fills every missed occurrence up to today (at most 400 per rule per hourly run; the next run continues).
- Resuming a paused rule skips the paused period (no back-fill).
- A future-dated Repeat creates its first occurrence immediately, on that date.
- Generation: `private.generate_recurring()`, hourly via pg_cron (`generate-recurring-transactions`), security definer and server-only. A foreign-currency rule converts each occurrence at the latest rate; with no rate known yet it is skipped and retried next run.
- Editing a rule (Settings > Recurring) applies to occurrences generated afterwards. Moving its next date also moves the day of month it returns to. Editing a single occurrence changes only that occurrence.
- Repeat is offered when adding a transaction, not when editing one.

**IOUs**
- IOU-linked transactions are read-only in the Transactions list: tapping one opens the IOU, and swipe/delete is disabled. The database rejects direct writes to IOU rows and IOU-linked transactions: the IOU functions set a transaction-local flag (`app.iou_write`) that triggers check, and nothing exposed through the API can set it.
- A repayment can't be dated before its IOU, and an IOU's date can't move after its first repayment.
- After an IOU has repayments, its currency and direction are locked, and its amount can't drop below what's been repaid.
- Deleting an IOU soft-deletes its repayments and all linked transactions in one function. IOU and repayment deletes use a confirm dialog; undo is only for ordinary transactions.
- Repayment → base rate: if the IOU's currency is the base currency, reuse the edited repayment → IOU rate; if the repayment is in the base currency, the rate is 1; otherwise use the latest repayment → base rate (not editable in v1).
- Home "You owe / You're owed" totals convert remaining balances at the latest rate (or the IOU's own rate if none is known). Each total is marked "≈" only when it includes a converted balance.

**Reports**
- "Exclude IOU movements" is on by default, matching Home and Budgets. It applies to both Reports charts.
- Donut: top 7 categories plus "Other", colored by rank.

**Home and lists**
- Hero label "Balance" with the month below it (the spec's "Total Balance" suggests an all-time figure, but the value is the month's net).
- Recent transactions: the latest 5 in the selected month. One month selector shared by Home, Budgets and Reports.
- Payee autocomplete excludes IOU-linked transactions (person names don't mix with merchants).
- Transactions page: server-side search and filters, keyset pagination as you scroll, virtualized list.

**Categories**
- A category's kind (expense or income) can't change after creation (database-enforced).
- Names are unique per kind, ignoring case and surrounding spaces (database-enforced).
- System categories never appear as Add-form chips or in category settings.

**Conversions**
- When the user edits the converted amount, that exact amount is saved; the rate is derived from it, stored to 12 decimal places (half-even) and shown to 6 significant digits.
- Rates in the database are stored against one pivot currency per fetch; cross rates are derived in SQL.

**Offline, install and updates** (phase 5)
- Writes are never queued (spec section 5): mutations use TanStack Query's `networkMode: 'always'`, so a save attempted offline fails at once instead of waiting to replay later. Offline, every write control is disabled and a banner explains why.
- Screens show a full error state only when they have no data at all; a failed refetch keeps showing the cached data, so pages already loaded stay readable offline.
- Install: Chrome/Edge/Android get an **Install app** button in Settings (the browser's install prompt); iPhone and iPad get the "Share → Add to Home Screen" hint; nothing is shown once installed.
- Updates: the service worker checks for a new version on load and hourly. A bar offers **Update** / **Later**; the app never reloads on its own.

**Performance** (phase 5, Lighthouse mobile ≥90)
- **Lean Supabase client** (`src/lib/supabase.ts`): `@supabase/auth-js`, `postgrest-js` and `functions-js` wired the way supabase-js wires them (same session storage key, same headers). supabase-js always bundles its realtime and storage clients, 81 KB of unused JavaScript on every page; dropping them took Sign in from 86 to 94-95. To use realtime or storage later, switch back to `createClient` in that one file.
- `npm run lighthouse` audits the production build (with the production headers) signed out and signed in, reporting the median of 3 runs per page.

**Deployment** (open item 12: Vercel Hobby)
- `vercel.json`: client routes fall back to `index.html` (except `/api`); hashed assets are cached for a year; every response gets security headers.
- **Content-Security-Policy:** scripts only from the site itself plus the hash of the one inline script (applies the theme before first paint, avoiding a flash). Styles allow inline because Radix dialogs inject a small `<style>` for scroll locking (styles can't run code). Network requests only to the site and the Supabase project; no framing. Alternative: move the theme script to a file (no hash to maintain) at the cost of a render-blocking request. The hash is checked by `tests/deploy.test.ts` and at build time, and `e2e/csp.spec.ts` runs the app under the real policy.
- **Build guard** (`scripts/check-dist.mjs`, runs after every build including Vercel's): fails if a secret key or service-role token is in the site, or if the CSP doesn't match the inline script or the Supabase project the build uses.
- **Exchange rates:** Vercel Cron calls `api/cron/fetch-rates` daily at about 17:00 UTC (Hobby allows one run a day, ±59 min; the European Central Bank publishes around 16:00 CET). The route accepts only Vercel's `CRON_SECRET` and calls the Edge Function with a dedicated Supabase secret key that can be revoked on its own. Alternative: a GitHub Actions schedule, which runs late under load and is disabled after 60 days without commits.
- `.gitattributes` keeps LF line endings on Windows checkouts, so the inline script's hash is the same everywhere.

## Design system

Owner redesign (2026-10-09), modelled on apple.com: Apple's neutrals, San Francisco typography,
and "liquid glass" surfaces. All values live in `src/styles/tokens.css`.

- **Neutrals:** light #F5F5F7 page, #FFFFFF panels, #1D1D1F text; dark #000000 page, #1C1C1E panels, #F5F5F7 text. Secondary text is slightly darker than Apple's #6E6E73 (#606065) so it stays AA over the ambient color wash.
- **Glass:** cards are translucent (`glass` utility: bright top edge, hairline) over a soft fixed color wash. Real backdrop blur (20-28px, 180% saturation) is only on surfaces content moves behind: the bottom bar (`glass-bar`), the sticky filter panel (`glass-float`), dialogs and sheets (`glass-strong`). Users with "reduce transparency" get solid panels.
- **Why cards don't blur** (owner report after launch, 2026-10-09: scrolling not smooth on PC and phone): a backdrop blur is recomputed on every frame for each visible blurred element while the page scrolls. Blurred cards meant several near-full-screen blurs per frame, too much for integrated laptop GPUs and 90 Hz phones. Cards only sit on the already-soft wash, where a blur looks the same as none, so it was removed there (and from the dialog dimmer and the desktop sidebar). The wash layer is sized to the large viewport so it doesn't repaint when a phone's toolbar hides.
- **Accents:** Graphite (default: black pills in light mode, white in dark), Green, Teal, Gold, Rose. A test asserts no accent is purple or blue.
- **Income / expense:** Apple green (#248A3D, text #1A7130; dark #30D158) and red (#E5372D, text #C7251C; dark #FF453A / #FF6961), always paired with +/- signs and arrows.
- **AA everywhere:** `tokens.test.ts` composites the translucent glass over the page and over each ambient color, then checks text (4.5:1), control borders and graphics (3:1), button text and hero text, for both themes and all five accents.
- **Controls:** Apple-style pill buttons and segmented controls on a translucent gray fill; inputs keep a 3:1 border so they're identifiable (WCAG 1.4.11).
- **Settings link in the desktop sidebar** in addition to the Home profile icon: desktop has no thumb-reach reason to hide it.
## Library choices

| Need | Choice | Why / alternative |
|---|---|---|
| Build | Vite 8 + React 19 + TypeScript 6 (strict) | TS 7 (native port) is out, but typescript-eslint supports only <6.1 so far. |
| Routing | React Router 8, data mode, lazy routes | Per spec. Every screen is a separate chunk. |
| Server data | TanStack Query 5 | Per spec. Cached data makes tab switches instant. |
| Supabase client | `@supabase/auth-js` + `postgrest-js` + `functions-js` (phase 5) | The parts of supabase-js the app uses, without its realtime and storage clients (81 KB). See Performance. |
| Styling | Tailwind CSS 4 | CSS-first `@theme` maps directly onto CSS-variable tokens. The default palette is removed so hardcoded colors can't compile. |
| Dialogs / bottom sheet | Radix Dialog | Focus trap, Escape and focus return, accessible names. One component; the `wide:` breakpoint switches sheet ↔ dialog. |
| Icons | lucide-react | Tree-shaken; used for UI and category icons. |
| Decimal math | big.js (phase 2) | Much smaller than decimal.js; supports half-even; we only need ×, ÷ and rounding. |
| Donut chart | Hand-rolled SVG (phase 3) | The spec suggests a chart library. One donut doesn't justify one: SVG is tiny and uses theme tokens and ARIA labels directly. |
| Long lists | @tanstack/react-virtual (phase 2) | Small, headless. |
| PWA | vite-plugin-pwa 2 (generateSW, prompt mode) | Precaches the app shell only; no data caching; "Update available" prompt in phase 5. |
| Tests | Vitest, pgTAP (`supabase test db`), Playwright | Playwright signs up through the real email-confirmation flow using local Mailpit. |
