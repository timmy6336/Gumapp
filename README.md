# GumApp 🍬

A mobile app for reporting chewing gum found on the street. GPS-enabled map view, photo verification via Claude AI, user profiles, and a leaderboard.

## Features

- **Gum Map** — Real-time map showing all reported gum around you
- **Report Gum** — One-tap reporting with optional photo upload
- **AI Verification** — Claude Haiku vision confirms photos actually show gum; only verified reports count toward your score
- **Leaderboard** — Ranked by verified reports
- **Profiles** — Track your total and verified report counts

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo (managed workflow) |
| Backend | Supabase (PostgreSQL + PostGIS, Auth, Storage, Realtime) |
| Map | react-native-maps |
| GPS | expo-location |
| Photos | expo-image-picker |
| AI | Claude claude-haiku-4-5-20251001 (vision) via Supabase Edge Function |

---

## Setup

### 1. Supabase Project

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **Settings → API** and copy your **Project URL** and **anon public key**

### 2. Database

Run the migration in the Supabase SQL editor:

```
supabase/migrations/001_initial_schema.sql
```

Or use the Supabase CLI:

```bash
supabase db push
```

### 3. Storage Bucket

In the Supabase dashboard → **Storage**, create a bucket named **`gum-photos`** and set it to **Public**.

Then add these RLS policies for the bucket in **Storage → Policies**:

- **SELECT** policy: allow for all (public read)
- **INSERT** policy: `(bucket_id = 'gum-photos') AND (auth.role() = 'authenticated')`

### 4. Supabase Edge Function

Install the Supabase CLI if you haven't:

```bash
npm install -g supabase
```

Log in and link your project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Set the Anthropic API key as a secret (never commit this):

```bash
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-api-key
```

Deploy the edge function:

```bash
supabase functions deploy verify-gum
```

### 5. Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase URL and anon key:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 6. Install Dependencies

```bash
npm install
```

### 7. Run the App

```bash
# Start Expo dev server
npx expo start

# Or target a specific platform
npx expo start --android
npx expo start --ios
```

Use the **Expo Go** app on your phone to scan the QR code, or run on an emulator.

---

## Project Structure

```
GumApp/
├── App.tsx                          # Root component, auth gate
├── app.config.ts                    # Expo config with env var injection
├── src/
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   ├── MapScreen.tsx            # GPS map with all gum markers
│   │   ├── ReportScreen.tsx         # Submit a new gum report
│   │   ├── LeaderboardScreen.tsx    # Top reporters by verified count
│   │   └── ProfileScreen.tsx        # User stats and settings
│   ├── navigation/
│   │   ├── AppNavigator.tsx         # Bottom tab navigator (logged in)
│   │   └── AuthNavigator.tsx        # Login / Register flow
│   ├── lib/
│   │   └── supabase.ts              # Supabase client singleton
│   ├── hooks/
│   │   └── useAuth.ts               # Session management hook
│   └── types/
│       └── index.ts                 # Shared TypeScript types
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql   # DB schema + RLS policies
│   └── functions/
│       └── verify-gum/
│           └── index.ts             # Deno edge function (Claude vision)
└── .env.example                     # Template for env vars
```

---

## Scoring System

| Action | Total Reports | Verified Reports (leaderboard) |
|---|---|---|
| Report gum, no photo | +1 | +0 |
| Report gum + photo (not gum) | +1 | +0 |
| Report gum + verified gum photo | +1 | +1 |

Only the **Verified Reports** column is used for leaderboard ranking.
