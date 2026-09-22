import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  AppState,
  Alert,
  Animated,
  unstable_batchedUpdates,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { WebView } from "react-native-webview";
import type { WebView as WebViewType, WebViewMessageEvent } from "react-native-webview";
import * as ScreenOrientation from "expo-screen-orientation";
import * as NavigationBar from "expo-navigation-bar";
import { useKeepAwake } from "expo-keep-awake";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useEpisodeDetails,
  useAnimeDetails,
  useEpisodes,
  useWatchProgress,
  useSimilarAnime,
  fetchEpisodeById,
} from "../../src/hooks/useQueries";
import { usePremium } from "../../src/hooks/usePremium";
import { useAutoPlay } from "../../src/hooks/useAutoPlay";
import { useAutoSkipIntro } from "../../src/hooks/useAutoSkipIntro";
import { useServerSelection, ServerLang } from "../../src/hooks/useServerSelection";
import ServerPickerSheet from "../../src/components/ui/ServerPickerSheet";
import { useHlsDownloader } from "../../src/hooks/useHlsDownloader";
import { supabase, userAPI } from "../../src/lib/supabase";
import { useAuth } from "../../src/context/AuthContext";
import { COLORS } from "../../src/constants/theme";
import { buildCombinedJS } from "../../src/lib/injectedJS";
import { buildRawPlayerHTML } from "../../src/lib/htmlPlayer";
import { Episode } from "../../src/types/database";
import { styles } from "../../src/screens/watch.styles";

// Extracted Player Components
import EpisodeSelectorSheet from "../../src/components/player/EpisodeSelectorSheet";
import NextUpCard from "../../src/components/player/NextUpCard";
import StreamErrorOverlay from "../../src/components/player/StreamErrorOverlay";
import DeviceLimitOverlay from "../../src/components/player/DeviceLimitOverlay";
import WifiOnlyOverlay from "../../src/components/player/WifiOnlyOverlay";
import PlayerHUDOverlay from "../../src/components/player/PlayerHUDOverlay";
import DoubleTapSeek from "../../src/components/player/DoubleTapSeek";
import * as Network from "expo-network";
import {
  acquireStreamSession,
  sendStreamHeartbeat,
  releaseStreamSession,
  stopOtherStreams,
  getDeviceId,
} from "../../src/lib/streamManager";

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const NEAR_END_THRESHOLD_FALLBACK = 60;
const MIN_PROGRESS_SECONDS = 5;
const AUTO_PLAY_COUNTDOWN_SEC = 5;

const AD_DOMAINS = [
  "googlesyndication.com",
  "doubleclick.net",
  "adservice.google.com",
  "amazon-adsystem.com",
  "ads.yahoo.com",
  "popads.net",
  "popcash.net",
  "exoclick.com",
  "trafficjunky.net",
  "juicyads.com",
  "propellerads.com",
  "trafficstars.com",
  "hilltopads.net",
  "adsterra.com",
  "bidvertiser.com",
  "revcontent.com",
  "outbrain.com",
  "taboola.com",
  "mgid.com",
  "flipkart.com",
  "amazon.in",
  "ads.yahoo.com",
];

let _watchMountGeneration = 0;

export default function WatchScreen() {
  const { id, autoDownload } = useLocalSearchParams();
  const { user } = useAuth();
  const { isPremium } = usePremium();
  const { autoPlayEnabled, setAutoPlay } = useAutoPlay();
  const { autoSkipIntroEnabled, setAutoSkipIntro } = useAutoSkipIntro();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  // UI state
  const [showSelector, setShowSelector] = useState(false);
  const [showNextUp, setShowNextUp] = useState(false);
  const [resumeToast, setResumeToast] = useState(false);
  const [skipToast, setSkipToast] = useState(false);
  const [skipLabel, setSkipLabel] = useState("intro");
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [playerState, setPlayerStateState] = useState({
    isPlaying: false,
    current: 0,
    duration: 0,
  });
  const playerStateRef = useRef({ isPlaying: false, current: 0, duration: 0 });
  const setPlayerState = useCallback((val: typeof playerState | ((prev: typeof playerState) => typeof playerState)) => {
    setPlayerStateState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      playerStateRef.current = next;
      return next;
    });
  }, []);
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const [showServerPicker, setShowServerPicker] = useState(false);

  // Quality / subtitle picker state (for embedded players)
  const [qualityLevels, setQualityLevels] = useState<{ label: string; height?: number; originalIndex?: number; isLocked?: boolean }[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<{ id: number; label: string }[]>([]);
  const [activeQualityIndex, setActiveQualityIndex] = useState<number>(-1);
  const [activeSubtitleIndex, setActiveSubtitleIndex] = useState<number>(0);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const [showSubtitlePicker, setShowSubtitlePicker] = useState(false);
  const [showSettingsPicker, setShowSettingsPicker] = useState(false);

  // ── Download state ────────────────────────────────────────────────────────
  const [sniffedMediaUrl, setSniffedMediaUrl] = useState<string | null>(null);
  const [sniffedReferer, setSniffedReferer] = useState<string>("");
  const [sniffedManifestCache, setSniffedManifestCache] = useState<Record<string, string>>({});
  const [sniffedCookies, setSniffedCookies] = useState<string>("");
  const [sniffedSubtitles, setSniffedSubtitles] = useState<{ url: string; label: string; lang: string }[]>([]);

  // Live refs so handleDownloadPress always reads the latest sniffed data
  const sniffedSubtitlesRef = useRef<{ url: string; label: string; lang: string }[]>([]);
  const sniffedManifestCacheRef = useRef<Record<string, string>>({});
  const sniffedMediaUrlRef = useRef<string | null>(null);
  const sniffedRefererRef = useRef<string>("");
  const sniffedCookiesRef = useRef<string>("");

  // Initialize HLS downloader Hook
  const { status: downloadStatus, progress: downloadProgress, startDownload, cancelDownload, handleDownloadMessage } =
    useHlsDownloader();

  const webviewRef = useRef<WebViewType>(null);
  const nearEndFired = useRef(false);
  const lastSavedRef = useRef(0);
  const spinnerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null); // auto-play timer
  const skipToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerTickerRef = useRef<ReturnType<typeof setInterval> | null>(null); // 1s real-time ticker
  const seekTargetRef = useRef<number | null>(null);
  const lastSeekTimeRef = useRef<number>(0);

  // Dynamic redirect tracking refs
  const isPageLoadedRef = useRef(false);
  const currentHostRef = useRef("");

  // HUD visibility — driven by WebView click events (injected JS fires player_tap)
  const [showHud, setShowHud] = useState(false);
  const HUD_AUTO_HIDE_MS = 4000;

  // Smooth HUD fade animation (replaces jarring boolean snap)
  const hudOpacity = useRef(new Animated.Value(0)).current;

  const animateHudIn = useCallback(() => {
    Animated.timing(hudOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [hudOpacity]);

  const animateHudOut = useCallback(() => {
    Animated.timing(hudOpacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [hudOpacity]);

  const toggleHud = useCallback(() => {
    setShowHud((prev) => {
      if (prev) {
        if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
        animateHudOut();
        return false;
      }
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      animateHudIn();
      hudTimerRef.current = setTimeout(() => {
        unstable_batchedUpdates(() => {
          setShowHud(false);
          setShowQualityPicker(false);
          setShowSubtitlePicker(false);
          setShowSettingsPicker(false);
        });
        animateHudOut();
      }, HUD_AUTO_HIDE_MS);
      return true;
    });
  }, [animateHudIn, animateHudOut]);

  const resetHudTimer = useCallback(() => {
    setShowHud(true);
    animateHudIn();
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      unstable_batchedUpdates(() => {
        setShowHud(false);
        setShowQualityPicker(false);
        setShowSubtitlePicker(false);
        setShowSettingsPicker(false);
      });
      animateHudOut();
    }, HUD_AUTO_HIDE_MS);
  }, [animateHudIn, animateHudOut]);

  // ── Spinner timeout helper ──────────────────────────────────────────────────
  const startSpinnerTimeout = useCallback(() => {
    if (spinnerTimeoutRef.current) clearTimeout(spinnerTimeoutRef.current);
    spinnerTimeoutRef.current = setTimeout(() => setPlayerReady(true), 8000);
  }, []);

  // ── Embedded-player control helpers ─────────────────────────────────────────
  const playerCommand = useCallback((js: string) => {
    webviewRef.current?.injectJavaScript(`${js}; true;`);
  }, []);

  const embeddedPlay = useCallback(() => {
    playerCommand("window.__rn_play()");
    resetHudTimer();
  }, [playerCommand, resetHudTimer]);

  const embeddedPause = useCallback(() => {
    playerCommand("window.__rn_pause()");
    resetHudTimer();
  }, [playerCommand, resetHudTimer]);

  const embeddedSeekTo = useCallback((s: number) => {
    seekTargetRef.current = s;
    lastSeekTimeRef.current = Date.now();
    setPlayerState((prev) => ({ ...prev, current: s }));
    playerCommand(`window.__rn_seek(${s})`);
    resetHudTimer();
  }, [playerCommand, resetHudTimer]);

  const handleSeekRelative = useCallback((offset: number) => {
    // Read from ref so this callback never needs playerState in its deps
    const { current, duration } = playerStateRef.current;
    const base = seekTargetRef.current !== null ? seekTargetRef.current : current;
    let target = base + offset;
    if (duration > 0) {
      target = Math.max(0, Math.min(duration, target));
    } else {
      target = Math.max(0, target);
    }
    embeddedSeekTo(target);
  }, [embeddedSeekTo]);

  // Stable refs for IDs to avoid stale closures in handleProgress
  const episodeIdRef = useRef<string | undefined>(undefined);
  const userIdRef = useRef<string | undefined>(undefined);

  // ── Data Queries ───────────────────────────────────────────────────────────
  const { data: episode, isLoading: loadingEp } = useEpisodeDetails(id as string);
  const { data: anime, isLoading: loadingAnime } = useAnimeDetails(episode?.anime_id);
  const { data: episodes } = useEpisodes(episode?.anime_id);
  const { data: savedProgress, isLoading: loadingProgress } = useWatchProgress(id as string);

  const resumeSeconds = savedProgress?.progress_seconds ?? 0;

  // Stable resume position capture to prevent rebuilding injectedJS mid-playback
  const initialResumeSecondsRef = useRef(0);
  const hasCapturedInitialResumeRef = useRef(false);
  const hasShownResumeToastRef = useRef(false);
  const lastIdRef = useRef<string | undefined>(undefined);

  // Reset captured state immediately during the render phase when the episode changes
  if (lastIdRef.current !== id) {
    lastIdRef.current = id as string;
    hasCapturedInitialResumeRef.current = false;
    hasShownResumeToastRef.current = false;
    initialResumeSecondsRef.current = 0;
  }

  if (!hasCapturedInitialResumeRef.current && savedProgress !== undefined) {
    initialResumeSecondsRef.current = savedProgress?.progress_seconds ?? 0;
    hasCapturedInitialResumeRef.current = true;
  }

  // ── Server selection hook & User Preferences ───────────────────────────────
  const { data: prefs } = useQuery({
    queryKey: ['user', user?.id, 'preferences'],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await userAPI.getPreferences(user.id);
      return data;
    },
    enabled: !!user?.id,
  });

  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  // ── Wi-Fi Only Streaming Enforcement ────────────────────────────────────────
  const [isWifiBlocked, setIsWifiBlocked] = useState(false);
  const [bypassedWifiRestriction, setBypassedWifiRestriction] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkNetwork = async () => {
      if (!prefs?.wifi_only_streaming || bypassedWifiRestriction) {
        if (isMounted) setIsWifiBlocked(false);
        return;
      }
      try {
        const state = await Network.getNetworkStateAsync();
        const isWifiOrEthernet =
          state.type === Network.NetworkStateType.WIFI ||
          state.type === Network.NetworkStateType.ETHERNET;
        if (isMounted) {
          setIsWifiBlocked(!isWifiOrEthernet);
        }
      } catch (e) {
        console.warn("[Watch] Network check error:", e);
      }
    };
    checkNetwork();
  }, [prefs?.wifi_only_streaming, bypassedWifiRestriction]);

  const preferredLang: ServerLang = prefs?.audio_preference === 'English Dub' ? 'dub' : 'sub';

  const srv = useServerSelection(
    episode?.video_servers,
    episode?.video_url,
    isPremium,
    preferredLang
  );

  const embedOrigin = useMemo(() => {
    try {
      return new URL(srv.embedUrl).origin;
    } catch {
      return "";
    }
  }, [srv.embedUrl]);

  const isRawVideo = useMemo(() => {
    const url = srv.embedUrl.toLowerCase();
    return url.includes(".m3u8") || url.includes(".mp4") || url.includes(".webm") || url.includes(".ogg");
  }, [srv.embedUrl]);

  const useNativePlayerOnly = useMemo(() => {
    if (!srv.embedUrl) return false;
    const url = srv.embedUrl.toLowerCase();
    const serverName = (srv.filteredServers[srv.index]?.name || "").toLowerCase();

    const nativeOnlyKeywords = [
      "dood", "mp4upload", "streamwish", "filemoon", "streamtape",
      "mixdrop", "voe", "vidguard", "streamhide", "lulustream",
      "upstream", "doodstream", "embedwish", "fembed", "vidoza",
      "vidmoly", "flixcloud", "rabbitstream", "megacloud",
    ];

    return (
      nativeOnlyKeywords.some((k) => url.includes(k)) ||
      nativeOnlyKeywords.some((k) => serverName.includes(k))
    );
  }, [srv.embedUrl, srv.filteredServers, srv.index]);

  const webViewSource = useMemo(() => {
    if (isRawVideo) {
      const url = srv.embedUrl.toLowerCase();
      const isHls = url.includes(".m3u8");
      const htmlContent = buildRawPlayerHTML(
        srv.embedUrl,
        isHls,
        prefs?.quality_preference || "auto",
        prefs?.audio_preference || "",
        isPremium
      );
      return { html: htmlContent, baseUrl: srv.embedUrl };
    }

    return {
      uri: srv.embedUrl,
      headers: embedOrigin
        ? {
          Referer: embedOrigin + "/",
          Origin: embedOrigin,
        }
        : {},
    };
  }, [srv.embedUrl, isRawVideo, embedOrigin, prefs?.quality_preference, prefs?.audio_preference, isPremium]);

  useEffect(() => { episodeIdRef.current = episode?.id; }, [episode?.id]);
  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);

  const streamableEpisodes = useMemo(
    () => episodes?.filter((ep) => !!ep.video_url?.trim()) ?? [],
    [episodes]
  );

  const nextEpisode = useMemo(
    () => streamableEpisodes.find((e) => e.episode_number === (episode?.episode_number ?? 0) + 1),
    [streamableEpisodes, episode?.episode_number]
  );

  // ── Prefetch next 2 streamable episodes ──────────────────────────────────────
  useEffect(() => {
    if (!episode || streamableEpisodes.length === 0) return;
    const currentNum = episode.episode_number ?? 0;

    const upcoming = streamableEpisodes.filter((e) => e.episode_number > currentNum).slice(0, 2);

    upcoming.forEach((ep) => {
      queryClient.prefetchQuery({
        queryKey: ["episode", ep.id],
        staleTime: 10 * 60 * 1000,
        gcTime: 20 * 60 * 1000,
        queryFn: () => fetchEpisodeById(ep.id),
      });
    });
  }, [episode?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resume toast ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (resumeSeconds > 5 && !hasShownResumeToastRef.current) {
      hasShownResumeToastRef.current = true;
      setResumeToast(true);
      setPlayerState((prev) => {
        if (prev.current === 0) {
          return { ...prev, current: resumeSeconds };
        }
        return prev;
      });
      const t = setTimeout(() => setResumeToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [resumeSeconds]);

  // ── Progress sync to Supabase (throttled to 1 write per 5s) ─────────────────
  const handleProgress = useCallback(async (current: number, duration: number) => {
    const uid = userIdRef.current;
    const eid = episodeIdRef.current;
    if (!uid || !eid || current < MIN_PROGRESS_SECONDS) return;

    const now = Date.now();
    if (now - lastSavedRef.current < 5_000) return; // Throttled to 5 seconds
    lastSavedRef.current = now;

    const isCompleted = duration > 0 && current > duration * 0.9;
    const { error } = await userAPI.upsertProgress(uid, eid, current, isCompleted);

    if (error) {
      console.error("[Watch] Progress save failed:", JSON.stringify(error));
    } else {
      // Directly write the known value to cache — no round-trip refetch needed.
      // History invalidation runs once on unmount (see below).
      queryClient.setQueryData(
        ["user", uid, "progress", eid],
        { progress_seconds: current, is_completed: isCompleted },
      );
    }
  }, [queryClient]);

  // ── Flush user data caches on unmount (runs once) ─────────────────────────
  // History + anime-progress are intentionally NOT invalidated during playback
  // to avoid a DB round-trip every 5 seconds. We invalidate once on exit so
  // the home screen and library show updated progress immediately.
  useEffect(() => {
    return () => {
      const uid = userIdRef.current;
      if (uid) {
        queryClient.invalidateQueries({ queryKey: ['user', uid, 'history'] });
        queryClient.invalidateQueries({ queryKey: ['user', uid, 'anime-progress'] });
      }
    };
  }, [queryClient]);

  // ── Episode complete — start auto-play countdown ─────────────────────────────
  const handleEpisodeComplete = useCallback(() => {
    if (!nextEpisode) return;
    setShowNextUp(true);
    if (!autoPlayEnabled) return;

    const nextEpisodeId = nextEpisode.id;

    setAutoPlayCountdown(AUTO_PLAY_COUNTDOWN_SEC);
    let remaining = AUTO_PLAY_COUNTDOWN_SEC;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setAutoPlayCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        router.replace(`/watch/${nextEpisodeId}`);
      }
    }, 1000);
  }, [nextEpisode, autoPlayEnabled]);

  const cancelAutoPlay = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setAutoPlayCountdown(null);
  }, []);

  // ── Concurrent Device Stream Limit ──────────────────────────────────────────
  const [streamBlocked, setStreamBlocked] = useState(false);
  const [streamBlockInfo, setStreamBlockInfo] = useState<{
    maxAllowed: number;
    activeCount: number;
  } | null>(null);
  const [isStoppingStreams, setIsStoppingStreams] = useState(false);
  const isRemotelyBlockedRef = useRef(false);

  const checkStreamAllowed = useCallback(async () => {
    if (!user?.id) return;
    if (isRemotelyBlockedRef.current) return;

    const res = await acquireStreamSession(user.id, user.subscription_type ?? 'free', id as string);
    if (!res.allowed) {
      setStreamBlocked(true);
      setStreamBlockInfo({ maxAllowed: res.maxAllowed, activeCount: res.activeCount });
      embeddedPause();
      setPlayerState((prev) => ({ ...prev, isPlaying: false }));
    } else {
      setStreamBlocked(false);
      setStreamBlockInfo(null);
    }
  }, [user?.id, user?.subscription_type, id, embeddedPause]);

  useEffect(() => {
    checkStreamAllowed();
  }, [checkStreamAllowed]);

  // ── Real-time Concurrent Stream Control Listener ────────────────────────────
  // Instantly listens for STOP_OTHER_STREAMS broadcast from any other device or remote stream deletion.
  // Immediately pauses playback (<100ms) and presents the DeviceLimitOverlay.
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    const topic = `stream-control:${user.id}`;
    const channel = supabase.channel(topic, {
      config: { broadcast: { ack: true } },
    });

    channel
      .on('broadcast', { event: 'STOP_OTHER_STREAMS' }, async ({ payload }) => {
        if (!isMounted) return;
        const myDeviceId = await getDeviceId();
        const sourceDeviceId = payload?.sourceDeviceId ?? payload?.payload?.sourceDeviceId;
        if (sourceDeviceId && sourceDeviceId !== myDeviceId) {
          console.log('[Watch] Remote STOP_OTHER_STREAMS received from device:', sourceDeviceId);
          isRemotelyBlockedRef.current = true;
          embeddedPause();
          setPlayerState((prev) => ({ ...prev, isPlaying: false }));
          setStreamBlocked(true);
          setStreamBlockInfo({
            maxAllowed: isPremium ? 2 : 1,
            activeCount: isPremium ? 2 : 1,
          });
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'user_active_streams',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          if (!isMounted) return;
          const myDeviceId = await getDeviceId();
          if (payload.old && (payload.old as any).device_id === myDeviceId) {
            console.log('[Watch] Active stream record deleted remotely. Halting stream.');
            isRemotelyBlockedRef.current = true;
            embeddedPause();
            setPlayerState((prev) => ({ ...prev, isPlaying: false }));
            setStreamBlocked(true);
            setStreamBlockInfo({
              maxAllowed: isPremium ? 2 : 1,
              activeCount: isPremium ? 2 : 1,
            });
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id, isPremium, embeddedPause]);

  // Periodic heartbeat while playing (checks concurrency and refreshes active stream)
  useEffect(() => {
    if (!user?.id || !playerState.isPlaying || streamBlocked || isRemotelyBlockedRef.current) return;
    const interval = setInterval(async () => {
      if (isRemotelyBlockedRef.current) return;
      const res = await sendStreamHeartbeat(user.id, user.subscription_type ?? 'free', id as string);
      if (!res.allowed) {
        setStreamBlocked(true);
        setStreamBlockInfo({ maxAllowed: res.maxAllowed, activeCount: res.activeCount });
        embeddedPause();
        setPlayerState((prev) => ({ ...prev, isPlaying: false }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user?.id, user?.subscription_type, playerState.isPlaying, id, streamBlocked, embeddedPause]);

  // Cleanly release active stream when user minimizes app, answers call, or locks screen
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const uid = userIdRef.current;
      if (!uid) return;
      if (nextState === 'background' || nextState === 'inactive') {
        releaseStreamSession(uid);
      } else if (nextState === 'active') {
        if (!isRemotelyBlockedRef.current) {
          checkStreamAllowed();
        }
      }
    });
    return () => sub.remove();
  }, [checkStreamAllowed]);

  const handleStopOtherStreams = async () => {
    if (!user?.id) return;
    setIsStoppingStreams(true);
    isRemotelyBlockedRef.current = false;
    try {
      await stopOtherStreams(user.id);
      const res = await acquireStreamSession(user.id, user.subscription_type ?? 'free', id as string);
      if (res.allowed) {
        setStreamBlocked(false);
        setStreamBlockInfo(null);
        embeddedPlay();
      } else {
        setStreamBlocked(true);
        setStreamBlockInfo({ maxAllowed: res.maxAllowed, activeCount: res.activeCount });
      }
    } finally {
      setIsStoppingStreams(false);
    }
  };

  // Cleanup timers on unmount and save final progress instantly
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (skipToastTimeoutRef.current) clearTimeout(skipToastTimeoutRef.current);
      if (playerTickerRef.current) clearInterval(playerTickerRef.current);

      // Release active stream session on unmount
      const uid = userIdRef.current;
      if (uid) {
        releaseStreamSession(uid);
      }

      // Save final progress on unmount instantly
      const eid = episodeIdRef.current;
      const { current, duration } = playerStateRef.current;
      if (uid && eid && current > MIN_PROGRESS_SECONDS) {
        console.log(`[Watch] [Unmount] Saving final progress: ${current}s / ${duration}s`);
        (async () => {
          try {
            await userAPI.upsertProgress(uid, eid, current, duration > 0 && current > duration * 0.9);
            queryClient.invalidateQueries({ queryKey: ["user", uid] });
          } catch (err) {
            console.error("[Watch] [Unmount] Final progress save error:", err);
          }
        })();
      }
    };
  }, [queryClient]);

  // ── Real-time progress ticker ─────────────────────────────────────────────
  useEffect(() => {
    playerTickerRef.current = setInterval(() => {
      setPlayerState((prev) => {
        if (!prev.isPlaying) return prev;
        const next = prev.current + 1;
        if (prev.duration > 0 && next >= prev.duration) return prev;
        return { ...prev, current: next };
      });
    }, 1000);
    return () => {
      if (playerTickerRef.current) {
        clearInterval(playerTickerRef.current);
        playerTickerRef.current = null;
      }
    };
  }, []);

  // ── WebView message handler ───────────────────────────────────────────────
  const handleWebViewMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);

        if (msg.type === "player_tap") {
          toggleHud();
        } else if (msg.type === "player_controls_shown") {
          setShowHud(true);
          if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
          hudTimerRef.current = setTimeout(() => setShowHud(false), 4000);
        } else if (msg.type === "player_controls_hidden") {
          setShowHud(false);
          if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
        }

        // ── Sniffer events ──
        if (msg.type === "MEDIA_URL_DETECTED") {
          const { mediaUrl, referer } = msg;
          if (mediaUrl && mediaUrl.toLowerCase().includes(".m3u8")) {
            if (!sniffedMediaUrlRef.current || sniffedMediaUrlRef.current === episode?.video_url) {
              console.log("[Download] Sniffed .m3u8:", mediaUrl);
              sniffedMediaUrlRef.current = mediaUrl;
              sniffedRefererRef.current = referer || "";
              setSniffedMediaUrl(mediaUrl);
              setSniffedReferer(referer || "");
            }
          }
        }

        if (msg.type === "SUBTITLE_URL_DETECTED") {
          const { subtitleUrl } = msg;
          if (subtitleUrl) {
            setSniffedSubtitles((prev) => {
              if (prev.some((s) => s.url === subtitleUrl)) return prev;
              console.log("[Download] Sniffed subtitle URL:", subtitleUrl);
              const lcUrl = subtitleUrl.toLowerCase();
              const label =
                lcUrl.includes("eng") || lcUrl.includes("english") || lcUrl.includes("/en/") || lcUrl.includes("_en.")
                  ? "English"
                  : lcUrl.match(/[_\-\/]([a-z]{2,3})[_\-\.]/)?.[1]?.toUpperCase() ?? "Subtitle";
              const next = [...prev, { url: subtitleUrl, label, lang: label.toLowerCase() }];
              sniffedSubtitlesRef.current = next;
              return next;
            });
          }
        }

        if (msg.type === "SUBTITLES_DETECTED") {
          const { tracks } = msg;
          if (Array.isArray(tracks)) {
            const vttTracks = tracks
              .filter((t: any) => {
                const fileUrl = t.file || t.src;
                if (!fileUrl) return false;
                const kind = (t.kind || "").toLowerCase();
                const lcUrl = fileUrl.toLowerCase();
                return kind === "captions" || kind === "subtitles" || lcUrl.includes(".vtt") || lcUrl.includes(".srt");
              })
              .map((t: any) => ({
                url: t.file || t.src,
                label: t.label || t.language || "Subtitle",
                lang: t.language || t.lang || "und",
              }));
            if (vttTracks.length > 0) {
              const existingUrls = sniffedSubtitlesRef.current.map((s) => s.url).join(",");
              const newUrls = vttTracks.map((s: any) => s.url).join(",");
              if (existingUrls !== newUrls) {
                console.log("[Download] Sniffed subtitles:", vttTracks.length, "tracks");
                sniffedSubtitlesRef.current = vttTracks;
                setSniffedSubtitles(vttTracks);
              }
            }
          }
        }

        if (msg.type === "MEDIA_MANIFEST_READY") {
          const { mediaUrl, referer, manifestContent, cookies } = msg;
          if (mediaUrl && manifestContent) {
            console.log("[Download] Captured manifest for:", mediaUrl);
            sniffedManifestCacheRef.current = { ...sniffedManifestCacheRef.current, [mediaUrl]: manifestContent };
            setSniffedManifestCache((prev) => ({ ...prev, [mediaUrl]: manifestContent }));
            if (cookies) {
              sniffedCookiesRef.current = cookies;
              setSniffedCookies(cookies);
            }
            if (!sniffedMediaUrlRef.current || sniffedMediaUrlRef.current === episode?.video_url) {
              sniffedMediaUrlRef.current = mediaUrl;
              sniffedRefererRef.current = referer || "";
              setSniffedMediaUrl(mediaUrl);
              setSniffedReferer(referer || "");
            }
          }
        }

        if (
          msg.type === "DOWNLOAD_SEGMENT_CHUNK" ||
          msg.type === "DOWNLOAD_SEGMENT_ERROR" ||
          msg.type === "FETCH_TEXT_SUCCESS" ||
          msg.type === "FETCH_TEXT_ERROR"
        ) {
          handleDownloadMessage(msg);
        }

        if (msg.type === "player_error") {
          const { code } = msg;
          console.warn("[Watch] JWPlayer error", code, msg.message);
          if (!code || code >= 100000) {
            setPlayerError(true);
          }
        }

        if (msg.type === "player_ready") {
          setPlayerReady(true);
          setPlayerError(false);
        }

        if (msg.type === "player_not_found") {
          setPlayerReady(true);
        }

        if (msg.type === "episode_complete") {
          handleEpisodeComplete();
        }

        if (msg.type === "skip_intro") {
          const label = msg.label || "credits";
          setSkipLabel(label);
          setSkipToast(true);
          if (skipToastTimeoutRef.current) clearTimeout(skipToastTimeoutRef.current);
          skipToastTimeoutRef.current = setTimeout(() => setSkipToast(false), 3500);
        }

        if (msg.type === "playstate") {
          const { playing } = msg;
          setPlayerState((prev) => ({ ...prev, isPlaying: playing }));
        }

        if (msg.type === "progress") {
          const { current, duration, playing } = msg;

          const isUserSeeking = Date.now() - lastSeekTimeRef.current < 1000;
          if (!isUserSeeking) {
            seekTargetRef.current = null;
            setPlayerState({ isPlaying: playing, current, duration });
            handleProgress(current, duration);
          } else {
            setPlayerState((prev) => ({ ...prev, isPlaying: playing, duration }));
          }

          if (duration > 0) {
            const threshold = Math.min(NEAR_END_THRESHOLD_FALLBACK, duration * 0.1);
            if (!nearEndFired.current && duration - current < threshold && nextEpisode) {
              nearEndFired.current = true;
              setShowNextUp(true);
            } else if (nearEndFired.current && duration - current >= threshold) {
              // User scrubbed back out of the near-end zone — hide the card and reset
              nearEndFired.current = false;
              setShowNextUp(false);
            }
          }
        }

        if (msg.type === "quality_locked") {
          Alert.alert(
            "Premium Feature",
            "1080p Full HD streaming is exclusively available for AnimeHub Premium members. Free tier supports up to 720p HD. Upgrade now to unlock 1080p!",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "View Plans",
                style: "default",
                onPress: () => router.push("/subscription-plans"),
              },
            ]
          );
        }

        if (msg.type === "qualities") {
          if (Array.isArray(msg.levels) && msg.levels.length > 0) {
            const mappedLevels: { label: string; height: number; originalIndex: number; isLocked: boolean }[] = [];
            msg.levels.forEach((l: any, i: number) => {
              const h = l.height || parseInt(l.label) || 0;
              // 1080p is highest we can go (exclude 1440p / 4k)
              if (h > 1080) return;
              const isLocked = !isPremium && (h > 720 || (parseInt(l.label) > 720) || (l.label && l.label.includes("1080")));
              mappedLevels.push({
                label: l.label || (h ? `${h}p` : `Level ${i}`),
                height: h,
                originalIndex: i,
                isLocked,
              });
            });

            const finalLevels = mappedLevels.length > 0 ? mappedLevels : msg.levels.map((l: any, i: number) => ({
              label: l.label || `Level ${i}`,
              height: l.height || parseInt(l.label) || 0,
              originalIndex: i,
              isLocked: !isPremium && ((l.height || parseInt(l.label) || 0) > 720),
            }));

            setQualityLevels(finalLevels);

            // Auto-apply stored quality preference or clamp to tier limit:
            // Free tier: locked up to 720p. Premium tier: up to 1080p.
            const maxAllowedH = isPremium ? 1080 : 720;
            const userQuality = prefsRef.current?.quality_preference;
            let targetH = userQuality && userQuality !== "auto" ? parseInt(userQuality) : maxAllowedH;
            if (isNaN(targetH) || targetH > maxAllowedH) {
              targetH = maxAllowedH;
            }

            let bestLevelIdx = -1;
            let bestDiff = 999999;
            for (let i = 0; i < finalLevels.length; i++) {
              const lvl = finalLevels[i];
              if (lvl.height <= maxAllowedH) {
                if (lvl.height === targetH) {
                  bestLevelIdx = i;
                  break;
                }
                if (lvl.height > 0) {
                  const diff = Math.abs(lvl.height - targetH);
                  if (diff < bestDiff) {
                    bestDiff = diff;
                    bestLevelIdx = i;
                  }
                }
              }
            }

            if (bestLevelIdx !== -1) {
              const targetLevel = finalLevels[bestLevelIdx];
              setActiveQualityIndex(bestLevelIdx);
              playerCommand(`window.__rn_setQuality(${targetLevel.originalIndex})`);
            } else if (typeof msg.current === "number") {
              const foundIdx = finalLevels.findIndex((lvl: { originalIndex?: number }) => lvl.originalIndex === msg.current);
              setActiveQualityIndex(foundIdx !== -1 ? foundIdx : msg.current);
            }
          }
        }

        if (msg.type === "qualityChanged") {
          if (typeof msg.current === "number") {
            const foundIdx = qualityLevels.findIndex((lvl: { originalIndex?: number }) => lvl.originalIndex === msg.current);
            setActiveQualityIndex(foundIdx !== -1 ? foundIdx : msg.current);
          }
        }

        if (msg.type === "audioTracks") {
          if (Array.isArray(msg.tracks) && msg.tracks.length > 1) {
            const rawAudio = (prefsRef.current?.audio_preference || "").toLowerCase();
            if (rawAudio) {
              let targetIdx = -1;
              for (let a = 0; a < msg.tracks.length; a++) {
                const t = msg.tracks[a];
                const tName = (t.name || "").toLowerCase();
                const tLang = (t.lang || t.language || "").toLowerCase();
                if (rawAudio.includes("dub") || rawAudio.includes("english")) {
                  if (tLang.startsWith("en") || tName.includes("dub") || tName.includes("eng")) {
                    targetIdx = a;
                    break;
                  }
                } else if (rawAudio.includes("japanese") || rawAudio.includes("original")) {
                  if (tLang.startsWith("ja") || tName.includes("jap") || tName.includes("orig")) {
                    targetIdx = a;
                    break;
                  }
                }
              }
              if (targetIdx !== -1) {
                playerCommand(`window.__rn_setAudioTrack(${targetIdx})`);
              }
            }
          }
        }

        if (msg.type === "subtitles") {
          if (Array.isArray(msg.tracks) && msg.tracks.length > 1) {
            setSubtitleTracks(
              msg.tracks.map((t: any) => ({
                id: typeof t.id === "number" ? t.id : 0,
                label: t.label || "Track",
              }))
            );
            if (typeof msg.current === "number") setActiveSubtitleIndex(msg.current);
          }
        }

        if (msg.type === "captionChanged") {
          if (typeof msg.current === "number") setActiveSubtitleIndex(msg.current);
        }
      } catch (_) { }
    },
    [handleProgress, handleEpisodeComplete, nextEpisode, toggleHud, handleDownloadMessage, isPremium]
  );

  // ── Trigger download onPress ────────────────────────────────────────────────
  const handleDownloadPress = useCallback(() => {
    const mediaUrl = sniffedMediaUrlRef.current;
    const referer = sniffedRefererRef.current;
    const cookies = sniffedCookiesRef.current;
    const cache = sniffedManifestCacheRef.current;
    const subtitles = sniffedSubtitlesRef.current;
    if (!mediaUrl || !episode) return;
    console.log("[Download] Starting — subtitles available:", subtitles.length);
    startDownload(
      mediaUrl,
      referer || embedOrigin,
      {
        episodeId: episode.id,
        title: `Ep ${episode.episode_number}: ${episode.title ?? ""}`,
        animeName: anime?.title ?? "Unknown",
        thumbnailUrl: episode.thumbnail_url ?? anime?.poster_url ?? "",
      },
      undefined,
      cookies,
      cache,
      (js: string) => {
        webviewRef.current?.injectJavaScript(js);
      },
      subtitles
    );
  }, [embedOrigin, episode, anime, startDownload]);

  // Auto-start download if autoDownload=true
  useEffect(() => {
    if (autoDownload === "true" && sniffedMediaUrl && episode && playerReady && downloadStatus === "idle") {
      handleDownloadPress();
    }
  }, [autoDownload, sniffedMediaUrl, episode, playerReady, downloadStatus, handleDownloadPress]);

  // ── Screen orientation lock ─────────────────────────────────────────────────
  useEffect(() => {
    _watchMountGeneration++;
    const myGeneration = _watchMountGeneration;

    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    NavigationBar.setVisibilityAsync("hidden");
    NavigationBar.setBehaviorAsync("overlay-swipe");

    return () => {
      setTimeout(() => {
        if (_watchMountGeneration === myGeneration) {
          ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
          NavigationBar.setVisibilityAsync("visible");
        }
      }, 50);
    };
  }, []);

  useKeepAwake();

  // ── Reset state when episode changes ──────────────────────────────────────────
  useEffect(() => {
    nearEndFired.current = false;
    lastSavedRef.current = 0;
    hasShownResumeToastRef.current = false;
    setShowNextUp(false);
    setPlayerReady(false);
    setPlayerError(false);
    setPlayerState({
      isPlaying: false,
      current: resumeSeconds,
      duration: 0,
    });
    setSniffedMediaUrl(null);
    setSniffedReferer("");
    setSniffedManifestCache({});
    setSniffedCookies("");
    setSniffedSubtitles([]);
    sniffedMediaUrlRef.current = null;
    sniffedRefererRef.current = "";
    sniffedManifestCacheRef.current = {};
    sniffedCookiesRef.current = "";
    sniffedSubtitlesRef.current = [];
    cancelDownload();
    srv.reset();
    cancelAutoPlay();
    isPageLoadedRef.current = false;
    currentHostRef.current = "";

    setShowHud(false);
    startSpinnerTimeout();

    return () => {
      if (spinnerTimeoutRef.current) clearTimeout(spinnerTimeoutRef.current);
    };
  }, [id, cancelAutoPlay, startSpinnerTimeout]);

  // Pre-populate sniffedMediaUrl with the direct video_url if available
  useEffect(() => {
    if (episode?.video_url && episode.video_url.toLowerCase().includes(".m3u8")) {
      setSniffedMediaUrl((prev) => prev || episode.video_url || null);
    }
  }, [episode]);

  // Reset sniffed states when server changes
  useEffect(() => {
    setPlayerReady(false);
    setPlayerError(false);
    setSniffedMediaUrl(null);
    setSniffedReferer("");
    setSniffedManifestCache({});
    setSniffedCookies("");
    setSniffedSubtitles([]);
    cancelDownload();
    isPageLoadedRef.current = false;
    currentHostRef.current = "";
    setQualityLevels([]);
    setSubtitleTracks([]);
    setActiveQualityIndex(-1);
    setActiveSubtitleIndex(0);
    setShowQualityPicker(false);
    setShowSubtitlePicker(false);
    setShowSettingsPicker(false);
    setPlayerState({ isPlaying: false, current: 0, duration: 0 });
    seekTargetRef.current = null;

    startSpinnerTimeout();
  }, [srv.embedUrl, startSpinnerTimeout]);

  // Re-build injected JS whenever the episode changes OR saved progress is loaded.
  // Previously this only depended on autoSkipIntroEnabled / useNativePlayerOnly,
  // so navigating from "Continue Watching" always injected resumeSeconds=0 because
  // initialResumeSecondsRef.current had updated but the memo never recomputed.
  const injectedJS = useMemo(
    () =>
      buildCombinedJS(
        initialResumeSecondsRef.current,
        autoSkipIntroEnabled,
        useNativePlayerOnly,
        5000,
        prefs?.quality_preference || "auto",
        prefs?.audio_preference || "",
        isPremium
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, resumeSeconds, autoSkipIntroEnabled, useNativePlayerOnly, prefs?.quality_preference, prefs?.audio_preference, isPremium]
  );

  // ── Centralized Plans Navigation ──────────────────────────────────────────
  // Dismisses landscape fullScreenModal player cleanly and opens /plans in portrait mode
  const navigateToPlans = useCallback(async () => {
    try {
      embeddedPause();
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      await NavigationBar.setVisibilityAsync("visible").catch(() => {});
    } catch {}

    if (router.canGoBack()) {
      router.back();
    }
    setTimeout(() => {
      router.push("/plans");
    }, 120);
  }, [embeddedPause, router]);

  // ── Stable JSX callbacks (hoisted to avoid memo bypass) ──────────────────
  const handleBack = useCallback(() => router.back(), []);
  const handleOpenServerPicker = useCallback(() => setShowServerPicker(true), []);
  const handleOpenEpisodeSelector = useCallback(() => setShowSelector(true), []);
  const handleTogglePlayPause = useCallback(() => {
    if (playerStateRef.current.isPlaying) embeddedPause();
    else embeddedPlay();
  }, [embeddedPause, embeddedPlay]);
  const handleStreamAnyway = useCallback(() => {
    setBypassedWifiRestriction(true);
    setIsWifiBlocked(false);
  }, []);
  const handleOpenSettings = useCallback(() => router.push("/settings"), []);
  const handleDismissNextUp = useCallback(() => {
    cancelAutoPlay();
    setShowNextUp(false);
  }, [cancelAutoPlay]);
  const handlePlayNow = useCallback(() => {
    cancelAutoPlay();
    if (nextEpisode?.id) router.replace(`/watch/${nextEpisode.id}`);
  }, [cancelAutoPlay, nextEpisode?.id]);
  const handleCloseSelectorSheet = useCallback(() => setShowSelector(false), []);
  const handleSelectEpisode = useCallback((epId: string) => {
    setShowSelector(false);
    router.replace(`/watch/${epId}`);
  }, []);
  const handleCloseServerPicker = useCallback(() => setShowServerPicker(false), []);
  const handleSelectLang = useCallback((lang: any) => {
    srv.selectLang(lang);
    setPlayerError(false);
    setPlayerReady(false);
  }, [srv.selectLang]);
  const handleSelectServer = useCallback((i: number) => {
    srv.selectServer(i);
    setPlayerError(false);
    setPlayerReady(false);
  }, [srv.selectServer]);
  const handleSwitchServer = useCallback(() => {
    srv.isServerLocked ? navigateToPlans() : setShowServerPicker(true);
  }, [srv.isServerLocked, navigateToPlans]);
  const handleRetryStream = useCallback(() => {
    setPlayerError(false);
    setPlayerReady(false);
    startSpinnerTimeout();
    webviewRef.current?.reload();
  }, [startSpinnerTimeout]);
  const handleSelectQuality = useCallback((index: number) => {
    const selectedLevel = qualityLevels[index];
    if (selectedLevel?.isLocked || (!isPremium && selectedLevel && (selectedLevel.height || 0) > 720)) {
      Alert.alert(
        "Premium Feature",
        "1080p Full HD streaming is exclusively available for AnimeHub Premium members. Free tier supports up to 720p HD. Upgrade now to unlock 1080p!",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "View Plans",
            style: "default",
            onPress: () => {
              setShowQualityPicker(false);
              router.push("/subscription-plans");
            },
          },
        ]
      );
      return;
    }
    const origIdx = selectedLevel?.originalIndex ?? index;
    playerCommand(`window.__rn_setQuality(${origIdx})`);
    setActiveQualityIndex(index);
    setShowQualityPicker(false);
  }, [qualityLevels, isPremium, playerCommand]);
  const handleSelectSubtitle = useCallback((index: number) => {
    playerCommand(`window.__rn_setSubtitle(${index})`);
    setActiveSubtitleIndex(index);
    setShowSubtitlePicker(false);
  }, [playerCommand]);

  // ── Guards ────────────────────────────────────────────────────────────────
  if (loadingEp || loadingAnime || (loadingProgress && !!user)) {
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

  // Premium Episode block
  if (episode.is_premium && !isPremium) {
    return (
      <View style={styles.fullCenter}>
        <Ionicons name="star" size={56} color={COLORS.neonGold} />
        <Text style={[styles.errorTitle, { color: COLORS.neonGold }]}>Premium Episode</Text>
        <Text style={styles.errorSubtitle}>Upgrade to Premium to unlock{"\n"}this episode and many more.</Text>
        <TouchableOpacity
          style={[styles.errorBtn, { backgroundColor: COLORS.neonGold }]}
          onPress={navigateToPlans}
        >
          <Ionicons name="star" size={16} color="#000" />
          <Text style={[styles.errorBtnText, { color: "#000" }]}>UPGRADE TO PREMIUM</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.errorBtn, styles.errorBtnSecondary, { marginTop: 8 }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.errorBtnText, { color: COLORS.neon }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Offline or invalid URL stream guard
  if (!srv.embedUrl) {
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

  return (
    <View style={styles.container}>
      <StatusBar hidden translucent backgroundColor="transparent" />

      {/* ── WEBVIEW PLAYER ── */}
      <WebView
        ref={webviewRef}
        source={isWifiBlocked ? { html: '<!DOCTYPE html><html><body style="background:#000;"></body></html>' } : webViewSource}
        style={StyleSheet.absoluteFill}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        allowsInlineMediaPlayback={true}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustsScrollIndicatorInsets={false}
        overScrollMode="never"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        injectedJavaScript={injectedJS}
        injectedJavaScriptForMainFrameOnly={false}
        onMessage={handleWebViewMessage}
        onNavigationStateChange={(navState) => {
          try {
            const host = new URL(navState.url).hostname.toLowerCase();
            if (host && host !== "about:blank") {
              currentHostRef.current = host;
            }
          } catch (e) { }
        }}
        onLoadEnd={() => {
          if (spinnerTimeoutRef.current) clearTimeout(spinnerTimeoutRef.current);
          setPlayerReady(true);
          isPageLoadedRef.current = true;
        }}
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        onError={() => setPlayerError(true)}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 400) setPlayerError(true);
        }}
        onShouldStartLoadWithRequest={(req) => {
          const url = req.url;
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            console.log("[WebView] BLOCKED scheme →", url);
            return false;
          }

          try {
            const reqUrlObj = new URL(url);
            const reqHost = reqUrlObj.hostname.toLowerCase();

            if (url === "about:blank" || url.startsWith("data:") || url.startsWith("file:")) {
              return true;
            }

            let embedHost = "";
            try {
              if (srv.embedUrl) {
                embedHost = new URL(srv.embedUrl).hostname.toLowerCase();
              }
            } catch (e) { }

            if (
              embedHost &&
              (reqHost === embedHost || reqHost.endsWith("." + embedHost) || embedHost.endsWith("." + reqHost))
            ) {
              return true;
            }

            const isTopFrame = req.isTopFrame !== false;
            if (isPageLoadedRef.current && isTopFrame) {
              const currentHost = currentHostRef.current;
              if (currentHost) {
                const isSameHost =
                  reqHost === currentHost ||
                  reqHost.endsWith("." + currentHost) ||
                  currentHost.endsWith("." + reqHost);
                if (!isSameHost) {
                  console.log("[WebView] BLOCKED external redirect (post-load top frame) →", url);
                  return false;
                }
              }
            }

            if (AD_DOMAINS.some((d) => reqHost === d || reqHost.endsWith("." + d))) {
              console.log("[WebView] BLOCKED ad →", reqHost);
              return false;
            }
          } catch (e) {
            console.warn("[WebView] Redirect guard parse error, allowing:", url, e);
            return true;
          }

          return true;
        }}
      />

      {/* ── NETFLIX-STYLE DOUBLE-TAP SEEK ── */}
      {/* Sits above the WebView but below HUD overlays. Left zone = -10s, right = +10s.
          Single-tap is forwarded to toggleHud so the HUD toggle still works. */}
      {!playerError && playerReady && (
        <DoubleTapSeek
          onSeekRelative={handleSeekRelative}
          onSingleTap={toggleHud}
        />
      )}

      {/* ── LOADING INDICATOR ── */}
      {!playerReady && !playerError && (
        <View style={styles.playerLoadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={COLORS.neonCyan} />
          <Text style={styles.loadingText}>Loading stream…</Text>
        </View>
      )}

      {/* ── STREAM ERROR OVERLAY ── */}
      <StreamErrorOverlay
        visible={playerError}
        serversCount={srv.servers.length}
        isServerLocked={srv.isServerLocked}
        serverLabel={srv.label}
        onSwitchServer={handleSwitchServer}
        onRetry={handleRetryStream}
        onGoBack={handleBack}
      />

      {/* ── WIFI ONLY STREAMING OVERLAY ── */}
      <WifiOnlyOverlay
        visible={isWifiBlocked}
        onStreamAnyway={handleStreamAnyway}
        onOpenSettings={handleOpenSettings}
        onGoBack={handleBack}
      />

      {/* ── DEVICE LIMIT OVERLAY ── */}
      <DeviceLimitOverlay
        visible={streamBlocked}
        isPremium={isPremium}
        maxAllowed={streamBlockInfo?.maxAllowed ?? (isPremium ? 2 : 1)}
        onStopOtherStreams={handleStopOtherStreams}
        onUpgrade={navigateToPlans}
        onGoBack={handleBack}
        isStopping={isStoppingStreams}
      />

      {/* ── HUD OVERLAY LAYER ── */}
      {!playerError && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: hudOpacity }]}
          pointerEvents={showHud ? 'box-none' : 'none'}
          needsOffscreenAlphaCompositing
        >
          <PlayerHUDOverlay
          showHud={showHud}
          isRawVideo={isRawVideo}
          useNativePlayerOnly={useNativePlayerOnly}
          playerReady={playerReady}
          playerState={playerState}
          anime={anime}
          episode={episode}
          downloader={{ status: downloadStatus, progress: downloadProgress }}
          sniffedMediaUrl={sniffedMediaUrl}
          isPremium={isPremium}
          serverLabel={srv.label}
          isServerLocked={srv.isServerLocked}
          serversCount={srv.servers.length}

          onBack={handleBack}
          onDownloadPress={handleDownloadPress}
          onCancelDownload={cancelDownload}
          onOpenServerPicker={handleOpenServerPicker}
          onOpenEpisodeSelector={handleOpenEpisodeSelector}
          onNavigateToPlans={navigateToPlans}

          onSeekRelative={handleSeekRelative}
          onTogglePlayPause={handleTogglePlayPause}
          onSeekTo={embeddedSeekTo}

          qualityLevels={qualityLevels}
          subtitleTracks={subtitleTracks}
          activeQualityIndex={activeQualityIndex}
          activeSubtitleIndex={activeSubtitleIndex}
          showQualityPicker={showQualityPicker}
          showSubtitlePicker={showSubtitlePicker}
          showSettingsPicker={showSettingsPicker}
          onSetShowQualityPicker={setShowQualityPicker}
          onSetShowSubtitlePicker={setShowSubtitlePicker}
          onSetShowSettingsPicker={setShowSettingsPicker}

          onSelectQuality={handleSelectQuality}
          onSelectSubtitle={handleSelectSubtitle}

          autoPlayEnabled={autoPlayEnabled}
          onSetAutoPlay={setAutoPlay}
          autoSkipIntroEnabled={autoSkipIntroEnabled}
          onSetAutoSkipIntro={setAutoSkipIntro}

          resumeToast={resumeToast}
          resumeSeconds={resumeSeconds}
          skipToast={skipToast}
          skipLabel={skipLabel}
        />
        </Animated.View>
      )}

      {/* ── UP NEXT CARD ── */}
      <NextUpCard
        visible={!playerError && showNextUp && !!nextEpisode}
        nextEpisode={nextEpisode}
        posterUrl={anime?.poster_url}
        autoPlayCountdown={autoPlayCountdown}
        onPlayNow={handlePlayNow}
        onCancelAutoPlay={cancelAutoPlay}
        onDismiss={handleDismissNextUp}
      />

      {/* ── EPISODE SELECTOR SHEET ── */}
      <EpisodeSelectorSheet
        visible={showSelector}
        onClose={handleCloseSelectorSheet}
        streamableEpisodes={streamableEpisodes}
        activeEpisodeId={episode.id}
        posterUrl={anime?.poster_url}
        onSelectEpisode={handleSelectEpisode}
      />

      {/* ── SERVER PICKER SHEET ── */}
      <ServerPickerSheet
        visible={showServerPicker}
        onClose={handleCloseServerPicker}
        servers={srv.servers}
        grouped={srv.grouped}
        availableLangs={srv.availableLangs}
        selectedLang={srv.lang}
        selectedIndex={srv.index}
        onSelectLang={handleSelectLang}
        onSelectServer={handleSelectServer}
      />
    </View>
  );
}