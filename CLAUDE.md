# Tracker: expense tracker website

Full spec: [WEB_SPEC.md](WEB_SPEC.md). Assumptions and decisions: [DECISIONS.md](DECISIONS.md).
Manual steps for accounts and consoles (including deployment): [docs/SETUP.md](docs/SETUP.md).
Owner's manual test checklist (real phones, real email): [docs/MANUAL_TESTS.md](docs/MANUAL_TESTS.md).

## How to work (spec section 1)

- Build in the phases of spec section 12. Finish a phase, make sure it runs and its tests pass, then stop and summarize (what works, what was assumed, what's next) before starting the next.
- Explain significant decisions briefly: what was chosen, why, and the alternative.
- Verify current docs before using a library or service (Supabase JS, Supabase Auth, pg_cron, PWA tooling, ...). Versions here are newer than most training data.
- Anything needing the owner's accounts or a web console (Supabase project, redirect URLs, hosting): stop and give a short numbered checklist of what to do and which values to send back.
- **Sign-in is Supabase email/password only.** The owner dropped Google sign-in on 2026-10-09 (spec sections 3, 4 and 10 still mention it; DECISIONS.md records the change). Don't add OAuth providers.
- Tests needing a real phone or manual checking go in the owner's manual checklist; automate everything else.
- Don't guess at spec section 13 (open items): use the stated assumption, flag it in code comments and DECISIONS.md, keep it easy to change.

## Architecture rules (spec section 5)

1. **Online-only.** Read and write Supabase directly. Offline: show the offline state and disable writes. Never queue writes.
2. **The database guarantees correctness.**
   - Any change touching more than one row (IOU + linked transaction, repayment + linked transaction, transaction with Repeat = rule + first occurrence) is one Postgres function called in one request.
   - Derived values (IOU remaining balance and status, budget usage, monthly totals) come from SQL views or queries, never stored columns.
   - Rules ("repayment cannot exceed remaining balance", "system categories cannot be edited") are enforced in the database, not only in the UI.
3. **Display-only logic** (conversion previews, budget percentages, formatting) lives in `src/domain/`: pure TypeScript, no React, unit tested.
4. **Scheduled work** (daily exchange rates, recurring generation) runs on the backend. Account deletion is an Edge Function.
5. **Money is integer minor units**: `bigint` in Postgres, ISO 4217 exponent per currency (`public.currencies.exponent`: JPY 0, USD 2, KWD 3). Never floating point.
6. **Rates are exact decimals**: `numeric` in Postgres, sent to the browser as **strings** (PostgREST returns `numeric` as a JSON number, so cast with `::text` or go through an SQL function). Rate math uses big.js. Round converted amounts to the target minor unit with **half-even**, the same rule in TypeScript and SQL.
7. **Dates are plain local calendar dates** (`date`, no time zone). "Today" comes from the browser's time zone. `profiles.timezone` is for the scheduled jobs.
8. **Soft deletes** via `deleted_at`. Normal queries exclude soft-deleted rows. Users have no DELETE grant. Hidden categories use `is_hidden`.
9. **Security**: RLS on every user-owned table. API-callable functions are `security invoker`; views use `security_invoker = true`. Only scheduled jobs and account deletion bypass RLS, server-side only. `exchange_rates` and `currencies`: readable by signed-in users, writable only by the backend. The secret / service-role key never appears in frontend code or the built site (only `VITE_SUPABASE_PUBLISHABLE_KEY` is public).

## Project conventions

- **Look**: Apple-inspired with liquid glass (owner redesign, see DECISIONS.md). Cards use `glass` (`Card` does this): translucent, **no blur**. Backdrop blur is redrawn every scroll frame, so it's only on surfaces content moves behind: `glass-bar` (bottom bar), `glass-float` (sticky panels), `glass-strong` (dialogs, sheets, prompts). The sidebar uses `glass-rail` (no blur). Never add blur to cards, list rows or anything else that scrolls with the page. Buttons and segmented controls are pills.
- **Smooth scrolling (target: 90 Hz phones, integrated-GPU laptops)**: list rows are memoized with stable handlers; virtualized lists use exact size estimates and `useFlushSync: false`. Keep it that way when touching lists.
- **Colors**: only in `src/styles/tokens.css`. Tailwind's default palette is removed; use the token utilities (`bg-surface`, `text-fg`, `text-fg-muted`, `bg-accent-strong text-on-accent`, `text-expense-strong`, `bg-control`, ...). Use `-strong` variants for text and filled buttons; plain `income` / `expense` / `accent` for icons, bars and charts. `tokens.test.ts` checks WCAG contrast (including text on glass); `noHardcodedColors.test.ts` fails on color literals in `src/`. No purple or dark-blue accents.
- **Income/expense always pair color with a non-color cue** (arrow icon or +/- sign).
- **Strings**: all user-facing copy is in `src/strings/en.ts`. ESLint rejects JSX text and literal `aria-label`/`placeholder`/`title`/`alt`.
- **Layout breakpoint**: one setting, `--breakpoint-wide` in `src/styles/index.css`. Use only the `wide:` variant for layout switches (other breakpoints are removed).
- **Errors**: SQL raises stable machine-readable messages (`'base_currency_locked'`); map them in `strings.errors.byCode`. Use `errorMessage()` from `src/lib/errors.ts`.
- **IOUs**: IOU rows and IOU-linked transactions change only through the IOU functions (`create_iou`, `create_repayment`, ...), which set the `app.iou_write` flag; triggers reject anything else. Recurring occurrences come from `private.generate_recurring()` (hourly pg_cron), insert-only.
- **Database**: schema changes are new files in `supabase/migrations/`. Child rows use composite `(user_id, id)` foreign keys so they can't point at another user's rows. Internal helpers and trigger functions live in the `private` schema (not exposed by the API). After a schema change run `npm run db:types`.
- **Routes** are lazy-loaded in `src/app/router.tsx`. Server data goes through TanStack Query (`src/lib/queryClient.ts` holds the query keys).
- **Supabase client** (`src/lib/supabase.ts`) is a lean build from `@supabase/auth-js`, `postgrest-js` and `functions-js`: it has `auth`, `from`, `rpc`, `functions` only (no realtime or storage). Import auth types from `@supabase/auth-js`.
- **Deployment** is `vercel.json` (headers, CSP, cron) plus `api/` (Vercel functions; keep them self-contained, no `@/` imports, tests go in `tests/`). The CSP pins the inline script in `index.html` by hash: if you change that script, update the hash (`tests/deploy.test.ts` and the post-build check say which). New network origins need a `connect-src` entry.
- **Animation**: only `transform` and `opacity`; respect `prefers-reduced-motion`.

## Commands

| Task | Command |
|---|---|
| Start local Supabase (needs Docker Desktop running) | `npm run db:start` |
| Reset local DB (re-applies migrations) | `npm run db:reset` |
| Regenerate DB types (only writes on success) | `npm run db:types` |
| Dev server | `npm run dev` (http://localhost:5173) |
| Unit tests | `npm test` |
| Database tests (pgTAP) | `npm run test:db` |
| End-to-end tests (Playwright) | `npm run test:e2e` |
| Type check, lint, build (build also checks dist for secrets and CSP drift) | `npm run typecheck`, `npm run lint`, `npm run build` |
| Production preview with production headers | `npm run build`, then `npm run preview` (http://localhost:4173) |
| Lighthouse (mobile, median of 3; needs the preview running) | `npm run lighthouse` |

Local auth emails land in Mailpit: http://127.0.0.1:54324. Local Studio: http://127.0.0.1:54323.

On this Windows machine the Claude Code sandbox blocks the Supabase CLI and Playwright from spawning `docker` and browsers, so those commands need the sandbox disabled.
