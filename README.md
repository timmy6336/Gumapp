# GumApp 🍬

A mobile app for reporting chewing gum found on the street. GPS-enabled map, AI photo verification, leaderboard, weekly neighbourhood trends, and a data API for city/researcher clients.

## Features

- **Gum Map** — Real-time map with individual markers or density heatmap toggle
- **Report Gum** — GPS pin + optional photo + surface type tag
- **AI Verification** — Claude Haiku vision confirms photos show gum; only verified reports count toward your score
- **Leaderboard** — Ranked by verified reports
- **Profiles** — Total + verified counts, verification rate, leaderboard rank
- **Nearby Trends** — Weekly bar-chart digest of gum activity within 15km
- **Onboarding** — 6-slide first-launch flow explaining the app
- **Push Notifications** — Notified when new gum is reported near you
- **Data API** — Authenticated GeoJSON + neighbourhood stats endpoint for city clients

## Branch structure

| Branch | Contents |
|---|---|
| `claude/gum-reporting-app-nu4n6` | Initial scaffold |
| `feature/phase1` | Hardening: image resize, GPS accuracy, rate limiting, dedup, Sentry, privacy policy |
| `feature/phase2` | Data quality: surface tagging, heatmap, mark-removed, GeoJSON export, admin stats |
| `feature/phase3` | App store ready: onboarding, push notifications, deep links, EAS build config |
| `feature/phase4` | Data product: neighbourhood stats, token-auth data API, Trends screen |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo (managed workflow, SDK 56) |
| Backend | Supabase (PostgreSQL + PostGIS, Auth, Storage, Realtime) |
| Map | react-native-maps |
| GPS | expo-location |
| Photos | expo-image-picker + expo-image-manipulator (resize before upload) |
| AI | Claude claude-haiku-4-5-20251001 (vision) via Supabase Edge Function |
| Crash reporting | Sentry (`@sentry/react-native`) |
| Push notifications | expo-notifications + Expo Push API |

---

## Setup

### 1. Supabase Project

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy your **Project URL** and **anon public key**

### 2. Database — run all migrations in order

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Or paste each file into the Supabase SQL editor in order:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_phase1.sql
supabase/migrations/003_phase2.sql
supabase/migrations/004_phase3.sql
supabase/migrations/005_phase4.sql
```

### 3. Storage Bucket

In the Supabase dashboard → **Storage**, create a bucket named **`gum-photos`** and set it to **Public**.

Add RLS policies in **Storage → Policies**:

- **SELECT**: `true` (public read)
- **INSERT**: `(bucket_id = 'gum-photos') AND (auth.role() = 'authenticated')`

### 4. Edge Functions — deploy all five

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Secrets
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-api-key
supabase secrets set EXPORT_API_TOKEN=$(openssl rand -hex 32)   # save this for data API clients

# Deploy
supabase functions deploy verify-gum
supabase functions deploy export-geojson
supabase functions deploy send-nearby-notification
supabase functions deploy neighbourhood-stats
supabase functions deploy data-api
```

**Set up the push notification webhook** (triggers `send-nearby-notification` on every new report):

Supabase dashboard → **Database → Webhooks → Create webhook**:
- Table: `gum_reports`, Event: `INSERT`
- URL: `https://<project-ref>.supabase.co/functions/v1/send-nearby-notification`
- Headers: `Authorization: Bearer <service-role-key>`

**Set up the weekly stats cron** (refreshes neighbourhood trends every Sunday):

Supabase dashboard → **Database → Extensions** → enable `pg_cron`, then:

```sql
select cron.schedule(
  'refresh-neighbourhood-stats',
  '0 0 * * 0',
  $$ select net.http_post(
       url := 'https://<project-ref>.supabase.co/functions/v1/neighbourhood-stats',
       headers := '{"Authorization":"Bearer <service-role-key>"}'::jsonb
     ) $$
);
```

### 5. Environment Variables

```bash
cp .env.example .env.local
```

Fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_SENTRY_DSN=          # optional — get from sentry.io
```

### 6. Install & Run

```bash
npm install
npx expo start
```

Use the **Expo Go** app to scan the QR code. For production builds:

```bash
npm install -g eas-cli
eas build --platform android --profile preview   # internal .apk
eas build --platform ios --profile production    # App Store build
```

---

## Data API (for city clients / researchers)

Base URL: `https://<project-ref>.supabase.co/functions/v1/data-api`

All endpoints require: `Authorization: Bearer <token>`

**Create a client token:**
```bash
TOKEN=$(openssl rand -hex 32)
HASH=$(echo -n "$TOKEN" | sha256sum | cut -d' ' -f1)
# Insert into api_clients: { name: "City of X", token_hash: "$HASH" }
```

| Endpoint | Description |
|---|---|
| `GET /reports?bbox=minLng,minLat,maxLng,maxLat` | GeoJSON FeatureCollection of reports in bbox |
| `GET /reports?bbox=...&verified_only=true` | Verified-only subset |
| `GET /reports?bbox=...&surface=sidewalk` | Filter by surface type |
| `GET /neighbourhood-stats?bbox=...&weeks=4` | Weekly aggregated stats grid |
| `GET /summary` | Global totals + by-surface breakdown |

Response format defaults to GeoJSON; add `&format=json` for raw JSON.

---

## Project Structure

```
GumApp/
├── App.tsx                                    # Root: auth gate, Sentry, onboarding, push
├── app.config.ts                              # Expo config + env injection
├── eas.json                                   # EAS build profiles
├── src/
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── OnboardingScreen.tsx               # 6-slide first-launch flow
│   │   ├── MapScreen.tsx                      # Markers + heatmap toggle
│   │   ├── ReportScreen.tsx                   # Report with photo + surface tag
│   │   ├── LeaderboardScreen.tsx
│   │   ├── ProfileScreen.tsx
│   │   ├── TrendsScreen.tsx                   # Weekly nearby activity
│   │   ├── AdminStatsScreen.tsx               # Owner-only stats view
│   │   └── PrivacyPolicyScreen.tsx
│   ├── navigation/
│   │   ├── AppNavigator.tsx                   # 5-tab navigator + profile stack
│   │   └── AuthNavigator.tsx
│   ├── components/
│   │   └── EmailVerificationBanner.tsx
│   ├── lib/
│   │   └── supabase.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useOnboarding.ts
│   │   └── usePushNotifications.ts
│   └── types/
│       └── index.ts
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql             # Base schema + RLS
│   │   ├── 002_phase1.sql                     # GPS accuracy, rate limit, dedup RPCs
│   │   ├── 003_phase2.sql                     # Surface type, status, stats RPCs
│   │   ├── 004_phase3.sql                     # push_token column
│   │   └── 005_phase4.sql                     # api_clients, neighbourhood_stats tables
│   └── functions/
│       ├── verify-gum/                        # Claude vision photo check
│       ├── export-geojson/                    # Simple token-gated GeoJSON export
│       ├── send-nearby-notification/          # Webhook → Expo push
│       ├── neighbourhood-stats/               # Cron: refresh weekly grid
│       └── data-api/                          # Full data API for city clients
└── .env.example
```

---

## Scoring System

| Action | Total Reports | Verified (leaderboard) |
|---|---|---|
| Report, no photo | +1 | — |
| Report + unverified photo | +1 | — |
| Report + verified gum photo | +1 | +1 |
