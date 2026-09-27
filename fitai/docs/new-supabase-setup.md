# Connect FitAI to a fresh Supabase project

This setup starts with new FitAI accounts. Previous users, passwords, plans and
history are not copied. The code changes are local until the app is redeployed.

## 1. Create the project

Create the project in your new Supabase account and wait for it to become ready.
Keep its database password available for the connection string. Enable email
signup in Authentication.

### The four values FitAI needs

| Copy from Supabase | FitAI variable(s) | Where to put it |
| --- | --- | --- |
| Project URL (Connect dialog) | `VITE_SUPABASE_URL`, `SUPABASE_URL` | Client and server |
| Publishable key (`sb_publishable_...`) from Settings > API Keys; legacy `anon` also works | `VITE_SUPABASE_ANON_KEY` | Client only |
| Secret key (`sb_secret_...`) from Settings > API Keys; legacy `service_role` also works | `SUPABASE_SERVICE_KEY` | Server only |
| Session pooler connection URI from Connect, with the database password filled in | `DATABASE_URL` | Server only |

Keep FitAI's variable names exactly as written, even when using the newer key
types. The public URL and publishable key may be shared for setup. Enter the
secret key and password-containing connection string directly in `server/.env`
and Render environment settings, not in chat. No Supabase login password,
personal access token, JWT signing secret, or Google/Gmail password is needed.
See the [Supabase key guide](https://supabase.com/docs/guides/api/api-keys) and
[connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 2. Configure authentication URLs

Set the Site URL to:

```text
https://fit-ai-teal-nu.vercel.app
```

Add these allowed redirect URLs:

```text
https://fit-ai-teal-nu.vercel.app/auth/callback
https://fit-ai-teal-nu.vercel.app/reset-password
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
```

With email confirmation enabled, signup shows a confirmation screen and the
email link completes sign-in. Configure custom SMTP for public signup and
password-reset delivery, then test an address outside your Supabase organization.
The default Supabase email service only sends to project team addresses and is
not for production use. Turning off confirmation does not fix password-reset
email delivery. Keep confirmation enabled for the public launch.
See [Supabase's SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp).

## 3. Set server variables

Set these in `server/.env` locally and in the existing Render backend's environment:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | New project URL |
| `SUPABASE_SERVICE_KEY` | New project's server-only secret/service-role key |
| `DATABASE_URL` | Exact **Session pooler** URI from the new project's Connect dialog, including its database password |
| `CORS_ORIGINS` | `https://fit-ai-teal-nu.vercel.app,http://localhost:5173` |
| `NODE_ENV` | `production` on Render; `development` locally |

Copy the pooler hostname, port and project-specific username exactly. The code
no longer guesses the old project's region. Encode special characters in the
password when using a connection URI. Remove any old `SUPABASE_POOLER_HOST`
override. A project API key is not the database password.

Keep these values in environment settings; do not put the server key or database
password in frontend variables, source files, screenshots or chat.

## 4. Initialize the new database

Choose ONE of these methods. Do not paste database credentials into SQL Editor.

### Option A: run SQL in the Supabase dashboard

1. Open [scripts/supabase-setup.sql](../scripts/supabase-setup.sql) locally and copy
   the entire file.
2. Open the NEW project's **SQL Editor**, create a query, and paste it.
3. Run it using the `postgres` role. The final result should show
   `migrations_applied = 12`.

The file includes all current migrations, indexes, row-level security and the
migration ledger. It runs in one transaction and can be run again for this schema.
Future backend deploys recognize these migrations as already applied.
Only run it in the dedicated FitAI project: its security migration revokes
`anon` and `authenticated` access across the public schema. That is intentional:
FitAI accesses data through the authenticated Express API, not browser REST
table access. Do not disable RLS or add allow-all policies.

The application creates profiles during onboarding. You do not need to create
users manually or add an auth trigger. New FitAI accounts use Supabase signup.

### Option B: run migrations from the code

From `C:\Users\madara\fitai\fitai`, after updating `server/.env`:

```powershell
npm run migrate --workspace=server
```

This applies all current migrations and tracks them in `schema_migrations`.
The Render Docker startup also runs this migration command before starting the
API. Run it against the newly created project, then confirm `/health` reports
`status: ok` and `database: ok`.

## 5. Set frontend variables and redeploy

Set these in Vercel's environment for the production deployment:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Same new project URL as the backend |
| `VITE_SUPABASE_ANON_KEY` | New project's public publishable/anon key |
| `VITE_API_URL` | `https://fitai-d94m.onrender.com` if retaining the existing Render service |

For local development, set the same Supabase values in `client/.env` and set
`VITE_API_URL=http://localhost:4000`. The workspace-root `.env` is not the source
of client or server settings.

Redeploy the backend with its new environment, then rebuild/redeploy Vercel.
Vite embeds frontend variables at build time; changing a dashboard variable
without a rebuild does not reconnect the currently deployed website.

## 6. Verify the deployed user journey

- Create a new account and confirm its email, if enabled.
- Complete onboarding and verify the generated workout and nutrition plan.
- Sign out and sign in again; the saved plan must remain.
- Reload the dashboard and check that the session and data remain available.
- Log a workout set, a meal, weight and daily mission values; reload to check persistence.
- Edit the plan and profile; verify progress, coach and memory pages.
- Request a password reset, follow the email link and sign in with the new password.
- Create a second account and verify it cannot see the first account's data.

Local automated checks: `npm test`, `npm run smoke`, `npm run build:client`.
The smoke test uses a temporary local database and simulated auth users; it does
not verify Supabase signup, email delivery, live credentials or deployed CORS.
Those checks require the new project and the final deployment.

To test the SQL Editor bundle against a temporary local PostgreSQL database:

```powershell
npm run smoke -- --setup-sql
```

This checks that the bundle contains every current migration, can run twice,
records the migration ledger, enables RLS and removes direct REST-role SELECT
grants. It then runs the same application smoke journey against that schema.
