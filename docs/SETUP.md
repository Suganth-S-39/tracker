# Setup checklist (owner's steps)

These need your accounts, so they can't be automated. Local development works without any of
them. Do the steps in order, then send back the values in **bold**. Never send a secret key in a
chat; put secrets straight into the dashboards where noted.

Sign-in is Supabase email/password only (no Google or other providers).

## 1. Supabase project ✅ done

1. Go to https://supabase.com/dashboard and create a new project (free plan is fine).
   - Name: anything (e.g. `tracker`). Region: closest to you. Save the database password in your password manager.
2. When it's ready, open **Project Settings → API Keys** and copy:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **Publishable key** (`sb_publishable_...`). Safe to share.
   - Don't send the secret key. It only goes into Vercel's settings (step 4).
3. Open **Project Settings → General** and copy the **Project ID / reference** (the `abcd1234` part).

## 2. Code on GitHub ✅ repository created

1. On https://github.com/new create a **private**, empty repository (no README, no .gitignore), e.g. `tracker`.
2. Send back: **the repository URL**. I'll make the first commit and push when you say so.

## 3. Database and Edge Functions (from this folder, once)

Run these in a terminal in `D:\tracker`. They use the Supabase CLI already installed in the project.

1. `npx supabase login` (opens the browser to approve).
2. `npx supabase link --project-ref xxupxmkqubjbnrbqkzau` (asks for the database password from step 1).
3. `npx supabase db push --dry-run`, check it lists the migrations, then `npx supabase db push`.
   This creates the tables, security rules and the hourly recurring-transactions job. Sample
   exchange rates are local-only; real ones arrive with the first rates run (step 5).
4. `npx supabase functions deploy --no-verify-jwt --use-api`
   (deploys `fetch-rates` and `delete-account`; they check keys themselves, and `--use-api` avoids Docker).
5. In the Supabase dashboard, **Authentication → Sign In / Providers → Email**: keep **Confirm email** on,
   set **Minimum password length** to 8 and **Password requirements** to letters and digits
   (the same rules as local development and the app's hint text).

## 4. Hosting (Vercel)

1. Create a free account at https://vercel.com (sign in with GitHub is easiest).
2. **Add New → Project**, import the GitHub repository. Keep the detected settings (`vercel.json` sets the build).
3. Before the first deploy, open **Environment Variables** and add (Production and Preview; Vercel doesn't allow sensitive variables in Development):

   | Name | Value | Sensitive |
   |---|---|---|
   | `VITE_SUPABASE_URL` | `https://xxupxmkqubjbnrbqkzau.supabase.co` | no |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_FQ9BPzGCn2iLHhg2f01y9Q_58-z_hta` | no |
   | `SUPABASE_URL` | `https://xxupxmkqubjbnrbqkzau.supabase.co` | no |
   | `SUPABASE_SECRET_KEY` | Supabase **Project Settings → API Keys → Secret keys → New secret key**, name it `vercel-cron`, copy it | **yes** |
   | `CRON_SECRET` | any random string of 32+ characters (e.g. a generated password) | **yes** |

   Never put the secret key in a `VITE_` variable: those are shipped to the browser. The build
   fails if a secret key ends up in the site.
4. Deploy. Send back: **the production URL** (e.g. `https://tracker-abc.vercel.app`) and a custom domain if you add one.
5. Fetch the first exchange rates: **Project → Settings → Cron Jobs → `/api/cron/fetch-rates` → Run**.
   After that it runs daily at about 17:00 UTC (after the European Central Bank publishes).

## 5. Supabase auth URLs (after step 4)

In Supabase **Authentication → URL Configuration**:
1. Site URL: the production URL.
2. Redirect URLs, add `https://<production-domain>/**` (keep `http://localhost:5173/**` for local development).

Then sign up on the live site with your own email to check the confirmation email works.

## 6. Before inviting other people (can wait)

Supabase's built-in email only delivers to members of your Supabase team, at 2 emails per hour.
That's fine for your own account. Before anyone else signs up:
1. Create an account with an email provider (e.g. https://resend.com, free tier).
2. In Supabase: **Authentication → Emails → SMTP Settings**: enable custom SMTP and enter the provider's host, port, user and password.

## When an update includes database changes

Some updates add to the database (new tables, columns or functions, in `supabase/migrations/`).
Apply them before the new version of the app goes live: in `D:	racker`, run

    npx supabase db push

(it lists the new migrations and asks to confirm; `supabase link` from step 3 is remembered).
App-only updates need nothing: pushing to GitHub redeploys on Vercel.

## If the Supabase project ever changes

The site's Content-Security-Policy only allows the current project. Update the project URL in
`connect-src` in `vercel.json` (the build fails with a message saying so), and the Vercel
environment variables above.

## Values received so far

Public by design (safe in the repo). Secrets are never stored here.

| Item | Value |
|---|---|
| Supabase project URL | `https://xxupxmkqubjbnrbqkzau.supabase.co` |
| Supabase project reference | `xxupxmkqubjbnrbqkzau` |
| Supabase publishable key | `sb_publishable_FQ9BPzGCn2iLHhg2f01y9Q_58-z_hta` |
| GitHub repository | `https://github.com/Suganth-S-39/tracker` (private) |
| Production URL | _pending_ |
