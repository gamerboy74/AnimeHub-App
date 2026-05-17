# NEON CURATOR — Mobile App: Full Implementation Plan

> **Stack:** React Native + Expo | **Backend:** Existing Supabase + Node.js | **Target:** iOS & Android

---

## ⚠️ Pre-Flight: Do This Before Writing One Line of Code

### 1. Rotate Your Supabase Anon Key — NOW

Your current anon key is exposed in your planning document which is stored in a shared environment. It is readable.

```
Supabase Dashboard → Project Settings → API → Regenerate anon key
```

Update `.env` everywhere after rotation. This takes 60 seconds. Do it first.

### 2. Decide Platform Target

| Choice | Implication |
|---|---|
| Android only | No Apple Developer account needed. Faster start. |
| iOS + Android | Requires Apple Developer account ($99/year). Requires EAS Build for iOS CI/CD. |
| Both (recommended) | Expo EAS handles cross-platform builds from a single codebase. |

Lock this decision before setting up CI/CD. Everything else flows from it.

---

## 1. Why React Native + Expo (Not a Web Wrapper)

Your plan mistakenly proposed React/Vite again — that's a PWA, not a mobile app. Here's the definitive decision tree:

| Option | Verdict | Reason |
|---|---|---|
| React Native + Expo | ✅ Use this | Reuses your Supabase hooks, TanStack Query, auth logic. Native video performance. |
| Flutter | ❌ Skip | Full rewrite in Dart. Zero code reuse from your web app. |
| Capacitor / Ionic | ❌ Skip | WebView wrapper. HLS video in a WebView is broken on iOS. Performance is unacceptable for a streaming app. |
| PWA | ❌ Skip | No push notifications on iOS. No app store presence. Not a real mobile app. |

**The core argument:** Your Supabase client, TanStack Query hooks, auth context, and business logic are framework-agnostic TypeScript. They port to React Native with zero changes. You're only rewriting the UI layer.

---

## 2. Final Tech Stack

```
neon-curator-mobile/
├── Runtime
│   ├── React Native 0.76+          — Native renderer (New Architecture enabled)
│   └── Expo SDK 52+                — Managed workflow, EAS Build, OTA updates
│
├── Navigation
│   └── expo-router 4+              — File-based routing (same mental model as Next.js)
│
├── Backend / Data
│   ├── @supabase/supabase-js       — SAME CLIENT. Zero rewrite.
│   ├── @tanstack/react-query       — SAME HOOKS. Zero rewrite.
│   └── zustand                     — Global state (player, auth). Lighter than Context for perf-critical screens.
│
├── UI / Styling
│   ├── NativeWind v4               — Tailwind for React Native. Your color tokens transfer directly.
│   └── react-native-reanimated 3   — Gesture animations (player scrubber, swipe navigation)
│
├── Video
│   ├── expo-video                  — HLS playback (uses AVPlayer on iOS, ExoPlayer on Android)
│   └── react-native-gesture-handler — Touch gestures on player overlay
│
├── Device Features
│   ├── expo-notifications          — Push notifications (new episode alerts)
│   ├── expo-screen-orientation     — Lock player to landscape
│   ├── expo-linking                — Deep links from push notifications
│   └── @react-native-async-storage/async-storage — Local persistence
│
├── Performance
│   ├── @shopify/flash-list         — Replaces FlatList. 10x faster for large anime grids.
│   └── expo-image                  — Replaces Image. GPU-accelerated, lazy loading, blur-hash placeholders.
│
└── Infrastructure
    ├── EAS Build                   — Cloud builds for iOS + Android
    ├── EAS Update                  — OTA JS updates without app store review
    └── EAS Submit                  — Automated app store submission
```

---

## 3. Project Initialization

```bash
# Install Expo CLI
npm install -g expo eas-cli

# Create project
npx create-expo-app neon-curator-mobile --template blank-typescript
cd neon-curator-mobile

# Core dependencies
npx expo install expo-router expo-video expo-notifications expo-screen-orientation
npx expo install expo-linking expo-image react-native-gesture-handler react-native-reanimated
npx expo install @supabase/supabase-js @tanstack/react-query zustand
npx expo install @shopify/flash-list @react-native-async-storage/async-storage

# NativeWind
npm install nativewind tailwindcss
npx tailwindcss init

# EAS setup
eas init
eas build:configure
```

### `app.json` — Critical Config

```json
{
  "expo": {
    "name": "Neon Curator",
    "slug": "neon-curator",
    "scheme": "neoncurator",
    "version": "1.0.0",
    "platforms": ["ios", "android"],
    "ios": {
      "bundleIdentifier": "com.yourname.neoncurator",
      "supportsTablet": true,
      "infoPlist": {
        "NSCameraUsageDescription": "Required for profile photo",
        "UIBackgroundModes": ["audio"]
      }
    },
    "android": {
      "package": "com.yourname.neoncurator",
      "permissions": ["RECEIVE_BOOT_COMPLETED", "VIBRATE"]
    },
    "plugins": [
      "expo-router",
      "expo-notifications",
      ["expo-screen-orientation", { "initialOrientation": "PORTRAIT" }]
    ]
  }
}
```

---

## 4. Design System — Zero Rewrite

Your existing Neon color palette from the web app ports directly to `tailwind.config.js`:

```javascript
// tailwind.config.js
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // EXACT SAME TOKENS FROM YOUR WEB APP
        "primary":                "#bd9dff",
        "primary-dim":            "#8a4cfc",
        "secondary":              "#00e3fd",
        "secondary-dim":          "#00d4ec",
        "tertiary":               "#ff7346",
        "background":             "#0e0e11",
        "surface":                "#0e0e11",
        "surface-container":      "#19191d",
        "surface-container-high": "#1f1f23",
        "surface-container-highest": "#25252a",
        "on-surface":             "#f0edf1",
        "on-surface-variant":     "#acaaae",
        "outline-variant":        "#48474b",
        "error":                  "#ff6e84",
      },
      fontFamily: {
        headline: ["SpaceGrotesk_700Bold"],
        body: ["BeVietnamPro_400Regular"],
        "body-bold": ["BeVietnamPro_700Bold"],
      },
    },
  },
  plugins: [],
}
```

**Font setup** — React Native requires loading fonts via `expo-font`:

```typescript
// app/_layout.tsx
import { useFonts, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { BeVietnamPro_400Regular, BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro';
```

---

## 5. Folder Architecture

```
neon-curator-mobile/
├── app/                              # expo-router screens
│   ├── _layout.tsx                   # Root layout: QueryClient, AuthProvider, fonts
│   ├── (tabs)/
│   │   ├── _layout.tsx               # Tab bar config (Home, Explore, Library, Admin)
│   │   ├── index.tsx                 # Home screen (hero + trending carousels)
│   │   ├── explore.tsx               # Browse by genre (bento grid)
│   │   ├── library.tsx               # Watchlist, history, favorites
│   │   └── admin.tsx                 # Admin dashboard (role-gated)
│   ├── anime/
│   │   └── [id].tsx                  # Anime detail + episode list
│   ├── watch/
│   │   └── [episodeId].tsx           # Full-screen video player
│   ├── auth/
│   │   ├── login.tsx
│   │   └── signup.tsx
│   └── +not-found.tsx
│
├── components/
│   ├── ui/
│   │   ├── AnimeCard.tsx             # Poster card with FlashList
│   │   ├── EpisodeCard.tsx           # Episode thumbnail + progress bar
│   │   ├── GenreBadge.tsx
│   │   └── ProgressBar.tsx           # Glowing neon progress bar
│   ├── player/
│   │   ├── VideoPlayer.tsx           # expo-video wrapper
│   │   ├── PlayerControls.tsx        # Play/pause/seek overlay
│   │   ├── GestureLayer.tsx          # Swipe gestures on player
│   │   └── NextEpisodeBanner.tsx     # "Up next in 5s" countdown
│   └── layout/
│       ├── GlassHeader.tsx           # Frosted glass top bar
│       └── NeonTabBar.tsx            # Custom bottom tab navigator
│
├── hooks/
│   ├── useAnime.ts                   # Fetches anime list, detail (reuse from web)
│   ├── useEpisodes.ts                # Fetches episode list by anime ID
│   ├── useWatchProgress.ts           # Read/write progress to Supabase
│   ├── useAuth.ts                    # Auth state (reuse from web)
│   └── useLibrary.ts                 # Watchlist CRUD
│
├── stores/
│   ├── playerStore.ts                # Zustand: current episode, playback state
│   └── authStore.ts                  # Zustand: user session
│
├── lib/
│   ├── supabase.ts                   # SAME client setup as web app
│   ├── queryClient.ts                # TanStack QueryClient singleton
│   └── notifications.ts              # Expo push token registration
│
├── services/
│   ├── anime.ts                      # SAME service functions as web app
│   ├── auth.ts                       # SAME auth service as web app
│   └── progress.ts                   # Watch progress sync
│
└── types/
    └── database.ts                   # SAME generated Supabase types as web app
```

---

## 6. Supabase Integration — Zero Rewrite

Your existing client and services transfer without changes. The only mobile-specific addition is AsyncStorage for session persistence:

```typescript
// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,          // ← only mobile-specific change
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,      // ← required for React Native
    },
  }
);
```

**Environment variables** — Expo uses `EXPO_PUBLIC_` prefix, not `VITE_`:

```env
# .env
EXPO_PUBLIC_SUPABASE_URL=https://ieopfdxgjlmdsidikgbj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_rotated_key_here
EXPO_PUBLIC_BACKEND_URL=https://your-backend.com
```

---

## 7. Navigation — expo-router

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { NeonTabBar } from '../../components/layout/NeonTabBar';

export default function TabLayout() {
  return (
    <Tabs tabBar={props => <NeonTabBar {...props} />}>
      <Tabs.Screen name="index"   options={{ title: 'Home',    headerShown: false }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', headerShown: false }} />
      <Tabs.Screen name="library" options={{ title: 'Library', headerShown: false }} />
      <Tabs.Screen name="admin"   options={{ title: 'Admin',   headerShown: false }} />
    </Tabs>
  );
}
```

**Route map:**

| Route | Screen |
|---|---|
| `/(tabs)/` | Home — hero + trending carousels |
| `/(tabs)/explore` | Browse by genre |
| `/(tabs)/library` | Watchlist, history, favorites |
| `/(tabs)/admin` | Admin dashboard (protected) |
| `/anime/[id]` | Anime detail + episode list |
| `/watch/[episodeId]` | Full-screen video player |
| `/auth/login` | Login |
| `/auth/signup` | Sign up |

**Deep link example** (for push notifications):

```
neoncurator://watch/episode_123
neoncurator://anime/anime_456
```

---

## 8. Screen Implementations

### 8.1 Home Screen

```typescript
// app/(tabs)/index.tsx
import { FlashList } from '@shopify/flash-list';
import { useAnimeList } from '../../hooks/useAnime';
import { AnimeCard } from '../../components/ui/AnimeCard';

export default function HomeScreen() {
  const { data: trending } = useAnimeList({ sort: 'trending', limit: 20 });
  const { data: continueWatching } = useWatchProgress();

  return (
    <View className="flex-1 bg-background">
      <HeroSection />                  {/* Featured anime with backdrop */}
      <GenreFilterChips />             {/* Horizontal scrollable chips */}
      <SectionCarousel
        title="Continue Watching"
        data={continueWatching}
        renderItem={({ item }) => <EpisodeCard episode={item} showProgress />}
      />
      <SectionCarousel
        title="Trending Now"
        data={trending}
        renderItem={({ item }) => <AnimeCard anime={item} />}
      />
    </View>
  );
}
```

**Performance rules for carousels:**
- Always use `FlashList` instead of `FlatList`. Set `estimatedItemSize`.
- Use `expo-image` instead of `Image`. It handles caching, progressive loading, and blur-hash placeholders.
- Never render more than 2 nested `FlashList` components — use a single vertical `FlashList` with section headers.

### 8.2 Anime Detail Screen

```typescript
// app/anime/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { useAnimeById } from '../../hooks/useAnime';
import { useEpisodes } from '../../hooks/useEpisodes';

export default function AnimeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: anime } = useAnimeById(id);
  const { data: episodes } = useEpisodes(id);

  return (
    <FlashList
      data={episodes}
      ListHeaderComponent={<AnimeHeroHeader anime={anime} />}
      renderItem={({ item }) => <EpisodeCard episode={item} />}
      estimatedItemSize={120}
    />
  );
}
```

### 8.3 Video Player Screen — The Core Feature

This screen is the hardest to build correctly. Follow this exactly.

```typescript
// app/watch/[episodeId].tsx
import { useEffect } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { GestureLayer } from '../../components/player/GestureLayer';
import { PlayerControls } from '../../components/player/PlayerControls';

export default function WatchScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const { data: episode } = useEpisode(episodeId);
  
  // Prevent screen sleep during playback
  useKeepAwake();

  // Lock to landscape on mount, restore on unmount
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const player = useVideoPlayer(episode?.hlsUrl, p => {
    p.play();
  });

  // Sync progress to Supabase every 10 seconds
  useProgressSync(player, episodeId);

  return (
    <View className="flex-1 bg-black">
      <VideoView
        player={player}
        style={{ flex: 1 }}
        nativeControls={false}        // ← We build our own neon controls
      />
      <GestureLayer player={player} />
      <PlayerControls player={player} episode={episode} />
    </View>
  );
}
```

**Gesture implementation:**

```typescript
// components/player/GestureLayer.tsx
// Horizontal swipe → seek ±10s
// Vertical swipe left side → brightness
// Vertical swipe right side → volume
// Double tap left → rewind 10s
// Double tap right → forward 10s
// Single tap center → toggle controls visibility
```

**Progress sync hook:**

```typescript
// hooks/useProgressSync.ts
export function useProgressSync(player: VideoPlayer, episodeId: string) {
  const { mutate: saveProgress } = useMutation({
    mutationFn: (position: number) =>
      supabase.from('user_progress').upsert({
        episode_id: episodeId,
        position_seconds: Math.floor(position),
        updated_at: new Date().toISOString(),
      })
  });

  useEffect(() => {
    const interval = setInterval(() => {
      saveProgress(player.currentTime);
    }, 10_000);
    return () => clearInterval(interval);
  }, [player, episodeId]);
}
```

---

## 9. Push Notifications — New Episode Alerts

This is what turns your app from a content viewer into a sticky product. Without notifications, users forget you exist.

### 9.1 Register Push Token on Login

```typescript
// lib/notifications.ts
import * as Notifications from 'expo-notifications';

export async function registerPushToken(userId: string) {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // Store in Supabase
  await supabase
    .from('users')
    .update({ push_token: token })
    .eq('id', userId);
}
```

### 9.2 Add `push_token` Column to Supabase

```sql
-- Migration
ALTER TABLE users ADD COLUMN push_token TEXT;
CREATE INDEX idx_users_push_token ON users(push_token) WHERE push_token IS NOT NULL;
```

### 9.3 Backend — Send Notifications After Scraping

```typescript
// backend/services/notificationService.ts
// Call this after your scraper successfully adds a new episode

async function notifySubscribers(animeId: string, episodeNumber: number) {
  // Get push tokens of users who have this anime in watchlist
  const { data: tokens } = await supabase
    .from('watchlist')
    .select('users(push_token)')
    .eq('anime_id', animeId)
    .not('users.push_token', 'is', null);

  const messages = tokens.map(({ users }) => ({
    to: users.push_token,
    sound: 'default',
    title: 'New Episode Available',
    body: `Episode ${episodeNumber} is ready to watch`,
    data: { animeId, episodeNumber },   // Used for deep linking
  }));

  // Send via Expo Push API (free, no server needed)
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
}
```

### 9.4 Handle Notification Tap → Deep Link to Episode

```typescript
// app/_layout.tsx
Notifications.addNotificationResponseReceivedListener(response => {
  const { animeId } = response.notification.request.content.data;
  router.push(`/anime/${animeId}`);
});
```

---

## 10. Offline Support

**Minimum viable offline (v1):**

- Cache the continue-watching list in AsyncStorage. Users see their progress even with no network.
- Cache anime posters via `expo-image` (automatic, disk-persisted).
- Queue failed progress saves and retry on reconnect using TanStack Query's `networkMode: 'offlineFirst'`.

**Full offline downloads (v2 — do not build in v1):**

Episode download requires background download management, storage permission handling, encrypted local storage for DRM content, and a download queue UI. This is a significant feature. Scope it separately.

```typescript
// lib/queryClient.ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',     // Serve cache when offline
      staleTime: 5 * 60 * 1000,        // 5 minutes
      gcTime: 24 * 60 * 60 * 1000,     // 24 hours cache retention
    },
  },
});
```

---

## 11. Backend — What Changes, What Doesn't

Your existing Node.js backend requires two additions for mobile. Everything else stays the same.

### Additions

**One — Push notification endpoint:**

```typescript
// server/routes/notifications.ts
router.post('/push-token', authenticate, async (req, res) => {
  const { token } = req.body;
  await supabase
    .from('users')
    .update({ push_token: token })
    .eq('id', req.user.id);
  res.json({ success: true });
});
```

**Two — Notify after scrape (add to your scheduler):**

```typescript
// In your existing episode scraper, after successful insert:
await notificationService.notifySubscribers(animeId, episodeNumber);
```

### What Stays Identical

- Supabase schema and all existing tables
- `search_anime_optimized` RPC function
- Redis caching layer
- Episode scraper logic and scheduler
- Auth flow (Supabase Auth works identically on mobile)

---

## 12. App Store Compliance — The Risk Your Plan Ignored

This is a real blocker. Address it before submitting.

**The problem:** Both Apple (App Store Review Guideline 4.2) and Google (Developer Policy) reject apps that primarily serve scraped/pirated content from third-party sources.

**Your options:**

| Strategy | Risk | Effort |
|---|---|---|
| Backend proxies all video URLs — app never sees source domain | Medium | Low — already how it should work |
| Only show content from licensed sources (e.g., Crunchyroll via API) | Low | High — different content pipeline |
| Use API sources that have licensing agreements | Low-Medium | Medium |
| Submit for Android only (Google is less strict on initial review) | Lower initial risk | None |

**The pragmatic path for v1:** Ensure your backend is the intermediary for all video URLs. The app requests `GET /api/stream/:episodeId` from your backend, which returns a signed proxy URL. The app never knows the source is hianime. This passes review more reliably because the app itself appears to be serving its own content.

---

## 13. Database — Required Schema Changes for Mobile

```sql
-- 1. Push tokens
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;

-- 2. Watch progress (may already exist — verify)
CREATE TABLE IF NOT EXISTS user_progress (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  episode_id   UUID REFERENCES episodes(id) ON DELETE CASCADE,
  position_seconds INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  completed    BOOLEAN DEFAULT FALSE,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, episode_id)
);

-- 3. Watchlist (may already exist — verify)
CREATE TABLE IF NOT EXISTS watchlist (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  anime_id  UUID REFERENCES anime(id) ON DELETE CASCADE,
  added_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, anime_id)
);

-- 4. Index for notification queries
CREATE INDEX IF NOT EXISTS idx_watchlist_anime_user ON watchlist(anime_id, user_id);
```

---

## 14. State Management — Zustand Over Context

For performance-critical screens (player, explore grid), use Zustand instead of React Context. Context re-renders every subscriber on any state change. Zustand doesn't.

```typescript
// stores/playerStore.ts
import { create } from 'zustand';

interface PlayerStore {
  currentEpisodeId: string | null;
  isPlaying: boolean;
  position: number;
  setEpisode: (id: string) => void;
  setPosition: (pos: number) => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  currentEpisodeId: null,
  isPlaying: false,
  position: 0,
  setEpisode: (id) => set({ currentEpisodeId: id, position: 0 }),
  setPosition: (pos) => set({ position: pos }),
}));
```

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';

interface AuthStore {
  session: Session | null;
  setSession: (session: Session | null) => void;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  setSession: (session) => set({ session }),
  isAdmin: () => get().session?.user?.user_metadata?.role === 'admin',
}));
```

---

## 15. Admin Screen — Mobile Considerations

Your admin dashboard works on mobile but needs adaptation. The full desktop layout doesn't translate. Mobile admin should be a simplified view:

- Live viewer count (stat card)
- New signups today (stat card)
- Pending content reports (action list with approve/reject)
- Recent content pipeline status (vertical list, not table)

The full admin experience stays on your web app. Mobile admin is triage-only. Do not try to port the entire dashboard — it's a waste of time for v1.

---

## 16. CI/CD with EAS

### Build Configuration (`eas.json`)

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": { "simulator": false }
    }
  },
  "submit": {
    "production": {
      "android": { "serviceAccountKeyPath": "./google-service-account.json" },
      "ios": { "appleId": "your@email.com", "ascAppId": "YOUR_APP_ID" }
    }
  }
}
```

### Build Commands

```bash
# Development build (run on device with Expo Go)
eas build --profile development --platform android

# Preview APK (share with testers)
eas build --profile preview --platform android

# Production build
eas build --profile production --platform all

# OTA update (JS changes only — no app store review)
eas update --branch production --message "Fix player seek bug"

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

---

## 17. Performance Checklist

Before shipping, verify every item:

```
UI Performance
├── [ ] All lists use FlashList with estimatedItemSize set
├── [ ] All images use expo-image (never the RN Image component)
├── [ ] No inline arrow functions in FlashList renderItem
├── [ ] Anime card and episode card are wrapped in React.memo
├── [ ] Heavy screens (explore grid) use useMemo for filtered data
└── [ ] No logic in render — computed values in hooks

Video Player
├── [ ] Player locks to landscape on mount, unlocks on unmount
├── [ ] useKeepAwake() active during playback
├── [ ] Progress saves every 10 seconds (not on every frame)
├── [ ] Player is destroyed when navigating away (memory leak)
└── [ ] HLS stream URL fetched from backend, not hardcoded

Network
├── [ ] TanStack Query staleTime set (not every navigation triggers a fetch)
├── [ ] Images lazy load (expo-image handles this automatically)
├── [ ] QueryClient persisted to AsyncStorage for offline cache
└── [ ] Supabase realtime disabled on screens that don't need it (save battery)

Auth & Security
├── [ ] Supabase anon key rotated (do this first)
├── [ ] Admin screens check role BEFORE rendering (not after)
├── [ ] Deep links validated before navigation (no open redirect)
└── [ ] Push tokens stored per-user, cleared on logout
```

---

## 18. Build Sequence — Week by Week

Do not skip phases. Each phase must be fully working before starting the next.

**Week 1 — Foundation**
- Initialize Expo project with expo-router
- Supabase connection confirmed (Explore screen with real anime data)
- Auth flow: login, signup, session persistence
- Bottom tab navigation with Neon design system

**Week 2 — Content Screens**
- Home screen: hero + trending carousels
- Explore screen: genre grid with FlashList
- Anime detail screen: info + episode list
- Library screen: watchlist + continue watching

**Week 3 — Video Player**
- Basic HLS playback with expo-video
- Landscape lock + screen awake
- Custom neon player controls overlay
- Progress sync to Supabase

**Week 4 — Notifications + Polish**
- Push token registration on login
- Backend integration: notify on new episode
- Deep links from notifications → episodes
- Player gesture layer (seek, volume, brightness)
- Performance audit (FlashList, expo-image, memo)

**Post-Launch**
- Offline download queue (v2)
- Player gesture refinement
- Admin dashboard mobile view
- App store optimization (screenshots, description)

---

## 19. Final Checklist Before App Store Submission

```
Build
├── [ ] Production EAS build passes for both platforms
├── [ ] No red flags in Expo Doctor (run: npx expo-doctor)
├── [ ] App icon and splash screen set (1024x1024 PNG)
└── [ ] Version and build number incremented in app.json

Security
├── [ ] Supabase anon key rotated and not in source code
├── [ ] Backend URL is production HTTPS (not localhost)
├── [ ] Admin route protected by role check
└── [ ] No console.log statements in production build

Legal
├── [ ] Privacy policy URL in app store listing
├── [ ] Terms of service URL in app store listing
├── [ ] Content source strategy decided (see Section 12)
└── [ ] DMCA takedown process documented

Store Assets
├── [ ] App icon 1024x1024 (iOS) and 512x512 (Android)
├── [ ] Screenshots for all required device sizes
├── [ ] App description written (include: offline, HD streaming, watchlist)
└── [ ] Age rating set appropriately for anime content
```

---

## 20. What You Reuse vs. What You Rewrite

| Asset | Reuse? | Notes |
|---|---|---|
| Supabase client setup | ✅ Yes | Add AsyncStorage adapter only |
| All service functions (anime.ts, auth.ts) | ✅ Yes | Zero changes |
| TanStack Query hooks | ✅ Yes | Zero changes |
| Zustand stores | ✅ Yes (create new) | Lighter than your web Context |
| Design token colors | ✅ Yes | Paste into NativeWind config |
| Generated Supabase types | ✅ Yes | Copy types/database.ts |
| Supabase schema and tables | ✅ Yes | Add 3 columns for mobile |
| Backend scraper and scheduler | ✅ Yes | Add notification call only |
| HTML UI components | ❌ No | Rewrite as React Native components |
| Tailwind CSS classes | ⚠️ Partial | NativeWind supports most classes, not all |
| Web-specific APIs (window, document) | ❌ No | Use React Native equivalents |
| react-router-dom | ❌ No | Replace with expo-router |
| Browser video player | ❌ No | Replace with expo-video |

---

*Plan version 2.0 — Mobile-first, production-grade. Built on the same Supabase backend. No rewrites where avoidable. No shortcuts where they matter.*
