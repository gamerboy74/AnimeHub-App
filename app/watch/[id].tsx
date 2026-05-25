import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  ScrollView,
  FlatList,
  Animated,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import * as ScreenOrientation from "expo-screen-orientation";
import * as NavigationBar from "expo-navigation-bar";
import { useKeepAwake } from "expo-keep-awake";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
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
import DownloadButton from "../../src/components/ui/DownloadButton";
import { useHlsDownloader } from "../../src/hooks/useHlsDownloader";
import { supabase, userAPI } from "../../src/lib/supabase";
import { useAuth } from "../../src/context/AuthContext";
import { COLORS } from "../../src/constants/theme";

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
// How often (ms) the injected JS polls the player for current time
const POLL_INTERVAL_MS = 5000;

// How many seconds from the end triggers the "Up Next" card
const NEAR_END_THRESHOLD_FALLBACK = 60;

// Minimum seconds watched before we bother saving progress
const MIN_PROGRESS_SECONDS = 5;

// Countdown seconds before auto-navigating to next episode
const AUTO_PLAY_COUNTDOWN_SEC = 5;

// ─── INJECTED JAVASCRIPT ───────────────────────────────────────────────────────
// Runs inside the WebView. Polls JWPlayer/HTML5 video for state, forwards progress
// and error events back to React Native, and applies seek-to-resume.
// Also injects a network sniffer that intercepts fetch/XHR to capture .m3u8 URLs.

/** Part 1: Network sniffer — intercepts fetch/XHR to detect .m3u8 URLs */
const buildSnifferJS = () => `
  (function() {
    var _mediaReported = {};
    function _reportMedia(url) {
      try {
        if (!url || typeof url !== 'string') return;
        if (_mediaReported[url]) return;
        var lc = url.toLowerCase();
        if (!lc.includes('.m3u8') && !lc.includes('.mp4') && !lc.includes('.mkv')) return;
        _mediaReported[url] = true;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'MEDIA_URL_DETECTED',
          mediaUrl: url,
          referer: window.location.href,
          origin: window.location.origin,
        }));
      } catch(e) {}
    }
    var _origFetch = window.fetch;
    window.fetch = function() {
      var args = arguments;
      var url = args[0];
      var actualUrl = typeof url === 'string' ? url : (url && typeof url.url === 'string' ? url.url : '');
      var promise = _origFetch.apply(this, args);
      
      if (actualUrl && actualUrl.toLowerCase().includes('.m3u8')) {
        promise.then(function(res) {
          try {
            res.clone().text().then(function(text) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MEDIA_MANIFEST_READY',
                mediaUrl: actualUrl,
                referer: window.location.href,
                manifestContent: text,
                cookies: document.cookie,
              }));
            }).catch(function(e) {});
          } catch(e) {}
        }).catch(function(e) {});
      }
      
      if (actualUrl) _reportMedia(actualUrl);
      return promise;
    };
    var _origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      var actualUrl = url;
      if (actualUrl && typeof actualUrl === 'string' && actualUrl.toLowerCase().includes('.m3u8')) {
        this.addEventListener('readystatechange', function() {
          if (this.readyState === 4 && this.status >= 200 && this.status < 300) {
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MEDIA_MANIFEST_READY',
                mediaUrl: actualUrl,
                referer: window.location.href,
                manifestContent: this.responseText,
                cookies: document.cookie,
              }));
            } catch(e) {}
          }
        });
      }
      _reportMedia(url);
      return _origOpen.apply(this, arguments);
    };
    setTimeout(function() {
      try {
        document.querySelectorAll('source[src],video[src]').forEach(function(el) {
          _reportMedia(el.src || el.getAttribute('src'));
        });
      } catch(e) {}
    }, 3000);

    // Segment download helper — runs within the WebView's TLS/session context
    window.__rn_download_segment = function(url, index) {
      fetch(url)
        .then(function(res) {
          if (!res.ok) throw new Error("Status " + res.status);
          return res.blob();
        })
        .then(function(blob) {
          var reader = new FileReader();
          reader.onloadend = function() {
            var base64data = reader.result.split(',')[1];
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'DOWNLOAD_SEGMENT_CHUNK',
              index: index,
              url: url,
              base64: base64data
            }));
          };
          reader.readAsDataURL(blob);
        })
        .catch(function(err) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DOWNLOAD_SEGMENT_ERROR',
            index: index,
            url: url,
            error: err ? err.message : 'Unknown WebView segment fetch error'
          }));
        });
    };
  })();
`;

/** Part 2: Main player script — polling, resume, skip-intro, HUD tap */
const buildMainInjectedJS = (resumeSeconds: number, autoSkipIntro: boolean) => `

  (function() {
    // ─── FORCE FULL-SCREEN LAYOUT ────────────────────────────────────────────
    // Eliminates blank bars on the left/right in landscape by ensuring the page
    // itself (not just the WebView container) fills the entire viewport.
    var _style = document.createElement('style');
    _style.textContent = [
      'html, body { width:100% !important; height:100% !important; margin:0 !important; padding:0 !important; overflow:hidden !important; background:#000 !important; }',
      // Fill all common player wrappers edge-to-edge
      'iframe, #player, .player, [id*="player"], [class*="player"] { width:100% !important; height:100% !important; max-width:100% !important; position:fixed !important; top:0 !important; left:0 !important; border:none !important; }',
      // Scale video to fill screen proportionally — cover crops edges slightly but no distortion
      'video { width:100vw !important; height:100vh !important; max-width:100vw !important; max-height:100vh !important; object-fit:cover !important; position:fixed !important; top:0 !important; left:0 !important; }',
    ].join('');
    (document.head || document.documentElement).appendChild(_style);

    // Re-apply object-fit:fill whenever the player injects a new <video> element
    var _videoObserver = new MutationObserver(function() {
      document.querySelectorAll('video').forEach(function(v) {
        v.style.setProperty('object-fit', 'fill', 'important');
        v.style.setProperty('width', '100vw', 'important');
        v.style.setProperty('height', '100vh', 'important');
        v.style.setProperty('position', 'fixed', 'important');
        v.style.setProperty('top', '0', 'important');
        v.style.setProperty('left', '0', 'important');
      });
    });
    _videoObserver.observe(document.documentElement, { childList: true, subtree: true });

    // Also ensure the viewport meta tag requests full width
    var _meta = document.querySelector('meta[name="viewport"]');
    if (!_meta) {
      _meta = document.createElement('meta');
      _meta.setAttribute('name', 'viewport');
      (document.head || document.documentElement).appendChild(_meta);
    }
    _meta.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');

    // ─── REDIRECT / POPUP KILL ────────────────────────────────────────────────
    // Block every JS navigation method ads use to hijack the WebView.

    // 1) window.open → null (popup blocker)
    window.open = function() { return null; };
    window.alert = function() {};
    window.confirm = function() { return false; };
    window.prompt = function() { return null; };

    // 2) location.replace / assign
    try {
      window.location.replace = function() { console.log('[RN] Blocked location.replace'); };
      window.location.assign  = function() { console.log('[RN] Blocked location.assign'); };
    } catch(e) {}

    // 3) location.href setter — the #1 ad redirect method
    try {
      var _locDesc = Object.getOwnPropertyDescriptor(window.location, 'href')
                  || Object.getOwnPropertyDescriptor(Location.prototype, 'href');
      if (_locDesc && _locDesc.set) {
        Object.defineProperty(window.location, 'href', {
          get: _locDesc.get,
          set: function(url) {
            // Allow only same-origin assignments (e.g. player's own navigation)
            try {
              var dest = new URL(url, window.location.href);
              if (dest.hostname === window.location.hostname) {
                _locDesc.set.call(window.location, url);
              } else {
                console.log('[RN] Blocked location.href →', url);
              }
            } catch(e) {
              _locDesc.set.call(window.location, url); // malformed — allow
            }
          },
          configurable: true,
        });
      }
    } catch(e) {}

    // 4) document.location — same as window.location but ads sometimes use this
    try { Object.defineProperty(document, 'location', { get: function() { return window.location; } }); } catch(e) {}

    // 5) Kill meta-refresh redirect tags injected by ad scripts
    var _metaObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeName === 'META') {
            var http = node.getAttribute('http-equiv') || '';
            if (http.toLowerCase() === 'refresh') {
              node.parentNode && node.parentNode.removeChild(node);
              console.log('[RN] Removed meta-refresh');
            }
          }
        });
      });
    });
    _metaObserver.observe(document.documentElement || document, {
      childList: true, subtree: true,
    });

    // ─── SEEK HELPER ─────────────────────────────────────────────────────────

    // --- Seek helper ---
    window.__rn_seek = function(seconds) {
      try {
        var p = jwplayer();
        if (p && typeof p.seek === 'function' && seconds > 5) p.seek(seconds);
      } catch(e) {}
    };

    var attempts     = 0;
    var resumeApplied = false;
    var pollInterval  = null;

    // --- Hook JWPlayer errors (including error 104153 = stream fetch failed) ---
    function attachErrorListeners(p) {
      function onJWError(e) {
        var code = (e && e.code) ? e.code : 0;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'player_error',
          code: code,
          message: (e && e.message) ? e.message : 'Unknown JWPlayer error',
        }));
        // For stream-fetch errors (104xxx range), try reloading the playlist once
        if (code >= 104000 && code < 105000) {
          setTimeout(function() {
            try {
              var playlist = p.getPlaylist();
              if (playlist && playlist.length > 0) {
                p.load(playlist);
                p.play();
              }
            } catch(err) {}
          }, 2000);
        }
      }
      try { p.on('error',       onJWError); } catch(e) {}
      try { p.on('setupError',  onJWError); } catch(e) {}
      try { p.on('adError',     function() {}); } catch(e) {} // suppress ad errors silently
    }

    function startPolling(p) {
      attachErrorListeners(p);

      // ── Episode complete (JWPlayer 'complete' event) ────────────────────────
      // Fire as soon as the player itself signals end — more reliable than
      // polling because it fires even if the last poll missed the final frame.
      try {
        p.on('complete', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'episode_complete' }));
        });
      } catch(e) {}

      pollInterval = setInterval(function() {
        try {
          if (!p || typeof p.getPosition !== 'function') return;
          var current  = Math.floor(p.getPosition());
          var duration = Math.floor(p.getDuration());
          var state    = p.getState();

          if (!resumeApplied && duration > 5 && ${resumeSeconds} > 5) {
            resumeApplied = true;
            p.seek(${resumeSeconds});
          }

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type:     'progress',
            current:  current,
            duration: duration,
            playing:  state === 'playing',
          }));
        } catch(e) {}
      }, ${POLL_INTERVAL_MS});
    }

    // Poll for JWPlayer availability
    var readyCheck = setInterval(function() {
      attempts++;
      try {
        var p = jwplayer();
        if (p && typeof p.getPosition === 'function') {
          clearInterval(readyCheck);
          startPolling(p);
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'player_ready' }));
        }
      } catch(e) {}
      if (attempts > 30) {
        clearInterval(readyCheck);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'player_not_found' }));
      }
    }, 500);

    // --- HTML5 <video> fallback ---
    var videoInterval = setInterval(function() {
      var videos = document.querySelectorAll('video');
      if (videos.length === 0) return;
      var vid = videos[0];
      clearInterval(videoInterval);

      vid.addEventListener('loadedmetadata', function() {
        if (!resumeApplied && ${resumeSeconds} > 5) {
          resumeApplied = true;
          vid.currentTime = ${resumeSeconds};
        }
      });
      if (!resumeApplied && ${resumeSeconds} > 5 && vid.readyState >= 1) {
        resumeApplied = true;
        vid.currentTime = ${resumeSeconds};
      }

      // ── Episode complete (HTML5 'ended' event) ──────────────────────────────
      vid.addEventListener('ended', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'episode_complete' }));
      });

      // Forward HTML5 video errors
      vid.addEventListener('error', function() {
        var code = vid.error ? vid.error.code : -1;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'player_error', code: code, message: 'HTML5 video error',
        }));
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
    }, 1000);

    // ─── AUTO SKIP INTRO / OUTRO / CREDITS ──────────────────────────────────────
    // Top-level: runs for ALL embed players (JWPlayer + HTML5).
    // Uses MutationObserver + 500ms poll to detect skip buttons injected by the
    // streaming site and auto-clicks them after a 400ms human-like delay.
    // Covers: Zoro/HiAnime, Gogoanime, 9anime, Megacloud, Vidstream, Hanime, etc.
    if (${autoSkipIntro}) {
      var SKIP_TEXT_RE = /^skip(\s+|[_\-])?(intro|opening|op|outro|ending|ed|credits|recap|preview|filler|title)?\.?$/i;
      var SKIP_PREFIX_RE = /^skip\s/i;
      var SKIP_CLASS_KEYS = [
        'skip-intro','skip-outro','skip-op','skip-ed','skip-btn','skip_btn',
        'skip-opening','skip-ending','skip-credits','skip-title',
        'btn-skip','introSkip','outroSkip','op-btn','ed-btn',
      ];
      var _debounce = false;

      function _vis(el) {
        try {
          var r = el.getBoundingClientRect(), s = window.getComputedStyle(el);
          return r.width > 0 && r.height > 0
            && s.display !== 'none' && s.visibility !== 'hidden'
            && parseFloat(s.opacity) > 0.05;
        } catch(e) { return false; }
      }
      function _attrMatch(el) {
        var c = (el.className || '').toString().toLowerCase();
        var d = (el.id || '').toLowerCase();
        return SKIP_CLASS_KEYS.some(function(k) { return c.indexOf(k) !== -1 || d.indexOf(k) !== -1; });
      }
      function _trySkip(el) {
        if (!el || !_vis(el) || _debounce) return;
        var t = ((el.textContent || el.innerText || el.getAttribute('aria-label') || '')
          .trim().replace(/[\u200B-\u200D\uFEFF]/g, '').trim());
        if (!SKIP_TEXT_RE.test(t) && !SKIP_PREFIX_RE.test(t) && !_attrMatch(el)) return;
        _debounce = true;
        setTimeout(function() { _debounce = false; }, 3000);
        setTimeout(function() {
          try {
            el.click();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'skip_intro', label: t || el.className || 'skip',
            }));
          } catch(e) {}
        }, 400);
      }
      function _scan(root) {
        ['button','a','div','span','p'].forEach(function(tag) {
          try { root.querySelectorAll(tag).forEach(_trySkip); } catch(e) {}
        });
        _trySkip(root);
      }
      var _mo = new MutationObserver(function(ms) {
        ms.forEach(function(m) {
          m.addedNodes.forEach(function(n) { if (n.nodeType === 1) _scan(n); });
          if (m.type === 'attributes' && m.target.nodeType === 1) _trySkip(m.target);
        });
      });
      _mo.observe(document.documentElement, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['class','style','hidden','aria-hidden'],
      });
      setInterval(function() {
        try {
          document.querySelectorAll(
            'button,[class*="skip"],[id*="skip"],[class*="Skip"],[id*="Skip"],'
            + '[aria-label*="skip" i],[aria-label*="Skip" i]'
          ).forEach(_trySkip);
        } catch(e) {}
      }, 500);
    }

    // ─── TAP → TOGGLE HUD ───────────────────────────────────────────────────
    // Listen for any click/tap inside the WebView page. The event is NOT
    // cancelled so the player's own controls still fire normally. We just
    // piggyback on it to notify React Native so it can show/hide the HUD.
    document.addEventListener('click', function() {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'player_tap' }));
      } catch(e) {}
    }, true); // capture phase so we hear it before the player swallows it

  })();
  true;
`;

// Compose: sniffer first, then main player script
const buildCombinedJS = (resumeSeconds: number, autoSkipIntro: boolean) =>
  buildSnifferJS() +
  '\n' +
  buildMainInjectedJS(resumeSeconds, autoSkipIntro);

// Module-level flag: true while a WatchScreen instance is actively mounting.
// Used to skip portrait restoration when switching between episodes — the new
// instance sets this flag before the old one's cleanup runs its portrait lock.
let _watchMounting = false;

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function WatchScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { isPremium, canWatch } = usePremium();
  const { autoPlayEnabled } = useAutoPlay();
  const { autoSkipIntroEnabled } = useAutoSkipIntro();
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
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    current: 0,
    duration: 0,
  });
  const [autoPlayCountdown, setAutoPlayCountdown] = useState<number | null>(null);
  const [showServerPicker, setShowServerPicker] = useState(false);

  // ── Download state ────────────────────────────────────────────────────────
  const [sniffedMediaUrl, setSniffedMediaUrl] = useState<string | null>(null);
  const [sniffedReferer, setSniffedReferer] = useState<string>('');
  const [sniffedManifestCache, setSniffedManifestCache] = useState<Record<string, string>>({});
  const [sniffedCookies, setSniffedCookies] = useState<string>('');
  const downloader = useHlsDownloader();

  const webviewRef = useRef<any>(null);
  const nearEndFired = useRef(false);
  const lastSavedRef = useRef(0);
  const spinnerTimeoutRef = useRef<any>(null);
  const hudTimerRef = useRef<any>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null); // auto-play timer
  const skipToastTimeoutRef = useRef<any>(null);

  // HUD visibility — driven by WebView click events (injected JS fires player_tap)
  const [showHud, setShowHud] = useState(true);

  // Show HUD for 4s then hide. Called on every player_tap message from WebView.
  const resetHudTimer = useCallback(() => {
    setShowHud(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setShowHud(false), 4000);
  }, []);

  // Stable refs for episode/user IDs — avoids stale closures in handleProgress
  const episodeIdRef = useRef<string | undefined>(undefined);
  const userIdRef = useRef<string | undefined>(undefined);


  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: episode, isLoading: loadingEp } = useEpisodeDetails(
    id as string,
  );
  const { data: anime, isLoading: loadingAnime } = useAnimeDetails(
    episode?.anime_id,
  );
  const { data: episodes } = useEpisodes(episode?.anime_id);
  const { data: savedProgress } = useWatchProgress(id as string);
  const { data: similarAnime } = useSimilarAnime(anime?.genres, anime?.id);

  const resumeSeconds = savedProgress?.progress_seconds ?? 0;

  // ── Server selection — hook owns all state ───────────────────────────────────
  // Must run before any early returns (Rules of Hooks).
  const srv = useServerSelection(
    (episode as any)?.video_servers,
    episode?.video_url,
  );

  const embedOrigin = useMemo(() => {
    try { return new URL(srv.embedUrl).origin; } catch { return ''; }
  }, [srv.embedUrl]);

  // Keep refs in sync so handleProgress always has fresh IDs without stale closures
  useEffect(() => { episodeIdRef.current = episode?.id; }, [episode?.id]);
  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);

  // Only show episodes that have a working video URL — same filter applied
  // everywhere (detail page, episodes list, and here in the player selector).
  const streamableEpisodes = useMemo(
    () => episodes?.filter((ep) => !!ep.video_url?.trim()) ?? [],
    [episodes]
  );

  const nextEpisode = useMemo(
    () => streamableEpisodes.find(
      (e) => e.episode_number === (episode?.episode_number ?? 0) + 1
    ),
    [streamableEpisodes, episode?.episode_number]
  );

  const activeIndex = useMemo(
    () => streamableEpisodes.findIndex((ep) => ep.id === id),
    [streamableEpisodes, id]
  );

  // ── Prefetch next 2 streamable episodes ──────────────────────────────────────
  // Dep: episode?.id only — re-runs only when the episode actually changes.
  // Listing streamableEpisodes would re-run on every render (new array ref each time)
  // causing an infinite loop driven by the 5s WebView progress poll.
  useEffect(() => {
    if (!episode || streamableEpisodes.length === 0) return;
    const currentNum = episode.episode_number ?? 0;

    const upcoming = streamableEpisodes
      .filter((e) => e.episode_number > currentNum)
      .slice(0, 2); // prefetch next 2 only

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
    if (resumeSeconds > 5) {
      setResumeToast(true);
      const t = setTimeout(() => setResumeToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [resumeSeconds]);

  // ── Progress sync to Supabase (throttled to 1 write per 10s) ────────────────
  // Uses refs instead of closure deps so we never capture a stale episode/user.
  const handleProgress = useCallback(
    async (current: number, duration: number) => {
      const uid = userIdRef.current;
      const eid = episodeIdRef.current;
      if (!uid || !eid || current < MIN_PROGRESS_SECONDS) return;

      const now = Date.now();
      if (now - lastSavedRef.current < 10_000) return; // throttle: 1 write per 10s
      lastSavedRef.current = now;

      const isCompleted = duration > 0 && current > duration * 0.9;
      const { error } = await userAPI.upsertProgress(uid, eid, current, isCompleted);

      if (error) {
        console.error('[Watch] Progress save failed:', JSON.stringify(error));
      } else {
        console.log(`[Watch] ✓ Progress saved: ${current}s / ${duration}s (ep: ${eid})`);
      }
    },
    [], // no deps — reads from refs only, never stale
  );

  // ── Episode complete — start auto-play countdown ─────────────────────────────
  const handleEpisodeComplete = useCallback(() => {
    if (!nextEpisode) return;
    setShowNextUp(true);
    if (!autoPlayEnabled) return; // setting off — just show the card, no countdown

    setAutoPlayCountdown(AUTO_PLAY_COUNTDOWN_SEC);
    let remaining = AUTO_PLAY_COUNTDOWN_SEC;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setAutoPlayCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        router.replace(`/watch/${nextEpisode.id}`);
      }
    }, 1000);
  }, [nextEpisode, autoPlayEnabled, router]);

  // Cancel the running countdown (user tapped ✕ or chose episode manually)
  const cancelAutoPlay = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setAutoPlayCountdown(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (skipToastTimeoutRef.current) clearTimeout(skipToastTimeoutRef.current);
  }, []);

  // ── WebView message handler ───────────────────────────────────────────────
  const handleWebViewMessage = useCallback(
    (event: any) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data);

        if (msg.type === "player_tap") {
          // User tapped inside the WebView — toggle the HUD
          resetHudTimer();
        }

        // ── Network sniffer result ─────────────────────────────────────────
        if (msg.type === 'MEDIA_URL_DETECTED') {
          const { mediaUrl, referer } = msg;
          // Only accept .m3u8 for HLS download; prefer the first one captured
          if (mediaUrl && mediaUrl.toLowerCase().includes('.m3u8') && !sniffedMediaUrl) {
            console.log('[Download] Sniffed .m3u8:', mediaUrl);
            setSniffedMediaUrl(mediaUrl);
            setSniffedReferer(referer || '');
          }
        }

        if (msg.type === 'MEDIA_MANIFEST_READY') {
          const { mediaUrl, referer, manifestContent, cookies } = msg;
          if (mediaUrl && manifestContent) {
            console.log('[Download] Captured manifest for:', mediaUrl);
            setSniffedManifestCache(prev => ({
              ...prev,
              [mediaUrl]: manifestContent
            }));
            if (cookies) {
              setSniffedCookies(cookies);
            }
            if (!sniffedMediaUrl) {
              setSniffedMediaUrl(mediaUrl);
              setSniffedReferer(referer || '');
            }
          }
        }

        if (msg.type === 'DOWNLOAD_SEGMENT_CHUNK' || msg.type === 'DOWNLOAD_SEGMENT_ERROR') {
          downloader.handleDownloadMessage(msg);
        }

        if (msg.type === "player_error") {
          const { code } = msg;
          console.warn("[Watch] JWPlayer error", code, msg.message);
          // 104xxx = stream/media fetch errors → show the error UI
          // Other codes (e.g. ad errors) are non-fatal, ignore them
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
          // JS fired native 'complete'/'ended' — start auto-play countdown
          handleEpisodeComplete();
        }

        if (msg.type === "skip_intro") {
          const label = msg.label || "credits";
          setSkipLabel(label);
          setSkipToast(true);
          if (skipToastTimeoutRef.current) clearTimeout(skipToastTimeoutRef.current);
          skipToastTimeoutRef.current = setTimeout(() => setSkipToast(false), 3500);
        }

        if (msg.type === "progress") {
          const { current, duration, playing } = msg;

          setPlayerState({ isPlaying: playing, current, duration });
          handleProgress(current, duration);

          // Near-end: show the "Up Next" card early so user sees it coming.
          // The countdown itself only starts on episode_complete (more reliable).
          if (!nearEndFired.current && duration > 0) {
            const threshold = Math.min(
              NEAR_END_THRESHOLD_FALLBACK,
              duration * 0.1,
            );
            if (duration - current < threshold && nextEpisode) {
              nearEndFired.current = true;
              setShowNextUp(true);
            }
          }
        }
      } catch (_) { }
    },
    [handleProgress, handleEpisodeComplete, nextEpisode, resetHudTimer, sniffedMediaUrl, downloader],
  );

  // ── Trigger download when user presses the Download button ──────────────────
  const handleDownloadPress = useCallback(() => {
    if (!sniffedMediaUrl || !episode) return;
    downloader.startDownload(
      sniffedMediaUrl,
      sniffedReferer || embedOrigin,
      {
        episodeId: episode.id,
        title: `Ep ${episode.episode_number}: ${episode.title ?? ''}`,
        animeName: anime?.title ?? 'Unknown',
        thumbnailUrl: episode.thumbnail_url ?? anime?.poster_url ?? '',
      },
      undefined, // resolved in hook from cache
      sniffedCookies,
      sniffedManifestCache,
      (js: string) => {
        webviewRef.current?.injectJavaScript(js);
      }
    );
  }, [sniffedMediaUrl, sniffedReferer, embedOrigin, episode, anime, downloader, sniffedCookies, sniffedManifestCache]);

  // ── Orientation + nav bar ─────────────────────────────────────────────────
  // We mount landscape immediately. On unmount we restore portrait ONLY if no
  // other WatchScreen is about to mount (i.e. we're genuinely leaving the player,
  // not just switching episodes). The 50ms window lets the next instance set
  // _watchMounting = true before this cleanup's timeout fires.
  useEffect(() => {
    _watchMounting = true; // Signal: this instance is active
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    NavigationBar.setVisibilityAsync("hidden");
    NavigationBar.setBehaviorAsync("overlay-swipe");

    // Clear the flag after mount so it doesn't block future cleanups
    const clearTimer = setTimeout(() => {
      _watchMounting = false;
    }, 50);

    return () => {
      clearTimeout(clearTimer);
      // Delay portrait restore by 50ms. If another WatchScreen mounts in that
      // window (episode switch), it sets _watchMounting = true and we abort.
      setTimeout(() => {
        if (!_watchMounting) {
          ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.PORTRAIT_UP,
          );
          NavigationBar.setVisibilityAsync("visible");
        }
      }, 50);
    };
  }, []);

  useKeepAwake();

  // ── Reset state + spinner when episode changes ────────────────────────────
  useEffect(() => {
    nearEndFired.current = false;
    lastSavedRef.current = 0;
    setShowNextUp(false);
    setPlayerReady(false);
    setPlayerError(false);
    setSniffedMediaUrl(null);   // clear sniffed URL for new episode
    setSniffedReferer('');
    setSniffedManifestCache({});
    setSniffedCookies('');
    downloader.cancelDownload();
    srv.reset(); // reset server + lang to defaults on episode change
    cancelAutoPlay();

    // Show HUD briefly then auto-hide — restarts the timer on every episode switch
    resetHudTimer();

    // Auto-dismiss spinner after 8s — some embeds never fire player_ready
    if (spinnerTimeoutRef.current) clearTimeout(spinnerTimeoutRef.current);
    spinnerTimeoutRef.current = setTimeout(() => setPlayerReady(true), 8000);

    return () => {
      if (spinnerTimeoutRef.current) clearTimeout(spinnerTimeoutRef.current);
    };
  }, [id, resetHudTimer, cancelAutoPlay]);

  // NOTE: clearOtherProgress was removed — it was wiping all episode history
  // on every mount which caused the watch tracker to lose progress.


  const injectedJS = useMemo(
    () => buildCombinedJS(resumeSeconds, autoSkipIntroEnabled),
    [resumeSeconds, autoSkipIntroEnabled]
  );

  const handleEpisodeSelect = useCallback((epId: string) => {
    setShowSelector(false);
    router.replace(`/watch/${epId}`);
  }, [router]);

  const renderEpisodeItem = useCallback(({ item: ep }: { item: any }) => (
    <EpisodeSelectorItem
      ep={ep}
      isActive={ep.id === id}
      posterUrl={anime?.poster_url}
      onPress={handleEpisodeSelect}
    />
  ), [id, anime?.poster_url, handleEpisodeSelect]);

  const episodeKeyExtractor = useCallback((ep: any) => ep.id, []);

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

  // ── Premium episode guard ────────────────────────────────────────────────────
  // Block free users from watching premium episodes even if they navigate directly.
  if (episode.is_premium && !isPremium) {
    return (
      <View style={styles.fullCenter}>
        <Ionicons name="star" size={56} color={COLORS.neonGold} />
        <Text style={[styles.errorTitle, { color: COLORS.neonGold }]}>Premium Episode</Text>
        <Text style={styles.errorSubtitle}>
          Upgrade to Premium to unlock{"\n"}this episode and many more.
        </Text>
        <TouchableOpacity
          style={[styles.errorBtn, { backgroundColor: COLORS.neonGold }]}
          onPress={() => router.push('/premium' as any)}
        >
          <Ionicons name="star" size={16} color="#000" />
          <Text style={[styles.errorBtnText, { color: '#000' }]}>UPGRADE TO PREMIUM</Text>
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

  // Guard: if no URL is available for the current server/lang selection, show error.
  if (!srv.embedUrl) {
    return (
      <View style={styles.fullCenter}>
        <Ionicons
          name="cloud-offline-outline"
          size={56}
          color={COLORS.neonPink}
        />
        <Text style={styles.errorTitle}>Stream Unavailable</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.errorBtn, styles.errorBtnSecondary]}
        >
          <Text style={[styles.errorBtnText, { color: COLORS.neon }]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar hidden translucent backgroundColor="transparent" />

      {/* ── WEBVIEW PLAYER ── */}
      <WebView
        ref={webviewRef}
        source={{
          uri: srv.embedUrl,
          // Use the embed URL's own origin as Referer so the CDN sees a
          // self-referential request — works for any streaming host without
          // maintaining a per-site list.
          headers: embedOrigin
            ? {
              Referer: embedOrigin + "/",
              Origin: embedOrigin,
            }
            : {},
        }}
        style={StyleSheet.absoluteFill}
        // Allow autoplay — critical for video embeds
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        allowsInlineMediaPlayback={true}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustsScrollIndicatorInsets={false}
        overScrollMode="never"
        javaScriptEnabled={true}
        domStorageEnabled={true}
        // Force block popups/new windows at the native layer
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        // Inject our polling + resume script into ALL frames (so it reaches embedded players)
        injectedJavaScript={injectedJS}
        injectedJavaScriptForMainFrameOnly={false}
        onMessage={handleWebViewMessage}
        // Page HTML loaded — cancel the 8s fallback timer and show the player immediately
        onLoadEnd={() => {
          if (spinnerTimeoutRef.current)
            clearTimeout(spinnerTimeoutRef.current);
          setPlayerReady(true);
        }}
        // Full Chrome 124 desktop UA — replaces the entire WebView UA string.
        // applicationNameForUserAgent only *appends* to the Dalvik/mobile UA, which
        // causes servers like megacloud.bloggy.click to detect a bot and block the stream.
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        // Kill any cookie / auth walls
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        onError={() => setPlayerError(true)}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 400) setPlayerError(true);
        }}
        // ── Redirect guard — GENERIC, zero per-site maintenance ────────────
        // OLD approach: allowlist every CDN domain → breaks whenever a new
        //               streaming host is added.
        // NEW approach: blocklist the tiny set of things that are ALWAYS harmful
        //               (non-http schemes + confirmed pure-ad domains).
        //               Everything else — CDNs, player scripts, HLS, APIs — passes.
        //
        // Note: on Android, onShouldStartLoadWithRequest fires for main-frame
        // navigations only (not subresource fetches), so this is safe to open up.
        onShouldStartLoadWithRequest={(req) => {
          const url = req.url;

          // ① Block non-http(s) schemes: intent://, market://, app-store://, etc.
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            console.log("[WebView] BLOCKED scheme →", url);
            return false;
          }

          // ② Block confirmed pure-ad / redirect domains — never serve video.
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
            // Additional common ad/redirect networks
            "propellerads.com",
            "trafficstars.com",
            "hilltopads.net",
            "adsterra.com",
            "bidvertiser.com",
            "revcontent.com",
            "outbrain.com",
            "taboola.com",
            "mgid.com",
          ];
          try {
            const reqHost = new URL(url).hostname;
            if (
              AD_DOMAINS.some((d) => reqHost === d || reqHost.endsWith("." + d))
            ) {
              console.log("[WebView] BLOCKED ad →", reqHost);
              return false;
            }
          } catch {
            /* malformed URL — allow */
          }

          // ③ Allow everything else — CDNs, HLS, auth redirects, player scripts.
          return true;
        }}
      />

      {/* ── LOADING INDICATOR (while player initialises) ── */}
      {!playerReady && !playerError && (
        <View style={styles.playerLoadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={COLORS.neonCyan} />
          <Text style={styles.loadingText}>Loading stream…</Text>
        </View>
      )}

      {/* ── STREAM ERROR OVERLAY ─ sits above WebView, fully opaque dark bg ── */}
      {playerError && (
        <View style={styles.errorOverlay}>
          {/* Icon + headline */}
          <Ionicons name="cloud-offline-outline" size={52} color={COLORS.neonPink} />
          <Text style={styles.errorTitle}>Stream Unavailable</Text>
          <Text style={styles.errorSubtitle}>
            {srv.servers.length > 1
              ? 'This server failed. Try switching to another.'
              : 'Could not load the stream. Try retrying or go back.'}
          </Text>

          {/* Server switcher — opens the full picker sheet */}
          {srv.servers.length > 1 && (
            <TouchableOpacity
              style={styles.errorSwitchBtn}
              onPress={() => setShowServerPicker(true)}
            >
              <Ionicons name="swap-horizontal" size={15} color={COLORS.neonCyan} />
              <Text style={styles.errorSwitchBtnText}>
                Switch Server  •  {srv.label}
              </Text>
            </TouchableOpacity>
          )}

          {/* Action buttons */}
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
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={showHud ? "box-none" : "none"}
        >

          {/* Top bar — back, title, episodes. Only rendered when HUD visible */}
          {showHud && (
            <View
              style={[
                styles.topHud,
                {
                  paddingLeft: Math.max(24, insets.left),
                  paddingRight: Math.max(24, insets.right),
                  paddingTop: Math.max(20, insets.top),
                },
              ]}
              pointerEvents="box-none"
            >
              <View style={styles.topHudLeft} pointerEvents="box-none">
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.iconBtn}
                >
                  <Ionicons name="arrow-back" size={22} color={COLORS.text} />
                </TouchableOpacity>
                <View pointerEvents="none">
                  <Text style={styles.animeTitle}>
                    {anime?.title?.toUpperCase()}
                  </Text>
                  <Text style={styles.episodeInfo}>
                    S1:E{episode.episode_number} • {episode.title}
                  </Text>
                </View>
              </View>

              <View style={styles.topHudRight} pointerEvents="box-none">
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

                {/* ── Download button ── */}
                <DownloadButton
                  status={downloader.status}
                  progress={downloader.progress}
                  sniffedUrl={sniffedMediaUrl}
                  isPremium={isPremium}
                  onPress={handleDownloadPress}
                  onCancel={downloader.cancelDownload}
                />

                {/* Server chip — single tap opens the full picker sheet */}
                {srv.servers.length > 0 && (
                  <TouchableOpacity
                    style={styles.serverChip}
                    onPress={() => setShowServerPicker(true)}
                  >
                    <Ionicons name="server-outline" size={11} color={COLORS.neonCyan} />
                    <Text style={styles.serverChipText}>{srv.label}</Text>
                    <Ionicons name="chevron-down" size={10} color={COLORS.textMuted} />
                  </TouchableOpacity>
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
          )}

          {/* Gradients + toast — only while HUD expanded */}

          {showHud && (
            <>
              <LinearGradient
                colors={["rgba(14,14,17,0.85)", "transparent"]}
                style={styles.topGradient}
                pointerEvents="none"
              />
              <LinearGradient
                colors={["transparent", "rgba(14,14,17,0.7)"]}
                style={styles.bottomGradient}
                pointerEvents="none"
              />
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
              {skipToast && (
                <View style={styles.skipToast} pointerEvents="none">
                  <BlurView intensity={40} style={styles.skipToastBlur}>
                    <Ionicons name="play-forward" size={14} color={COLORS.neonCyan} />
                    <Text style={styles.skipToastText}>
                      Auto-skipped {skipLabel}
                    </Text>
                  </BlurView>
                </View>
              )}
            </>
          )}

          {/* Up Next Card — shows near end OR on episode_complete with countdown */}
          {showNextUp && nextEpisode && (
            <View style={styles.nextUpCard}>
              <BlurView intensity={40} style={styles.nextUpBlur}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.nextUpClickableArea}
                  onPress={() => {
                    cancelAutoPlay();
                    router.replace(`/watch/${nextEpisode.id}`);
                  }}
                >
                  <Image
                    source={{ uri: nextEpisode.thumbnail_url || anime?.poster_url }}
                    style={styles.nextUpThumb}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nextUpLabel}>
                      {autoPlayCountdown !== null
                        ? `AUTO-PLAYING IN ${autoPlayCountdown}s`
                        : 'UP NEXT'
                      }
                    </Text>
                    <Text style={styles.nextUpTitle} numberOfLines={1}>
                      Episode {nextEpisode.episode_number}: {nextEpisode.title}
                    </Text>
                  </View>

                  {/* Play now */}
                  <View style={styles.nextUpPlayBtn}>
                    <Ionicons name="play" size={16} color="#000" />
                  </View>
                </TouchableOpacity>

                {/* Cancel (only shown during countdown) */}
                {autoPlayCountdown !== null && (
                  <TouchableOpacity
                    style={styles.nextUpCancelBtn}
                    onPress={cancelAutoPlay}
                  >
                    <Ionicons name="close" size={14} color={COLORS.text} />
                  </TouchableOpacity>
                )}
              </BlurView>
            </View>
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
              { paddingBottom: Math.max(32, insets.bottom + 16) },
            ]}
            tint="dark"
          >
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitle}>EPISODES</Text>
              <TouchableOpacity onPress={() => setShowSelector(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectorList}
              data={streamableEpisodes}
              keyExtractor={episodeKeyExtractor}
              initialScrollIndex={activeIndex >= 0 ? activeIndex : 0}
              // Item width = 180, gap = 16 => 196
              getItemLayout={(data, index) => ({
                length: 196,
                offset: 196 * index,
                index,
              })}
              renderItem={renderEpisodeItem}
            />
          </BlurView>
        </View>
      )}
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

// ─── MEMOIZED EPISODE SELECTOR ITEM ───────────────────────────────────────────
interface EpisodeSelectorItemProps {
  ep: any;
  isActive: boolean;
  posterUrl?: string;
  onPress: (id: string) => void;
}

const EpisodeSelectorItem = React.memo(
  ({ ep, isActive, posterUrl, onPress }: EpisodeSelectorItemProps) => {
    return (
      <TouchableOpacity
        style={[
          styles.selectorItem,
          isActive && styles.activeItem,
        ]}
        onPress={() => onPress(ep.id)}
      >
        <Image
          source={{ uri: ep.thumbnail_url || posterUrl }}
          style={styles.selectorThumb}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.selectorInfo}>
          <Text style={styles.selectorEpNum}>
            EP {ep.episode_number}
          </Text>
          <Text style={styles.selectorEpTitle} numberOfLines={1}>
            {ep.title}
          </Text>
          {ep.duration ? (
            <Text style={styles.selectorEpDur}>
              {Math.round(ep.duration / 60)}m
            </Text>
          ) : null}
        </View>
        {isActive && (
          <View style={styles.nowPlayingBadge}>
            <Text style={styles.nowPlayingText}>NOW PLAYING</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.ep.id === nextProps.ep.id &&
      prevProps.isActive === nextProps.isActive &&
      prevProps.posterUrl === nextProps.posterUrl
    );
  }
);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function formatTime(seconds: number = 0) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    // Ensure the player fills the full display including areas behind the notch.
    // On Android this overrides WindowInsets that would otherwise leave blank bars
    // on the sides in landscape mode.
    ...StyleSheet.absoluteFillObject,
  },
  fullCenter: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: COLORS.textSub,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  errorTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 12,
  },
  errorSubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 32,
  },

  errorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: COLORS.neon,
    borderRadius: 24,
  },
  errorBtnSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: COLORS.neon,
  },
  errorBtnRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBtnText: { color: "#000", fontWeight: "800", fontSize: 13 },

  // Loading overlay sits over WebView while player boots
  playerLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  // ── Error overlay — fully opaque so the white WebView page is hidden ────
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0E0E11",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
  },

  // ── HUD compact server chip ──────────────────────────────────────────────
  serverChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.3)",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  serverChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.neonCyan,
    letterSpacing: 0.5,
  },

  // ── Error overlay "Switch Server" button ─────────────────────────────────
  errorSwitchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,229,255,0.25)",
    backgroundColor: "rgba(0,229,255,0.07)",
    marginTop: 4,
  },
  errorSwitchBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.neonCyan,
  },



  // HUD layer — floats over WebView, box-none so touches pass through to WebView
  hudLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topGradient: { position: "absolute", top: 0, left: 0, right: 0, height: 120 },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },

  topHud: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  topHudLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  topHudRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  animeTitle: {
    color: COLORS.neonCyan,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 2,
  },
  episodeInfo: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  // Mini progress chip in top-right
  progressChip: {
    height: 28,
    minWidth: 110,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  progressChipFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.neon,
    opacity: 0.25,
  },
  progressChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.text,
    zIndex: 1,
  },

  selectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  selectorBtnText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  resumeToast: { position: "absolute", top: 100, alignSelf: "center" },
  resumeToastBlur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    overflow: "hidden",
  },
  resumeToastText: { color: COLORS.text, fontSize: 12, fontWeight: "700" },

  skipToast: { position: "absolute", top: 140, alignSelf: "center" },
  skipToastBlur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    overflow: "hidden",
  },
  skipToastText: { color: COLORS.text, fontSize: 12, fontWeight: "700" },

  nextUpCard: {
    position: "absolute",
    bottom: 28,
    right: 28,
    width: 290,
    borderRadius: 16,
    overflow: "hidden",
  },
  nextUpBlur: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 12,
  },
  nextUpClickableArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nextUpThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.bgElevated,
  },
  nextUpLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: COLORS.neonCyan,
    letterSpacing: 1,
  },
  nextUpTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 2,
  },
  // Play now button (gold circle)
  nextUpPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.neonGold,
    alignItems: "center",
    justifyContent: "center",
  },
  // Cancel countdown (X) button
  nextUpCancelBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -4,
  },

  modalBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  selectorSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 32,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(189,157,255,0.2)",
  },
  selectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    alignItems: "center",
  },
  selectorTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.neon,
    letterSpacing: -1,
    fontStyle: "italic",
  },
  selectorList: { gap: 16, paddingBottom: 20 },
  selectorItem: { width: 180, gap: 12 },
  activeItem: { opacity: 1 },
  selectorThumb: {
    width: "100%",
    height: 100,
    borderRadius: 12,
    backgroundColor: COLORS.bgElevated,
  },
  selectorInfo: { gap: 2 },
  selectorEpNum: {
    fontSize: 8,
    fontWeight: "800",
    color: COLORS.textSub,
    letterSpacing: 1,
  },
  selectorEpTitle: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  selectorEpDur: { fontSize: 10, fontWeight: "500", color: COLORS.textSub },
  nowPlayingBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: COLORS.neon,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nowPlayingText: { fontSize: 7, fontWeight: "900", color: "#000" },
});
