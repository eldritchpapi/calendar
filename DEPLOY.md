# Deploying Calendar.io to Vercel

This guide walks through deploying Calendar.io to production. Total time: **~30 minutes** once accounts are created.

## Before you start

You'll need accounts on:
- **Vercel** — hosting (free Hobby tier for personal, $20/mo Pro for commercial)
- **Turso** — database (free tier is more than enough)
- **Resend** — email (free tier: 3,000/mo)
- **Google Cloud** — OAuth for Calendar API (free)
- **GitHub** — to host the code (free)

You'll also need a domain (~$10/yr on Porkbun or Cloudflare Registrar).

---

## Step 1 — Push to GitHub

```bash
cd /Users/admin/Calendar.io
git init
git add .
git commit -m "Initial commit"
```

Create a new repo at https://github.com/new (private recommended), then:

```bash
git remote add origin git@github.com:yourusername/calendar-io.git
git branch -M main
git push -u origin main
```

## Step 2 — Set up Turso (database)

1. Sign up at [turso.tech](https://turso.tech) with GitHub
2. Install the CLI: `brew install tursodatabase/tap/turso`
3. Log in: `turso auth login`
4. Create a database:
   ```bash
   turso db create calendar-io
   ```
5. Get the connection URL:
   ```bash
   turso db show calendar-io --url
   ```
   Copy it — starts with `libsql://...`
6. Generate an auth token:
   ```bash
   turso db tokens create calendar-io
   ```
   Copy the long token.
7. Apply the schema:
   ```bash
   TURSO_URL="libsql://..." TURSO_TOKEN="..." npx drizzle-kit push
   ```

## Step 3 — Set up Google OAuth

1. Go to https://console.cloud.google.com
2. Create a new project: "Calendar.io"
3. **Enable the API**: APIs & Services → Library → search "Google Calendar API" → Enable
4. **Create OAuth consent screen**: APIs & Services → OAuth consent screen
   - User Type: **External**
   - App name: **Calendar.io** (or whatever you want)
   - User support email: your email
   - Add scopes: `.../auth/calendar` and `.../auth/calendar.events`
   - Add your email as a test user (required while the app is in testing mode)
5. **Create credentials**: APIs & Services → Credentials → Create Credentials → OAuth Client ID
   - Application type: **Web application**
   - Name: Calendar.io
   - Authorized redirect URIs: `https://your-domain.com/api/google/callback`
     *(You'll need to add `http://localhost:3000/api/google/callback` too for local dev)*
6. Copy the **Client ID** and **Client Secret**

## Step 4 — Set up Resend (email)

1. Sign up at [resend.com](https://resend.com)
2. **Add your domain**: Domains → Add Domain → enter `yourdomain.com`
3. Copy the DNS records Resend shows (SPF, DKIM) and add them to your domain's DNS
4. Wait for verification (usually 2-5 min)
5. **Create API key**: API Keys → Create API Key → name it "Calendar.io" → copy it
6. Your "From" address will be something like `bookings@yourdomain.com`

## Step 5 — Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repo
2. Framework Preset: **Next.js** (auto-detected)
3. **Add environment variables** (click "Environment Variables"):

   | Key | Value |
   |---|---|
   | `TURSO_URL` | from Step 2 |
   | `TURSO_TOKEN` | from Step 2 |
   | `ADMIN_PASSWORD` | pick a strong password |
   | `GOOGLE_CLIENT_ID` | from Step 3 |
   | `GOOGLE_CLIENT_SECRET` | from Step 3 |
   | `GOOGLE_REDIRECT_URI` | `https://your-vercel-app.vercel.app/api/google/callback` *(update this after you add a custom domain)* |
   | `RESEND_API_KEY` | from Step 4 |
   | `RESEND_FROM` | `bookings@yourdomain.com` |
   | `CRON_SECRET` | generate a random string (e.g. `openssl rand -hex 32`) |

4. Click **Deploy**. Wait 2 minutes.

5. Visit the deployment URL. You should see the sign-in page — enter the admin password.

## Step 6 — Add your custom domain

1. In Vercel: Project → Settings → Domains → Add
2. Enter `book.yourdomain.com` (or whatever subdomain you want)
3. Follow the DNS instructions (usually: add a CNAME pointing to Vercel)
4. Wait for the TLS cert to issue (~1 minute)
5. **Important**: Update `GOOGLE_REDIRECT_URI` in Vercel env vars to use your custom domain
6. **And** in Google Cloud Console → Credentials → edit the OAuth client → add the new redirect URI
7. Redeploy (Vercel → Deployments → ... → Redeploy)

## Step 7 — Connect your calendar

1. Visit `https://book.yourdomain.com/signin` → enter admin password
2. Go to **Settings**
3. Fill in your name, email, App URL (= `https://book.yourdomain.com`)
4. Click **Connect Google Calendar** → sign in with Google → grant permissions
5. Select which calendars to check for conflicts
6. Pick a primary calendar for writing new bookings
7. Save

## Step 8 — Create your first event type

1. Go to **Event Types** → **+ Create**
2. Set name, duration, location
3. Link it to an availability schedule (create one at `/availability` if needed)
4. Save

Copy the booking link (e.g. `https://book.yourdomain.com/book/30min`).

## Step 9 — Embed on your site

For Framer, Webflow, or any site:

```html
<script
  src="https://book.yourdomain.com/embed.js"
  data-calendario-slug="30min">
</script>
```

Or an iframe:

```html
<iframe
  src="https://book.yourdomain.com/book/30min?embed=true"
  width="100%"
  height="700"
  frameborder="0">
</iframe>
```

---

## Ongoing cost summary

| Service | Monthly |
|---|---|
| Vercel Hobby (personal) / Pro $20 (commercial) | $0–20 |
| Turso Free | $0 |
| Resend Free (< 3k emails) | $0 |
| Google Calendar API | $0 |
| Domain | ~$1 |
| **Total** | **$1–21/mo** |

## Troubleshooting

**"Google OAuth not configured"** — one of `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, or `GOOGLE_REDIRECT_URI` is missing or misspelled in Vercel env vars.

**"redirect_uri_mismatch" from Google** — the URI in Google Cloud Console must exactly match the value in `GOOGLE_REDIRECT_URI`. Including trailing slashes, protocol, and subdomain.

**"403: access_denied"** — you're still in OAuth "testing" mode and your email isn't on the test users list. Add yourself in the OAuth consent screen settings. Or publish the app (requires Google's verification for production use).

**"This app isn't verified"** — expected while your OAuth consent screen is in test mode. Click "Advanced" → "Go to Calendar.io (unsafe)" to proceed. Not a security issue for your own app.

**Emails not sending** — verify Resend domain is marked as verified. Check the Vercel logs for "[Email/Resend]" errors.

**Bookings not showing in my Google Calendar** — go to Settings and confirm a "Primary calendar" is selected.

**Cron isn't firing** — Vercel cron only runs on Pro plans. On Hobby, you can hit `/api/workflows/execute?secret=$CRON_SECRET` from an external cron service (e.g. [cron-job.org](https://cron-job.org) — free).
