# Master Prompt: Expense Tracker Website

You are building a production-quality expense tracker as a responsive, installable website. This document is the full specification. Read all of it before writing code.

## 1. How to work

- **Before Phase 1:** read the whole spec and list any contradictions, gaps, or questions you find. Wait for my answers before starting.
- **Build in phases** (Section 12). Finish one phase, make sure it runs and its tests pass, then stop and summarize before starting the next.
- **Explain your reasoning.** For each significant decision (architecture, library choice, schema design), say briefly why you chose it and what the alternative was. Prefer step-by-step progress over large unexplained code dumps.
- **Verify current docs before using any library or service.** In particular, check the current Supabase JS client, Supabase Auth, `pg_cron`, and the PWA tooling you choose.
- **Some steps need me.** Anything that requires a web console or my accounts (creating the Supabase project, the Google Cloud OAuth client, auth redirect URLs, the hosting account) is mine to do. When you reach such a step, pause and give me a short, numbered checklist of exactly what to do and what values to send back.
- **Some tests need me.** Tests that need a real phone or manual checking (installing the site, testing on a mid-range phone) should be given to me as a manual checklist. Automate everything else.
- **Do not guess at items in Section 13 (Open items).** Use the stated assumption, mark it clearly in code comments or the summary, and keep it easy to change.

## 2. Product overview

A personal finance website for tracking income and expenses, with monthly budgets, a spending report, recurring transactions, and personal IOUs (money lent to or borrowed from people). It supports multiple currencies and works on both phones and desktops. It can be installed to the home screen or desktop and opens like an app. It requires an internet connection. Design feel: modern, friendly, polished fintech.

## 3. Scope for v1

- Add, edit, delete transactions (expense or income), with an optional payee and note
- Categories (starter set, custom, hide)
- Monthly budgets: one overall budget plus optional per-category budgets
- Reports: spending by category (donut chart plus ranked list)
- Recurring transactions
- Personal IOUs with partial repayment history
- Multiple currencies with conversion
- Google and email/password sign-in
- Responsive layout for phone and desktop
- Installable (Progressive Web App)
- Light, dark, and system theme, plus selectable accent themes

Out of scope for v1: offline use, shared expense splitting, bank connections, income vs. expense bar charts, trend charts, native mobile apps, payee filters or payee reports.

## 4. Tech stack

- **Frontend:** React + TypeScript, built with Vite, as a single-page app. Strict TypeScript.
- **Styling:** Tailwind CSS, with all colors defined as theme tokens (CSS variables) from Section 7.
- **Backend:** Supabase (Postgres, Auth, Edge Functions, `pg_cron`). Postgres is the single source of truth.
- **Auth:** Supabase Auth with Google sign-in and email/password. Never store or handle passwords yourself.
- **Hosting:** Vercel or Netlify, free tier (see Section 13).
- Suggested libraries (confirm or propose alternatives with a reason): React Router for routing, TanStack Query for server data and caching, a decimal library (for example `decimal.js` or `big.js`) for rate math, a standard React chart library for the donut, `vite-plugin-pwa` for the manifest and service worker.
- Use the Supabase CLI for local development, migrations, and generated TypeScript types.

## 5. Architecture principles

1. **Online-only.** The website reads and writes directly to Supabase. When there is no connection, show a clear, friendly "You're offline" state and disable actions that write data. Do not queue writes for later.
2. **The database guarantees correctness.**
   - Any change that touches more than one row (creating, editing, or deleting an IOU and its linked transaction; adding, editing, or deleting a repayment and its linked transaction; creating a transaction with Repeat, which creates a rule and its first occurrence) is a **Postgres function** called in a single request, so it either fully happens or does not happen at all.
   - Derived values (IOU remaining balance and status, budget usage, monthly totals) come from **SQL views or queries**, never stored columns.
   - Rules such as "a repayment cannot exceed the remaining balance" and "system categories cannot be edited" are enforced in the database, not only in the page.
3. **Display-only logic lives in TypeScript:** conversion previews in the Add form, budget percentages, formatting. Keep it in a small pure domain module with no React dependencies, so it is easy to test.
4. **The backend's scheduled work:** daily exchange-rate fetching and recurring-transaction generation (Section 9). Account deletion is an Edge Function.
5. **Money is stored as integers in the minor unit** (cents, paise), as `bigint` in Postgres. Use the ISO 4217 exponent per currency (for example JPY has 0 decimals, KWD has 3). Never use floating point for money.
6. **Exchange rates are exact decimals.** Store rates as `numeric` in Postgres. Make sure rates reach the browser as strings, not JavaScript numbers (cast to text where needed), and do rate math with a decimal library. Round converted amounts to the target currency's minor unit using **half-even** rounding. Use this one rule everywhere, in TypeScript and in SQL.
7. **Dates are plain local calendar dates.** A transaction's `date` is a Postgres `date` (no time, no timezone). Whatever date the user sees when saving is the date it keeps forever. Months are calendar months of that date. "Today" comes from the browser's timezone. The profile stores the user's IANA timezone for the scheduled jobs.
8. **Soft deletes** (a `deleted_at` timestamp). They make the swipe-to-delete undo simple and keep deleted recurring occurrences from being recreated. Hidden categories use a separate `is_hidden` flag. Normal queries exclude soft-deleted rows.
9. **Security:** Row Level Security on every user-owned table so users only ever see their own rows. Postgres functions run as the calling user (`security invoker`) and views use `security_invoker = true`, so RLS always applies. Anything that must bypass RLS (the scheduled jobs, account deletion) runs only on the server. `exchange_rates` is shared data: readable by any signed-in user, writable only by the backend. The Supabase service-role key must never appear in frontend code or the built site.

## 6. Data model

All user-owned tables have: `id` (UUID, default `gen_random_uuid()`), `user_id` (default `auth.uid()`), `created_at`, `updated_at`, `deleted_at` (nullable). (`exchange_rates` is shared and has none of these except `id`.)

**profiles**: `display_name`, `email`, `base_currency` (ISO code), `timezone` (IANA name), `accent_theme`, `theme_mode` (light, dark, system).

**categories**: `name`, `icon`, `kind` (expense or income), `is_hidden`, `is_default`, `is_system` (true for the four reserved IOU categories), `sort_order`.

**transactions**: `type` (expense or income), `category_id`, `date` (local calendar date), `payee` (nullable text), `note` (nullable), `original_amount_minor`, `original_currency`, `base_amount_minor`, `exchange_rate` (`numeric`, original to base), `recurring_rule_id` (nullable), `occurrence_date` (nullable; the due date this recurring occurrence was generated for), `iou_id` (nullable). Unique constraint on (`recurring_rule_id`, `occurrence_date`).

**budgets**: `month` (first day of month), `amount_minor` (base currency), `category_id` (nullable; null means the overall budget). One overall budget and at most one per category per month.

**recurring_rules**: `type`, `category_id`, `amount_minor`, `currency`, `payee` (nullable), `note` (nullable), `frequency` (daily, weekly, monthly, yearly), `next_due_date` (local calendar date), `is_active`.

**ious**: `person_name`, `direction` (lent or borrowed), `original_amount_minor`, `original_currency`, `base_amount_minor`, `exchange_rate`, `date`, `due_date` (nullable), `note` (nullable), `transaction_id`. There is no `status` column; remaining balance and status come from a view (Section 9).

**iou_repayments**: `iou_id`, `amount_minor`, `currency` (any currency), `iou_currency_amount_minor` (the repayment converted into the IOU's currency), `iou_currency_rate` (`numeric`, repayment currency to IOU currency), `base_amount_minor`, `exchange_rate` (`numeric`, repayment currency to base), `date`, `note` (nullable), `transaction_id`.

**exchange_rates** (shared, read-only for users): `id`, `date`, `base`, `quote`, `rate` (`numeric`).

## 7. Design system

Define every color as a **semantic token** (CSS variables, exposed through the Tailwind theme). Never hardcode a color in a component. A theme is a set of values for the tokens. Provide light and dark variants for each.

### Fixed neutrals and semantic colors (same across all themes)

| Role | Light | Dark |
|---|---|---|
| Background | #F6F4FB | #0F0D1A |
| Surface / card | #FFFFFF | #1A1730 |
| Text primary | #1B1830 | #F2F0FA |
| Text secondary | #5F5B73 | #A9A4C0 |
| Divider | #E6E2F0 | #2A2640 |
| **Income** (violet) | #7C3AED | #A78BFA |
| **Expense** (orange) | #F2622E | #FF8A5C |

Income and expense colors never change with the accent theme. Always pair them with a non-color cue (an up/down arrow icon, or a plus/minus sign), for color-blind users.

### Accent themes (buttons, active tab, chart highlights, header)

| Theme | Light | Dark |
|---|---|---|
| Default violet | #7C3AED | #A78BFA |
| Deep indigo | #3B4FD8 | #8392FF |
| Teal | #0E9AA7 | #4FD1D9 |
| Emerald | #12A150 | #4ADE80 |
| Rose pink | #E0457B | #FF7AA2 |

Note: in the default theme the brand color and income color are both violet, matching the reference design. In the other four themes they are distinct.

### Visual style (based on the reference mockup)

- Soft lavender background, white cards with **large corner radii**, generous spacing.
- **Hero balance card** on Home: a rounded gradient card (violet to blue to coral in the default theme) showing the balance, with income and expense totals underneath, each with an arrow icon.
- Summary tiles use pale tints of the income and expense colors.
- Bold, high-contrast numbers; secondary text must meet WCAG AA contrast (hence the darker secondary text color above).
- System mode follows `prefers-color-scheme`. Avoid a flash of the wrong theme on load.

### Responsive layout

- **Phone (narrow screens):** bottom bar with Home, Transactions, Add (+, a prominent center button), Budgets, Reports. The Add form opens as a bottom sheet.
- **Tablet and desktop (wide screens):** the bottom bar becomes a **left sidebar** with the same items and a prominent Add button at the top. The Add form opens as a centered dialog. Screens use the extra width (for example, Home shows the hero card and budget snapshot side by side).
- Respect safe areas on phones with notches, including when installed.

### Accessibility

- WCAG AA contrast, visible focus states, full keyboard navigation (dialogs trap focus and close with Escape), semantic HTML, labels on every input and icon button.
- Respect browser text zoom and `prefers-reduced-motion`.
- Amount fields use `inputmode="decimal"` so phones show the number pad.

### Speed and smoothness

The site must feel fast and smooth, like an app.

- Fast first load: small bundle, code-split routes, no heavy libraries loaded on pages that do not need them.
- No layout jumps: use skeleton placeholders sized like the final content.
- Long lists (the Transactions page with a few thousand rows) use virtualization, so scrolling stays smooth.
- Animate only `transform` and `opacity`, keep animations short and purposeful, and disable non-essential motion under `prefers-reduced-motion`.
- Cache server data with TanStack Query so switching tabs feels instant; refetch in the background.
- Measure, don't guess: target a Lighthouse mobile performance score of 90 or more, and include testing on a mid-range phone in my manual checklist.

## 8. Navigation and screens

**Home** (top to bottom on phone; two columns on desktop):
1. Top bar: profile icon (opens Settings) and a month selector
2. Hero card: Total Balance = **this month's net** (income minus expenses) for the selected month, with income and expense totals. **IOU-linked transactions (the four system categories) are excluded** from the balance and from both totals, the same as budgets.
3. IOU summary card: "You owe" and "You're owed" totals; clicking opens the IOU page
4. Budget snapshot for the selected month
5. Recent transactions, with "See All" opening the Transactions page

**Transactions page:** list grouped by day, search bar (matches note and payee), filter chips (type, category, date range). Tap or click to edit. On phones, swipe to delete; on desktop, a delete action on each row. Both show an undo prompt.

**Add form** (bottom sheet on phone, dialog on desktop): three-way toggle **Expense / Income / IOU**.
- Expense and Income: large amount field (focused on open) with a currency selector defaulting to the base currency, category chips, date (default today), optional **payee** (labelled "Paid to" for expenses and "Received from" for income, with autocomplete from payees used before), optional note, and a **Repeat** option (none, daily, weekly, monthly, yearly).
- When the selected currency differs from the base currency, show the converted amount and the rate used. The user can **edit the rate or the converted amount**; the other value recalculates, and the final rate is saved.
- IOU: person's name, lent or borrowed, amount and currency, date, optional due date, optional note.

**Budgets page:** overall monthly budget at the top, optional category budgets below, each with a progress bar.

**Reports page:** spending by category for the selected month: donut chart plus ranked list, in the base currency. Includes a switch to **exclude IOU movements** from the chart.

**IOU page** (opened from the Home card): two groups, owed to you and owed by you. Each entry shows the person, the original amount, repayments so far, and the remaining balance, all in the IOU's currency. Open an entry for detail with the repayment history and a "record a repayment" action.
- The repayment form accepts **any currency**. When it differs from the IOU's currency, it shows the amount converted into the IOU's currency using the same editable rate/amount control as the Add form.
- A repayment **cannot exceed the remaining balance**; the form caps it and the database enforces it.
- An IOU shows as settled when its remaining balance reaches zero.

**Settings:** account, base currency, theme (accent theme and light/dark/system), recurring transactions list, categories (add, edit, hide), sign out, **delete account**, privacy policy link.

**First run:** sign-in, then choose base currency (defaulting from the browser locale), then the starter categories are created. Save the browser's timezone to the profile. If the browser's timezone later differs from the profile, update it.

## 9. Key behaviors and rules

### Multi-currency
- Each transaction stores the original amount and currency, the converted base amount, and the exchange rate used. Reports sum the stored base amounts, so past totals never change when rates move.
- All conversions use exact decimal math and half-even rounding to the target currency's minor unit (Section 5).
- A scheduled backend job fetches daily exchange rates into `exchange_rates`. The Add form uses the latest available rate as its starting value.

### Payee
- `payee` is optional free text, separate from the note: the note says *what*, the payee says *where or who*.
- Autocomplete suggests distinct payees from the user's existing transactions, most recent first.
- Recurring rules carry a payee, which each generated transaction copies.
- IOU-linked transactions get the IOU's person name as their payee automatically.

### IOUs are linked to transactions
Each IOU and each repayment creates a linked transaction in one of four reserved, non-editable system categories:

| Event | Transaction type | System category |
|---|---|---|
| You lend money | Expense | Lent |
| They repay you | Income | Repayment received |
| You borrow money | Income | Borrowed |
| You repay them | Expense | Repayment paid |

- Creating, editing, or deleting an IOU or repayment creates, updates, or removes its linked transaction **inside one Postgres function**.
- **Remaining balance** = the IOU's original amount minus the sum of its repayments' `iou_currency_amount_minor`, in the IOU's own currency. Rate changes never create leftover amounts.
- **Status comes from a view:** settled when the remaining balance is zero, otherwise open.
- A repayment that would make the remaining balance negative is rejected by the database.

### Recurring transactions
- **The database generates occurrences** with a `pg_cron` job. Run it hourly; for each active rule, generate every occurrence whose due date has arrived **in that user's timezone** (from the profile), then advance `next_due_date`. Entries appear on time even if the user does not visit the site.
- Generation is **insert-only**, guarded by the unique constraint on (`recurring_rule_id`, `occurrence_date`). If that occurrence already exists, including a soft-deleted one, leave it alone. Generation never overwrites an edited occurrence and never restores a deleted one, so running the job twice is harmless.
- Creating a transaction with Repeat set creates the rule and its first occurrence in one Postgres function.
- **Editing a rule** affects only occurrences generated after the edit. Past occurrences keep their values.
- Each generated transaction stores its `recurring_rule_id` and `occurrence_date`, and copies the rule's category, amount, currency, payee, and note. A foreign-currency occurrence uses the latest available rate.
- Due dates are local calendar dates.

### Budgets
- Budget usage for a month = sum of expense transactions in that month (base amounts), excluding the reserved IOU system categories.
- Warning states: the progress bar uses the accent color while on track; near the limit (80% or more) and over the limit (100% or more), it switches to the expense orange and shows an icon plus a text label ("Nearing limit", "Over budget"). Do not introduce a new color for warnings.

### Categories
Starter expense categories: Food, Transport, Rent, Shopping, Bills, Health, Entertainment. Starter income categories: Salary, Other. Users can add, edit, and hide categories. Hiding never affects existing transactions.

### Installable (PWA)
- Provide a web app manifest (name, icons, theme color, standalone display) and a service worker that caches the app shell, so the installed app opens instantly.
- The service worker does **not** cache data or queue writes. With no connection, show the offline state from Section 5.
- When a new version is deployed, show a small "Update available" prompt rather than reloading on the user.

## 10. Authentication and account

- Supabase Auth with Google sign-in and email/password (including email verification and password reset, handled by Supabase).
- An in-app **delete account** option that removes the user's account and all their data (Edge Function), and a privacy policy page with a short plain-language summary of what data is collected and why.
- After deletion succeeds, sign out and return to the sign-in page.

## 11. Quality bar

- Unit tests (Vitest) for the TypeScript domain module: money math and rounding (including half-even cases and 0- and 3-decimal currencies), currency conversion previews, budget percentages.
- Database tests (against a local Supabase) for the Postgres functions and views: IOU balances across currencies, the overpayment rejection, atomic IOU and repayment changes, the hero totals excluding IOU categories, budget usage, recurring generation (idempotent, respects timezone, never restores deleted occurrences), and RLS (one user cannot read or change another user's rows).
- A few end-to-end tests (Playwright) for the Add flow and the Home screen, at phone and desktop widths.
- No hardcoded colors or user-facing strings in components; keep strings in one place for later localization.
- Handle loading, empty, error, and offline states on every page. The empty state of a new account should be friendly and guide the first action.

## 12. Build phases

1. **Foundation:** project setup and a `CLAUDE.md` that records the standing rules from Sections 1 and 5; theme system with all light/dark/accent themes; Supabase schema with RLS (via migrations); auth; the responsive shell (bottom bar on phone, sidebar on desktop); basic PWA manifest. Pause with my manual setup checklist (Supabase project, Google Cloud OAuth client, auth redirect URLs, hosting account) before you need those values.
2. **Core money:** categories, transactions with payee and note, the Add form including multi-currency and editable rates, payee autocomplete, the Transactions page, and the Home page with hero card and recent transactions.
3. **Budgets and reports:** Budgets page, budget snapshot on Home, the category report with the IOU exclude switch.
4. **IOUs and recurring:** IOU page, multi-currency repayments, linked transactions via Postgres functions, balance view, recurring rules and the `pg_cron` generation job.
5. **Settings and polish:** Settings, theme picker, account deletion, privacy policy page, empty/error/offline states, PWA install and update prompt, accessibility pass, Lighthouse pass, deployment, and my manual test checklist.

Stop after each phase and summarize what works, what you assumed, and what's next.

## 13. Open items (assumptions to confirm)

These were not decided. Use the assumption stated, keep it easy to change, and flag it.

1. **Base currency changes:** assume the base currency is chosen once at first run and cannot be changed in v1, because changing it would require recomputing stored base amounts.
2. **Exchange-rate provider:** pick a reputable provider with a free tier and note your choice and its limits.
3. **Typography:** assume a clean sans-serif web font with a consistent type scale.
4. **Hero card gradient in accent themes:** assume the gradient is derived from the selected accent plus related tints; the default theme uses violet, blue, and coral as in the reference.
5. **Category colors in the donut:** assume a fixed categorical palette, independent of the accent theme and distinct from the income and expense colors.
6. **Notifications:** none in v1 (no reminders for due IOUs or recurring items).
7. **Analytics and error reporting:** none in v1.
8. **Browser support:** assume the last two versions of Chrome, Edge, Firefox, and Safari, on desktop and mobile.
9. **App name and icon:** use a placeholder name and a simple placeholder icon.
10. **Budget warning thresholds:** 80% and 100% as described above.
11. **Rate for back-dated entries:** assume a transaction dated in the past uses the latest available rate, which the user can edit. Do not fetch historical rates in v1.
12. **Hosting:** assume Vercel or Netlify on the free tier; pick one and note why.
13. **Layout breakpoint:** choose a sensible width for switching between the bottom bar and the sidebar, and make it a single setting.
