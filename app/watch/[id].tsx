import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
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
import { useServerSelection } from "../../src/hooks/useServerSelection";
import ServerPickerSheet from "../../src/components/ui/ServerPickerSheet";
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
import PlayerHUDOverlay from "../../src/components/player/PlayerHUDOverlay";

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
  const [qualityLevels, setQualityLevels] = useState<{ label: string }[]>([]);
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
    require("../../src/hooks/useHlsDownloader").useHlsDownloader();

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
  const hasAppliedResumeRef = useRef(false);

  // Dynamic redirect tracking refs
  const isPageLoadedRef = useRef(false);
  const currentHostRef = useRef("");

  // HUD visibility — driven by WebView click events (injected JS fires player_tap)
  const [showHud, setShowHud] = useState(false);
  const HUD_AUTO_HIDE_MS = 4000;

  const toggleHud = useCallback(() => {
    setShowHud((prev) => {
      if (prev) {
        if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
        return false;
      }
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      hudTimerRef.current = setTimeout(() => {
        setShowHud(false);
        setShowQualityPicker(false);
        setShowSubtitlePicker(false);
        setShowSettingsPicker(false);
      }, HUD_AUTO_HIDE_MS);
      return true;
    });
  }, []);

  const resetHudTimer = useCallback(() => {
    setShowHud(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => {
      setShowHud(false);
      setShowQualityPicker(false);
      setShowSubtitlePicker(false);
      setShowSettingsPicker(false);
    }, HUD_AUTO_HIDE_MS);
  }, []);

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
    const baseTime = seekTargetRef.current !== null ? seekTargetRef.current : playerState.current;
    let target = baseTime + offset;
    if (playerState.duration > 0) {
      target = Math.max(0, Math.min(playerState.duration, target));
    } else {
      target = Math.max(0, target);
    }
    embeddedSeekTo(target);
  }, [playerState.current, playerState.duration, embeddedSeekTo]);

  // Stable refs for IDs to avoid stale closures in handleProgress
  const episodeIdRef = useRef<string | undefined>(undefined);
  const userIdRef = useRef<string | undefined>(undefined);

  // ── Data Queries ───────────────────────────────────────────────────────────
  const { data: episode, isLoading: loadingEp } = useEpisodeDetails(id as string);
  const { data: anime, isLoading: loadingAnime } = useAnimeDetails(episode?.anime_id);
  const { data: episodes } = useEpisodes(episode?.anime_id);
  const { data: savedProgress } = useWatchProgress(id as string);

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

  // ── Server selection hook ──────────────────────────────────────────────────
  const srv = useServerSelection(episode?.video_servers, episode?.video_url, isPremium);

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
      const htmlContent = buildRawPlayerHTML(srv.embedUrl, isHls);
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
  }, [srv.embedUrl, isRawVideo, embedOrigin]);

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
      console.log(`[Watch] ✓ Progress saved: ${current}s / ${duration}s (ep: ${eid})`);
      // Invalidate watch queries so lists show fresh progress immediately
      queryClient.invalidateQueries({ queryKey: ["user", uid] });
    }
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

  // Cleanup timers on unmount and save final progress instantly
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (skipToastTimeoutRef.current) clearTimeout(skipToastTimeoutRef.current);
      if (playerTickerRef.current) clearInterval(playerTickerRef.current);

      // Save final progress on unmount instantly
      const uid = userIdRef.current;
      const eid = episodeIdRef.current;
      const { current, duration } = playerStateRef.current;
      if (uid && eid && current > MIN_PROGRESS_SECONDS) {
        console.log(`[Watch] [Unmount] Saving final progress: ${current}s / ${duration}s`);
        (async () => {
          try {
            await userAPI.upsertProgress(uid, eid, current, duration > 0 && current > duration * 0.9);
            // Invalidate queries so that Continue Watching is 100% accurate
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
          if (initialResumeSecondsRef.current > 5 && !hasAppliedResumeRef.current) {
            hasAppliedResumeRef.current = true;
            console.log(`[Watch] [player_ready] Seeking to initial resume position: ${initialResumeSecondsRef.current}s`);
            setTimeout(() => embeddedSeekTo(initialResumeSecondsRef.current), 500);
          }
        }

        if (msg.type === "player_not_found") {
          setPlayerReady(true);
          if (initialResumeSecondsRef.current > 5 && !hasAppliedResumeRef.current) {
            hasAppliedResumeRef.current = true;
            console.log(`[Watch] [player_not_found] Seeking to initial resume position: ${initialResumeSecondsRef.current}s`);
            setTimeout(() => embeddedSeekTo(initialResumeSecondsRef.current), 500);
          }
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

          if (!nearEndFired.current && duration > 0) {
            const threshold = Math.min(NEAR_END_THRESHOLD_FALLBACK, duration * 0.1);
            if (duration - current < threshold && nextEpisode) {
              nearEndFired.current = true;
              setShowNextUp(true);
            }
          }
        }

        if (msg.type === "qualities") {
          if (Array.isArray(msg.levels) && msg.levels.length > 0) {
            setQualityLevels(
              msg.levels.map((l: any, i: number) => ({
                label: l.label || (l.height ? `${l.height}p` : `Level ${i}`),
              }))
            );
            if (typeof msg.current === "number") setActiveQualityIndex(msg.current);
          }
        }

        if (msg.type === "qualityChanged") {
          if (typeof msg.current === "number") setActiveQualityIndex(msg.current);
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
    [handleProgress, handleEpisodeComplete, nextEpisode, toggleHud, handleDownloadMessage]
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
    hasAppliedResumeRef.current = false;
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
    hasAppliedResumeRef.current = false;
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

  const injectedJS = useMemo(
    () => buildCombinedJS(initialResumeSecondsRef.current, autoSkipIntroEnabled, useNativePlayerOnly),
    [autoSkipIntroEnabled, useNativePlayerOnly]
  );

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

  // Premium Episode block
  if (episode.is_premium && !isPremium) {
    return (
      <View style={styles.fullCenter}>
        <Ionicons name="star" size={56} color={COLORS.neonGold} />
        <Text style={[styles.errorTitle, { color: COLORS.neonGold }]}>Premium Episode</Text>
        <Text style={styles.errorSubtitle}>Upgrade to Premium to unlock{"\n"}this episode and many more.</Text>
        <TouchableOpacity
          style={[styles.errorBtn, { backgroundColor: COLORS.neonGold }]}
          onPress={() => router.push("/plans")}
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
        source={webViewSource}
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
        onSwitchServer={() => (srv.isServerLocked ? router.push("/plans") : setShowServerPicker(true))}
        onRetry={() => {
          setPlayerError(false);
          setPlayerReady(false);
          startSpinnerTimeout();
          webviewRef.current?.reload();
        }}
        onGoBack={() => router.back()}
      />

      {/* ── HUD OVERLAY LAYER ── */}
      {!playerError && (
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

          onBack={() => router.back()}
          onDownloadPress={handleDownloadPress}
          onCancelDownload={cancelDownload}
          onOpenServerPicker={() => setShowServerPicker(true)}
          onOpenEpisodeSelector={() => setShowSelector(true)}
          onNavigateToPlans={() => router.push("/plans")}

          onSeekRelative={handleSeekRelative}
          onTogglePlayPause={() => {
            if (playerState.isPlaying) embeddedPause();
            else embeddedPlay();
          }}
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

          onSelectQuality={(index) => {
            playerCommand(`window.__rn_setQuality(${index})`);
            setActiveQualityIndex(index);
            setShowQualityPicker(false);
          }}
          onSelectSubtitle={(index) => {
            playerCommand(`window.__rn_setSubtitle(${index})`);
            setActiveSubtitleIndex(index);
            setShowSubtitlePicker(false);
          }}

          autoPlayEnabled={autoPlayEnabled}
          onSetAutoPlay={setAutoPlay}
          autoSkipIntroEnabled={autoSkipIntroEnabled}
          onSetAutoSkipIntro={setAutoSkipIntro}

          resumeToast={resumeToast}
          resumeSeconds={resumeSeconds}
          skipToast={skipToast}
          skipLabel={skipLabel}
        />
      )}

      {/* ── UP NEXT CARD ── */}
      <NextUpCard
        visible={!playerError && showNextUp && !!nextEpisode}
        nextEpisode={nextEpisode}
        posterUrl={anime?.poster_url}
        autoPlayCountdown={autoPlayCountdown}
        onPlayNow={() => {
          cancelAutoPlay();
          router.replace(`/watch/${nextEpisode?.id}`);
        }}
        onCancelAutoPlay={cancelAutoPlay}
      />

      {/* ── EPISODE SELECTOR SHEET ── */}
      <EpisodeSelectorSheet
        visible={showSelector}
        onClose={() => setShowSelector(false)}
        streamableEpisodes={streamableEpisodes}
        activeEpisodeId={episode.id}
        posterUrl={anime?.poster_url}
        onSelectEpisode={(epId) => {
          setShowSelector(false);
          router.replace(`/watch/${epId}`);
        }}
      />

      {/* ── SERVER PICKER SHEET ── */}
      <ServerPickerSheet
        visible={showServerPicker}
        onClose={() => setShowServerPicker(false)}
        servers={srv.servers}
        grouped={srv.grouped}
        availableLangs={srv.availableLangs}
        selectedLang={srv.lang}
        selectedIndex={srv.index}
        onSelectLang={(lang) => {
          srv.selectLang(lang);
          setPlayerError(false);
          setPlayerReady(false);
        }}
        onSelectServer={(i) => {
          srv.selectServer(i);
          setPlayerError(false);
          setPlayerReady(false);
        }}
      />
    </View>
  );
}
