import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StatusBar, StyleSheet, Image, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useEpisodeDetails, useAnimeDetails, useEpisodes,
  useWatchProgress, useSimilarAnime
} from '../../src/hooks/useQueries';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/constants/theme';

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
// How often (ms) the injected JS polls the player for current time
const POLL_INTERVAL_MS = 5000;

// How many seconds from the end triggers the "Up Next" card
const NEAR_END_THRESHOLD_FALLBACK = 60;

// Minimum seconds watched before we bother saving progress
const MIN_PROGRESS_SECONDS = 5;

// ─── INJECTED JAVASCRIPT ───────────────────────────────────────────────────────
// This runs inside the WebView. It polls JWPlayer for state and posts messages
// back to React Native. It also exposes a seekTo() function so we can resume.
const buildInjectedJS = (resumeSeconds: number) => `
  (function() {
    // --- Kill popups at the JS layer ---
    window.open = function() { return null; };

    // --- Seek helper called from RN once player is ready ---
    window.__rn_seek = function(seconds) {
      try {
        var p = jwplayer();
        if (p && typeof p.seek === 'function' && seconds > 5) {
          p.seek(seconds);
        }
      } catch(e) {}
    };

    // --- Wait for JWPlayer to be available ---
    var attempts = 0;
    var resumeApplied = false;
    var pollInterval = null;

    function startPolling() {
      pollInterval = setInterval(function() {
        try {
          var p = jwplayer();
          if (!p || typeof p.getPosition !== 'function') return;

          var current  = Math.floor(p.getPosition());
          var duration = Math.floor(p.getDuration());
          var state    = p.getState(); // 'playing' | 'paused' | 'idle' | 'buffering'

          // Apply resume once we know duration > 0
          if (!resumeApplied && duration > 5 && ${resumeSeconds} > 5) {
            resumeApplied = true;
            p.seek(${resumeSeconds});
          }

          // Post state to React Native
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type:     'progress',
            current:  current,
            duration: duration,
            playing:  state === 'playing',
          }));
        } catch(e) {
          // JWPlayer not ready yet — silently retry
        }
      }, ${POLL_INTERVAL_MS});
    }

    // Poll for JWPlayer availability (some embeds lazy-load it)
    var readyCheck = setInterval(function() {
      attempts++;
      try {
        var p = jwplayer();
        if (p && typeof p.getPosition === 'function') {
          clearInterval(readyCheck);
          startPolling();
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'player_ready' }));
        }
      } catch(e) {}

      // Give up after 15s — not a JWPlayer embed
      if (attempts > 30) {
        clearInterval(readyCheck);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'player_not_found' }));
      }
    }, 500);

    // Also catch HTML5 video directly (fallback if no JWPlayer)
    document.addEventListener('DOMContentLoaded', function() {
      var videos = document.querySelectorAll('video');
      if (videos.length === 0) return;
      var vid = videos[0];

      // Resume for plain HTML5 video
      vid.addEventListener('loadedmetadata', function() {
        if (!resumeApplied && ${resumeSeconds} > 5) {
          resumeApplied = true;
          vid.currentTime = ${resumeSeconds};
        }
      });

      setInterval(function() {
        if (isNaN(vid.duration)) return;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type:     'progress',
          current:  Math.floor(vid.currentTime),
          duration: Math.floor(vid.duration),
          playing:  !vid.paused,
        }));
      }, ${POLL_INTERVAL_MS});
    });
  })();
  true; // required by react-native-webview
`;

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function WatchScreen() {
  const { id } = useLocalSearchParams();
  const router  = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets(); // landscape: left/right insets for notch/cutout

  // UI state
  const [showSelector, setShowSelector]   = useState(false);
  const [showNextUp,   setShowNextUp]     = useState(false);
  const [resumeToast,  setResumeToast]    = useState(false);
  const [playerReady,  setPlayerReady]    = useState(false);
  const [playerError,  setPlayerError]    = useState(false);
  const [playerState,  setPlayerState]    = useState({ isPlaying: false, current: 0, duration: 0 });

  const webviewRef        = useRef<any>(null);
  const nearEndFired      = useRef(false);
  const lastSavedRef      = useRef(0);    // timestamp of last Supabase write
  const spinnerTimeoutRef = useRef<any>(null); // auto-dismiss loading spinner

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: episode,  isLoading: loadingEp }   = useEpisodeDetails(id as string);
  const { data: anime,    isLoading: loadingAnime } = useAnimeDetails(episode?.anime_id);
  const { data: episodes }                          = useEpisodes(episode?.anime_id);
  const { data: savedProgress }                     = useWatchProgress(id as string);
  const { data: similarAnime }                      = useSimilarAnime(anime?.genres, anime?.id);

  const resumeSeconds = savedProgress?.progress_seconds ?? 0;

  const nextEpisode = episodes?.find(
    e => e.episode_number === (episode?.episode_number ?? 0) + 1
  );

  // ── Prefetch next 3 episodes ──────────────────────────────────────────────
  useEffect(() => {
    if (!episodes || !episode) return;
    const currentNum = episode.episode_number ?? 0;

    // Grab next 3 episodes by episode_number
    const upcoming = episodes
      .filter(e => e.episode_number > currentNum)
      .sort((a, b) => a.episode_number - b.episode_number)
      .slice(0, 3);

    upcoming.forEach(ep => {
      queryClient.prefetchQuery({
        queryKey: ['episode', ep.id],
        staleTime: 10 * 60 * 1000,
        queryFn: async () => {
          const { data } = await supabase
            .from('episodes')
            .select('*')
            .eq('id', ep.id)
            .single();
          return data;
        },
      });
    });
  }, [episodes, episode?.id]);

  // ── Resume toast ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (resumeSeconds > 5) {
      setResumeToast(true);
      const t = setTimeout(() => setResumeToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [resumeSeconds]);

  // ── Progress sync to Supabase (throttled to 1 write per 10s) ────────────────
  const handleProgress = useCallback(async (current: number, duration: number) => {
    if (!user || !episode || current < MIN_PROGRESS_SECONDS) return;

    const now = Date.now();
    if (now - lastSavedRef.current < 10_000) return; // throttle
    lastSavedRef.current = now;

    await supabase.from('user_watch_progress').upsert({
      user_id:          user.id,
      episode_id:       episode.id,
      progress_seconds: current,
      is_completed:     duration > 0 && current > duration * 0.9,
      last_watched:     new Date().toISOString(),
    }, { onConflict: 'user_id,episode_id' });
  }, [user, episode]);

  // ── WebView message handler ───────────────────────────────────────────────
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'player_ready') {
        setPlayerReady(true);
        setPlayerError(false);
      }

      if (msg.type === 'player_not_found') {
        // Not JWPlayer — HTML5 fallback is still running, no action needed
        setPlayerReady(true);
      }

      if (msg.type === 'progress') {
        const { current, duration, playing } = msg;

        setPlayerState({ isPlaying: playing, current, duration });
        handleProgress(current, duration);

        // Near-end detection — fire once per episode
        if (!nearEndFired.current && duration > 0) {
          const threshold = Math.min(NEAR_END_THRESHOLD_FALLBACK, duration * 0.1);
          if (duration - current < threshold && nextEpisode) {
            nearEndFired.current = true;
            setShowNextUp(true);
          }
        }
      }
    } catch (_) {}
  }, [handleProgress, nextEpisode]);

  // ── Orientation + nav bar ─────────────────────────────────────────────────
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    // Hide Android system navigation bar for full-bleed video
    NavigationBar.setVisibilityAsync('hidden');
    NavigationBar.setBehaviorAsync('overlay-swipe'); // swipe-up peeks it, then auto-hides
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      NavigationBar.setVisibilityAsync('visible'); // restore for other screens
    };
  }, []);

  useKeepAwake();

  // ── Reset state + spinner when episode changes ────────────────────────────
  useEffect(() => {
    nearEndFired.current = false;
    lastSavedRef.current  = 0;
    setShowNextUp(false);
    setPlayerReady(false);
    setPlayerError(false);

    // Auto-dismiss spinner after 8s — some embeds never fire player_ready
    if (spinnerTimeoutRef.current) clearTimeout(spinnerTimeoutRef.current);
    spinnerTimeoutRef.current = setTimeout(() => setPlayerReady(true), 8000);

    return () => { if (spinnerTimeoutRef.current) clearTimeout(spinnerTimeoutRef.current); };
  }, [id]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (loadingEp || loadingAnime) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator size="large" color={COLORS.neon} />
      </View>
    );
  }

  if (!episode) {
    return (
      <View style={styles.fullCenter}>
        <Ionicons name="warning-outline" size={48} color={COLORS.neon} />
        <Text style={styles.errorTitle}>Episode Not Found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.errorBtn}>
          <Text style={styles.errorBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Build the embed URL — use video_url directly (it's the embed page)
  const embedUrl = episode.video_url?.trim();

  if (!embedUrl) {
    return (
      <View style={styles.fullCenter}>
        <Ionicons name="cloud-offline-outline" size={56} color={COLORS.neonPink} />
        <Text style={styles.errorTitle}>Stream Unavailable</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.errorBtn, styles.errorBtnSecondary]}>
          <Text style={[styles.errorBtnText, { color: COLORS.neon }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* ── WEBVIEW PLAYER ── */}
      <WebView
        ref={webviewRef}
        source={{ uri: embedUrl }}
        style={StyleSheet.absoluteFill}
        // Allow autoplay — critical for video embeds
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={false}      // We handle our own fullscreen via orientation lock
        allowsInlineMediaPlayback={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        // Force block popups/new windows at the native layer
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        // Inject our polling + resume script once the page loads
        injectedJavaScript={buildInjectedJS(resumeSeconds)}
        onMessage={handleWebViewMessage}
        // Page HTML loaded — cancel the 8s fallback timer and show the player immediately
        onLoadEnd={() => {
          if (spinnerTimeoutRef.current) clearTimeout(spinnerTimeoutRef.current);
          setPlayerReady(true);
        }}
        // Spoof desktop user-agent so embeds don't redirect to mobile-only pages
        applicationNameForUserAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        // Kill any cookie / auth walls
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        onError={() => setPlayerError(true)}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 400) setPlayerError(true);
        }}
        // ── Redirect guard ─────────────────────────────────────────────────
        // Allow: the embed host + its subdomains (megaplay.buzz, cinewave2.site, etc.)
        // Allow: media/CDN requests (m3u8, mp4, ts segments, JS, CSS, fonts)
        // Block: any navigation to a completely unrelated domain (ads, redirects, popups)
        onShouldStartLoadWithRequest={(req) => {
          const url = req.url;

          // Block App Store/Play Store intents immediately
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            console.log('[WebView] BLOCKED intent/scheme →', url);
            return false;
          }

          // Always allow the original embed URL itself
          if (url === embedUrl || url.startsWith(embedUrl)) return true;

          // Extract hosts for comparison
          let reqHost = '';
          let embedHost = '';
          try {
            reqHost   = new URL(url).hostname;
            embedHost = new URL(embedUrl).hostname;
          } catch { return true; } // malformed URL — allow and let WebView handle it

          // Allow same host and any subdomain of the embed host
          const embedRoot = embedHost.split('.').slice(-2).join('.');
          if (reqHost === embedHost || reqHost.endsWith('.' + embedRoot)) return true;

          // Allow known video CDN / player domains that megaplay relies on
          const ALLOWED_CDNS = [
            'cinewave2.site', 'cinewave.site',
            'jwplatform.com', 'jwpcdn.com',
            'hls.js', 'cdn.jsdelivr.net',
            'cloudflare.com', 'cloudflareinsights.com',
            'googleapis.com', 'gstatic.com',
            'jquery.com',
          ];
          if (ALLOWED_CDNS.some(d => reqHost.endsWith(d))) return true;

          // Allow media segments — m3u8, mp4, ts, webm (CDN delivery)
          if (/\.(m3u8|mp4|ts|webm|aac|m4s)(\?|$)/i.test(url)) return true;

          // Block everything else — ads, trackers, redirect chains
          console.log('[WebView] BLOCKED redirect →', url);
          return false;
        }}
      />

      {/* ── LOADING INDICATOR (while player initialises) ── */}
      {!playerReady && !playerError && (
        <View style={styles.playerLoadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={COLORS.neonCyan} />
          <Text style={styles.loadingText}>Loading stream…</Text>
        </View>
      )}

      {/* ── STREAM ERROR ── */}
      {playerError && (
        <View style={styles.fullCenter}>
          <Ionicons name="cloud-offline-outline" size={56} color={COLORS.neonPink} />
          <Text style={styles.errorTitle}>Stream Unavailable</Text>
          <View style={styles.errorBtnRow}>
            <TouchableOpacity
              style={styles.errorBtn}
              onPress={() => {
                setPlayerError(false);
                setPlayerReady(false);
                webviewRef.current?.reload();
              }}
            >
              <Ionicons name="refresh" size={16} color="#000" />
              <Text style={styles.errorBtnText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.errorBtn, styles.errorBtnSecondary]}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={16} color={COLORS.neon} />
              <Text style={[styles.errorBtnText, { color: COLORS.neon }]}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── HUD LAYER (always on top of WebView) ── */}
      {!playerError && (
        <View style={styles.hudLayer} pointerEvents="box-none">
          <LinearGradient
            colors={['rgba(14,14,17,0.85)', 'transparent']}
            style={styles.topGradient}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(14,14,17,0.7)']}
            style={styles.bottomGradient}
            pointerEvents="none"
          />

          {/* Top HUD */}
          <View style={[
            styles.topHud,
            {
              paddingLeft: Math.max(24, insets.left),
              paddingRight: Math.max(24, insets.right),
              paddingTop: Math.max(20, insets.top)
            }
          ]}>
            <View style={styles.topHudLeft}>
              <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                <Ionicons name="arrow-back" size={22} color={COLORS.text} />
              </TouchableOpacity>
              <View>
                <Text style={styles.animeTitle}>{anime?.title?.toUpperCase()}</Text>
                <Text style={styles.episodeInfo}>
                  S1:E{episode.episode_number} • {episode.title}
                </Text>
              </View>
            </View>

            <View style={styles.topHudRight}>
              {/* Live progress indicator */}
              {playerState.duration > 0 && (
                <View style={styles.progressChip} pointerEvents="none">
                  <View
                    style={[
                      styles.progressChipFill,
                      { width: `${(playerState.current / playerState.duration) * 100}%` },
                    ]}
                  />
                  <Text style={styles.progressChipText}>
                    {formatTime(playerState.current)} / {formatTime(playerState.duration)}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setShowSelector(true)}
              >
                <Ionicons name="list" size={16} color={COLORS.text} />
                <Text style={styles.selectorBtnText}>EPISODES</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Resume Toast */}
          {resumeToast && (
            <View style={styles.resumeToast} pointerEvents="none">
              <BlurView intensity={40} style={styles.resumeToastBlur}>
                <Ionicons name="time" size={14} color={COLORS.neon} />
                <Text style={styles.resumeToastText}>
                  Resuming from {formatTime(resumeSeconds)}
                </Text>
              </BlurView>
            </View>
          )}

          {/* Up Next Card */}
          {showNextUp && nextEpisode && (
            <TouchableOpacity
              style={styles.nextUpCard}
              onPress={() => router.replace(`/watch/${nextEpisode.id}`)}
            >
              <BlurView intensity={30} style={styles.nextUpBlur}>
                <Image
                  source={{ uri: nextEpisode.thumbnail_url || anime?.poster_url }}
                  style={styles.nextUpThumb}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextUpLabel}>UP NEXT</Text>
                  <Text style={styles.nextUpTitle} numberOfLines={1}>
                    Episode {nextEpisode.episode_number}: {nextEpisode.title}
                  </Text>
                </View>
                <Ionicons name="play-skip-forward" size={18} color={COLORS.neonCyan} />
              </BlurView>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── EPISODE SELECTOR SHEET ── */}
      {showSelector && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity
            style={styles.modalBg}
            activeOpacity={1}
            onPress={() => setShowSelector(false)}
          />
          <BlurView
            intensity={80}
            style={[
              styles.selectorSheet,
              { paddingBottom: Math.max(32, insets.bottom + 16) }
            ]}
            tint="dark"
          >
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitle}>EPISODES</Text>
              <TouchableOpacity onPress={() => setShowSelector(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectorList}
            >
              {episodes?.map(ep => (
                <TouchableOpacity
                  key={ep.id}
                  style={[styles.selectorItem, ep.id === id && styles.activeItem]}
                  onPress={() => {
                    setShowSelector(false);
                    // Navigate — useEffect resets state when id changes
                    router.replace(`/watch/${ep.id}`);
                  }}
                >
                  <Image
                    source={{ uri: ep.thumbnail_url || anime?.poster_url }}
                    style={styles.selectorThumb}
                  />
                  <View style={styles.selectorInfo}>
                    <Text style={styles.selectorEpNum}>EP {ep.episode_number}</Text>
                    <Text style={styles.selectorEpTitle} numberOfLines={1}>{ep.title}</Text>
                  </View>
                  {ep.id === id && (
                    <View style={styles.nowPlayingBadge}>
                      <Text style={styles.nowPlayingText}>NOW PLAYING</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </BlurView>
        </View>
      )}
    </View>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatTime(seconds: number = 0) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#000' },
  fullCenter:  { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: COLORS.textSub, fontSize: 13, fontWeight: '600', marginTop: 8 },
  errorTitle:  { color: COLORS.text, fontSize: 20, fontWeight: '900', marginTop: 12 },

  errorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 28, paddingVertical: 12,
    backgroundColor: COLORS.neon, borderRadius: 24,
  },
  errorBtnSecondary: {
    backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.neon,
  },
  errorBtnRow: {
    flexDirection: 'row', gap: 12, marginTop: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  errorBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },

  // Loading overlay sits over WebView while player boots
  playerLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },

  // HUD layer — floats over WebView, box-none so touches pass through to WebView
  hudLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topGradient:    { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 },

  topHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  topHudLeft:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topHudRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  animeTitle:  { color: COLORS.neonCyan, fontSize: 9, fontWeight: '900', letterSpacing: 2 },
  episodeInfo: { color: COLORS.text, fontSize: 16, fontWeight: '900', marginTop: 2 },

  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },

  // Mini progress chip in top-right
  progressChip: {
    height: 28, minWidth: 110, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden', justifyContent: 'center', alignItems: 'center',
  },
  progressChipFill: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    backgroundColor: COLORS.neon, opacity: 0.25,
  },
  progressChipText: { fontSize: 10, fontWeight: '800', color: COLORS.text, zIndex: 1 },

  selectorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14, height: 40, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorBtnText: { color: COLORS.text, fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  resumeToast: { position: 'absolute', top: 100, alignSelf: 'center' },
  resumeToastBlur: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', overflow: 'hidden',
  },
  resumeToastText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },

  nextUpCard: {
    position: 'absolute', bottom: 28, right: 28,
    width: 290, borderRadius: 16, overflow: 'hidden',
  },
  nextUpBlur:  { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12 },
  nextUpThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: COLORS.bgElevated },
  nextUpLabel: { fontSize: 8, fontWeight: '900', color: COLORS.neonCyan, letterSpacing: 1 },
  nextUpTitle: { fontSize: 11, fontWeight: '700', color: COLORS.text, marginTop: 2 },

  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  selectorSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 32, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderWidth: 1, borderColor: 'rgba(189,157,255,0.2)',
  },
  selectorHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 24, alignItems: 'center',
  },
  selectorTitle:  { fontSize: 24, fontWeight: '900', color: COLORS.neon, letterSpacing: -1, fontStyle: 'italic' },
  selectorList:   { gap: 16, paddingBottom: 20 },
  selectorItem:   { width: 180, gap: 12 },
  activeItem:     { opacity: 1 },
  selectorThumb:  { width: '100%', height: 100, borderRadius: 12, backgroundColor: COLORS.bgElevated },
  selectorInfo:   { gap: 2 },
  selectorEpNum:  { fontSize: 8, fontWeight: '800', color: COLORS.textSub, letterSpacing: 1 },
  selectorEpTitle:{ fontSize: 12, fontWeight: '700', color: COLORS.text },
  nowPlayingBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: COLORS.neon, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  nowPlayingText: { fontSize: 7, fontWeight: '900', color: '#000' },
});
