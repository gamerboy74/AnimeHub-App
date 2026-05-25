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
import { useLocalSearchParams, router } from "expo-router";
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
        
        // Intercept subtitle files directly (.vtt or .srt)
        if (lc.indexOf('.vtt') !== -1 || lc.indexOf('.srt') !== -1) {
          _mediaReported[url] = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SUBTITLE_URL_DETECTED',
            subtitleUrl: url
          }));
          return;
        }

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
      
      promise.then(function(res) {
        try {
          if (actualUrl && actualUrl.toLowerCase().includes('.m3u8')) {
            res.clone().text().then(function(text) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MEDIA_MANIFEST_READY',
                mediaUrl: actualUrl,
                referer: window.location.href,
                manifestContent: text,
                cookies: document.cookie,
              }));
            }).catch(function(e) {});
          }

          // Check if response contains tracks/subtitles
          res.clone().text().then(function(text) {
            if (text && (text.indexOf('"tracks"') !== -1 || text.indexOf('"subtitles"') !== -1)) {
              try {
                var json = JSON.parse(text);
                if (json && json.tracks && Array.isArray(json.tracks)) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'SUBTITLES_DETECTED',
                    tracks: json.tracks
                  }));
                }
              } catch(err) {}
            }
          }).catch(function(e) {});
        } catch(e) {}
      }).catch(function(e) {});
      
      if (actualUrl) _reportMedia(actualUrl);
      return promise;
    };
    var _origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      var actualUrl = url;
      this.addEventListener('readystatechange', function() {
        if (this.readyState === 4 && this.status >= 200 && this.status < 300) {
          try {
            var text = this.responseText;
            var lcUrl = (actualUrl || '').toLowerCase();
            if (lcUrl.indexOf('.m3u8') !== -1) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'MEDIA_MANIFEST_READY',
                mediaUrl: actualUrl,
                referer: window.location.href,
                manifestContent: text,
                cookies: document.cookie,
              }));
            }
            if (text && (text.indexOf('"tracks"') !== -1 || text.indexOf('"subtitles"') !== -1)) {
              var json = JSON.parse(text);
              if (json && json.tracks && Array.isArray(json.tracks)) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'SUBTITLES_DETECTED',
                  tracks: json.tracks
                }));
              }
            }
          } catch(e) {}
        }
      });
      _reportMedia(url);
      return _origOpen.apply(this, arguments);
    };
    
    // Periodically scan the DOM for video sources and track/subtitles tags
    setInterval(function() {
      try {
        document.querySelectorAll('source[src],video[src],track[src]').forEach(function(el) {
          _reportMedia(el.src || el.getAttribute('src'));
        });
      } catch(e) {}
    }, 1500);

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

    window.__rn_fetch_text = function(url, callbackId) {
      fetch(url)
        .then(function(res) {
          if (!res.ok) throw new Error("Status " + res.status);
          return res.text();
        })
        .then(function(text) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FETCH_TEXT_SUCCESS',
            callbackId: callbackId,
            text: text
          }));
        })
        .catch(function(err) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FETCH_TEXT_ERROR',
            callbackId: callbackId,
            error: err ? err.message : 'Fetch text error'
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

      // ── Report JWPlayer subtitles ONCE when player first becomes ready ──────
      // Do NOT put this inside setInterval — it would fire every 5 s, spamming
      // SUBTITLES_DETECTED messages and triggering pointless re-renders.
      try {
        var playlist = p.getPlaylist();
        if (playlist && playlist[p.getPlaylistIndex()]) {
          var item = playlist[p.getPlaylistIndex()];
          if (item.tracks && Array.isArray(item.tracks) && item.tracks.length > 0) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SUBTITLES_DETECTED',
              tracks: item.tracks
            }));
          }
        }
      } catch(err) {}

      // ── Episode complete (JWPlayer 'complete' event) ────────────────────────
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
  const { id, autoDownload } = useLocalSearchParams();
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
  const [sniffedSubtitles, setSniffedSubtitles] = useState<{ url: string; label: string; lang: string }[]>([]);

  // Live refs so handleDownloadPress always reads the latest sniffed data,
  // even when React state hasn't yet committed between message and button press.
  const sniffedSubtitlesRef = useRef<{ url: string; label: string; lang: string }[]>([]);
  const sniffedManifestCacheRef = useRef<Record<string, string>>({});
  const sniffedMediaUrlRef = useRef<string | null>(null);
  const sniffedRefererRef = useRef<string>('');
  const sniffedCookiesRef = useRef<string>('');

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

  // Toggle HUD visibility on tap. Hides automatically after 4 seconds of inactivity.
  const toggleHud = useCallback(() => {
    setShowHud((prev) => {
      const next = !prev;
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
      if (next) {
        hudTimerRef.current = setTimeout(() => setShowHud(false), 4000);
      }
      return next;
    });
  }, []);

  // Reset and extend HUD visibility timer (shows HUD, then schedules it to hide after 4 seconds)
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
  // Free users are automatically capped to Server 1 inside the hook.
  const srv = useServerSelection(
    (episode as any)?.video_servers,
    episode?.video_url,
    isPremium,
  );

  const embedOrigin = useMemo(() => {
    try { return new URL(srv.embedUrl).origin; } catch { return ''; }
  }, [srv.embedUrl]);

  const isRawVideo = useMemo(() => {
    const url = srv.embedUrl.toLowerCase();
    return url.includes('.m3u8') || url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg');
  }, [srv.embedUrl]);

  const webViewSource = useMemo(() => {
    if (isRawVideo) {
      const url = srv.embedUrl.toLowerCase();
      const isHls = url.includes('.m3u8');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
          ${isHls ? '<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js"></script>' : ''}
          <style>
            body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; user-select: none; -webkit-user-select: none; }
            #player-container { position: relative; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #000; }
            video { width: 100%; height: 100%; object-fit: contain; outline: none; z-index: 1; }
            
            /* Custom glassmorphic HUD controls overlay */
            #controls-overlay {
              position: absolute; top: 0; left: 0; right: 0; bottom: 0;
              background: rgba(0, 0, 0, 0.45);
              display: flex; flex-direction: column; justify-content: space-between;
              transition: opacity 0.3s ease; opacity: 1; z-index: 10;
            }
            #controls-overlay.hidden { opacity: 0; pointer-events: none; }
            
            .spacer-top { height: 60px; }
            
            /* Center skip/play control buttons row */
            .center-row {
              display: flex; align-items: center; justify-content: center; gap: 48px; flex: 1;
            }
            .control-btn {
              background: rgba(255, 255, 255, 0.08); border: 1.5px solid rgba(255, 255, 255, 0.15);
              border-radius: 50%; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center;
              cursor: pointer; transition: transform 0.1s ease, background 0.2s; outline: none;
            }
            .control-btn:active { transform: scale(0.9); background: rgba(255, 255, 255, 0.2); }
            .control-btn svg { width: 24px; height: 24px; fill: #fff; }
            
            .control-btn-play {
              width: 68px; height: 68px; background: rgba(0, 245, 180, 0.12); border-color: rgba(0, 245, 180, 0.4);
            }
            .control-btn-play:active { background: rgba(0, 245, 180, 0.25); }
            .control-btn-play svg { width: 30px; height: 30px; fill: #00F5B4; }

            /* Timeline and Progress bar */
            .bottom-bar {
              padding: 20px 24px; display: flex; align-items: center; gap: 14px;
              background: linear-gradient(to top, rgba(0,0,0,0.85), transparent);
            }
            .time-label { color: #fff; font-size: 11px; font-weight: 700; min-width: 45px; text-align: center; opacity: 0.85; letter-spacing: 0.5px; }
            .progress-track {
              flex: 1; height: 6px; background: rgba(255, 255, 255, 0.2);
              border-radius: 3px; position: relative; cursor: pointer;
            }
            .progress-fill {
              height: 100%; width: 0%; background: #00F5FF; border-radius: 3px; position: relative;
            }
            .progress-fill::after {
              content: ''; position: absolute; right: -5px; top: -3px;
              width: 12px; height: 12px; border-radius: 60px; background: #fff;
              box-shadow: 0 0 8px #00F5FF;
            }

            /* HLS Quality Selector Dropdown styles */
            .quality-btn {
              background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);
              border-radius: 6px; padding: 4px 10px; font-size: 10px; font-weight: 800;
              cursor: pointer; color: #fff; outline: none; margin-left: 8px;
              transition: background 0.2s; display: none;
            }
            .quality-btn:active { background: rgba(255, 255, 255, 0.2); }
            
            #quality-menu {
              position: absolute; bottom: 65px; right: 24px;
              background: rgba(14, 14, 18, 0.95); border: 1px solid rgba(255, 255, 255, 0.12);
              border-radius: 12px; display: none; flex-direction: column;
              overflow: hidden; z-index: 100; min-width: 110px;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6); padding: 4px 0;
            }

            /* Double-tap seek visual ripple feedback */
            .ripple {
              position: absolute; width: 140px; height: 140px; background: rgba(255, 255, 255, 0.12);
              border-radius: 50%; transform: scale(0); animation: ripple-effect 0.5s ease-out;
              pointer-events: none; display: flex; flex-direction: column; align-items: center; justify-content: center;
              color: #fff; font-size: 10px; font-weight: 800; z-index: 5;
            }
            @keyframes ripple-effect {
              to { transform: scale(1.6); opacity: 0; }
            }
          </style>
        </head>
        <body>
          <div id="player-container">
            <video id="video" playsinline></video>
            
            <div id="controls-overlay">
              <div class="spacer-top"></div>
              
              <div class="center-row">
                <!-- 10s Backward -->
                <button class="control-btn" id="btn-back" onclick="window.seekRelative(-10)">
                  <svg viewBox="0 0 24 24"><path d="M12.5 3C17.15 3 21 6.8 21 11.5S17.15 20 12.5 20H12v-2h.5c3.54 0 6.5-2.91 6.5-6.5S16.04 5 12.5 5 6 7.91 6 11.5H9L5 15.5l-4-4h3C4 6.8 7.85 3 12.5 3zm-.47 6.4h-.08l-1.8 1.25.5 1.12 1.03-.7V15h1.27v-5.6zm4.18.99c-.31-.4-.76-.59-1.33-.59s-1.01.19-1.32.59c-.31.39-.46.97-.46 1.73v1.17c0 .76.15 1.34.46 1.73.31.39.76.59 1.02-.19 1.33-.59c.31-.39.47-.97.47-1.73v-1.17c0-.77-.16-1.35-.47-1.74zm-.95 2.87c0 .41-.06.72-.17.91-.12.19-.28.29-.51.29-.22 0-.39-.1-.5-.29-.12-.19-.17-.5-.17-.91v-1.07c0-.41.05-.71.17-.91.12-.19.29-.29.5-.29.23 0 .4.1.51.29.11.19.17.5.17.91v1.07z"/></svg>
                </button>

                <!-- Play / Pause -->
                <button class="control-btn control-btn-play" id="btn-play" onclick="window.togglePlay()">
                  <svg id="play-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>

                <!-- 10s Forward -->
                <button class="control-btn" id="btn-forward" onclick="window.seekRelative(10)">
                  <svg viewBox="0 0 24 24"><path d="M11.5 3C6.85 3 3 6.8 3 11.5S6.85 20 11.5 20h.5v-2h-.5c-3.54 0-6.5-2.91-6.5-6.5S7.96 5 11.5 5 18 7.91 18 11.5H15l4 4 4-4h-3C20 6.8 16.15 3 11.5 3zm.47 6.4h-.08l-1.8 1.25.5 1.12 1.03-.7V15h1.27v-5.6zm4.18.99c-.31-.4-.76-.59-1.33-.59s-1.01.19-1.32.59c-.31.39-.46.97-.46 1.73v1.17c0 .76.15 1.34.46 1.73.31.39.76.59 1.32.59s1.02-.19 1.33-.59c.31-.39.47-.97.47-1.73v-1.17c0-.77-.16-1.35-.47-1.74zm-.95 2.87c0 .41-.06.72-.17.91-.12.19-.28.29-.51.29-.22 0-.39-.1-.5-.29-.12-.19-.17-.5-.17-.91v-1.07c0-.41.05-.71.17-.91.12-.19.29-.29.5-.29.23 0 .4.1.51.29.11.19.17.5.17.91v1.07z"/></svg>
                </button>
              </div>

              <!-- Bottom Progress / Scrubber Bar -->
              <div class="bottom-bar">
                <span class="time-label" id="lbl-current">0:00</span>
                <div class="progress-track" id="track">
                  <div class="progress-fill" id="fill"></div>
                </div>
                <span class="time-label" id="lbl-total">0:00</span>
                <button class="quality-btn" id="btn-quality" onclick="window.toggleQualityMenu(event)">AUTO</button>
              </div>

              <!-- Quality select popup menu -->
              <div id="quality-menu"></div>
            </div>
          </div>

          <script>
            (function() {
              var container = document.getElementById('player-container');
              var video = document.getElementById('video');
              var overlay = document.getElementById('controls-overlay');
              
              var btnPlay = document.getElementById('btn-play');
              var playIcon = document.getElementById('play-icon');
              var btnBack = document.getElementById('btn-back');
              var btnForward = document.getElementById('btn-forward');
              
              var lblCurrent = document.getElementById('lbl-current');
              var lblTotal = document.getElementById('lbl-total');
              var track = document.getElementById('track');
              var fill = document.getElementById('fill');
              
              var btnQuality = document.getElementById('btn-quality');
              var menuQuality = document.getElementById('quality-menu');
              
              var videoSrc = '${srv.embedUrl}';
              var hideTimeout = null;
              var lastTap = 0;

              // Helper: format seconds to M:SS
              function formatTime(secs) {
                if (isNaN(secs)) return '0:00';
                var m = Math.floor(secs / 60);
                var s = Math.floor(secs % 60);
                return m + ':' + (s < 10 ? '0' : '') + s;
              }

              // Toggle HUD overlays visibility
              function showControls() {
                overlay.classList.remove('hidden');
                resetHideTimer();
                // Send explicit controls_shown message to react-native
                try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'player_controls_shown' })); } catch(e) {}
              }

              function hideControls() {
                if (!video.paused && menuQuality.style.display !== 'flex') {
                  overlay.classList.add('hidden');
                  // Send explicit controls_hidden message to react-native
                  try { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'player_controls_hidden' })); } catch(e) {}
                }
              }

              function resetHideTimer() {
                if (hideTimeout) clearTimeout(hideTimeout);
                hideTimeout = setTimeout(hideControls, 3000);
              }

              // Tap anywhere on the container (except control elements) to toggle overlays
              container.addEventListener('click', function(e) {
                if (e.target.closest('.control-btn') || e.target.closest('#track') || e.target.closest('#btn-quality') || e.target.closest('#quality-menu')) return;
                
                // Double tap check for Youtube-style seek
                var now = Date.now();
                var tapGap = now - lastTap;
                lastTap = now;
                
                if (tapGap < 300 && tapGap > 0) {
                  // Double tapped! Seek depending on screen half clicked
                  var rect = container.getBoundingClientRect();
                  var clickX = e.clientX - rect.left;
                  var midX = rect.width / 2;
                  
                  if (clickX < midX) {
                    window.seekRelative(-10);
                    showDoubleTapRipple(e.clientX, e.clientY, '-10s');
                  } else {
                    window.seekRelative(10);
                    showDoubleTapRipple(e.clientX, e.clientY, '+10s');
                  }
                  return;
                }

                // Single tap: toggle controls
                if (overlay.classList.contains('hidden')) {
                  showControls();
                } else {
                  hideControls();
                }
              });

              // Create dynamic wave ripple overlay on double-tap
              function showDoubleTapRipple(x, y, text) {
                var ripple = document.createElement('div');
                ripple.className = 'ripple';
                ripple.style.left = (x - 70) + 'px';
                ripple.style.top = (y - 70) + 'px';
                ripple.innerHTML = '<span style="font-size:18px;margin-bottom:4px;">' + (text.includes('-') ? '◀◀' : '▶▶') + '</span>' + text;
                container.appendChild(ripple);
                setTimeout(function() { ripple.remove(); }, 500);
              }

              window.seekRelative = function(secs) {
                if (isNaN(video.duration)) return;
                video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + secs));
                showControls();
              };

              // Play / Pause logic
              window.togglePlay = function() {
                if (video.paused) {
                  video.play().catch(function(e) {});
                } else {
                  video.pause();
                }
                showControls();
              };

              // Bind quality selector toggling
              window.toggleQualityMenu = function(e) {
                if (e) e.stopPropagation();
                if (menuQuality.style.display === 'none' || menuQuality.style.display === '') {
                  menuQuality.style.display = 'flex';
                  if (hideTimeout) clearTimeout(hideTimeout); // prevent hiding overlay while menu is open
                } else {
                  menuQuality.style.display = 'none';
                  resetHideTimer();
                }
              };

              document.addEventListener('click', function() {
                menuQuality.style.display = 'none';
              });

              // Play state listener
              function onPlayStateChange() {
                if (video.paused) {
                  playIcon.innerHTML = '<svg viewBox="0 0 24 24" style="width:30px;height:30px;fill:#00F5B4;"><path d="M8 5v14l11-7z"/></svg>';
                  showControls();
                } else {
                  playIcon.innerHTML = '<svg viewBox="0 0 24 24" style="width:30px;height:30px;fill:#00F5B4;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
                  resetHideTimer();
                }
              }

              video.addEventListener('play', onPlayStateChange);
              video.addEventListener('playing', onPlayStateChange);
              video.addEventListener('pause', onPlayStateChange);

              // Progress bar updates
              video.addEventListener('timeupdate', function() {
                if (isNaN(video.duration)) return;
                var pct = (video.currentTime / video.duration) * 100;
                fill.style.width = pct + '%';
                lblCurrent.innerText = formatTime(video.currentTime);
                lblTotal.innerText = formatTime(video.duration);
              });

              video.addEventListener('loadedmetadata', function() {
                lblTotal.innerText = formatTime(video.duration);
                onPlayStateChange();
              });

              // Interactive Scrubber seeking
              track.addEventListener('click', function(e) {
                if (isNaN(video.duration)) return;
                var rect = track.getBoundingClientRect();
                var clickX = e.clientX - rect.left;
                var pct = clickX / rect.width;
                video.currentTime = pct * video.duration;
                showControls();
              });

              // Robust Hls initialization and polling
              function initPlayer() {
                if (${isHls}) {
                  if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                    var hls = new Hls();
                    hls.loadSource(videoSrc);
                    hls.attachMedia(video);
                    
                    hls.on(Hls.Events.MANIFEST_PARSED, function() {
                      video.play().catch(function(e) {});
                      
                      // Populating Quality Select levels
                      var levels = hls.levels;
                      menuQuality.innerHTML = '';
                      
                      function createQualityOption(label, idx) {
                        var btn = document.createElement('button');
                        btn.innerText = label;
                        btn.style.cssText = 'background:transparent; border:none; color:#fff; padding:10px 14px; font-size:11px; font-weight:700; text-align:left; width:100%; cursor:pointer; outline:none; transition:background 0.15s; border-bottom:1px solid rgba(255,255,255,0.06);';
                        btn.addEventListener('mouseenter', function() { btn.style.background = 'rgba(255,255,255,0.08)'; });
                        btn.addEventListener('mouseleave', function() { btn.style.background = 'transparent'; });
                        btn.addEventListener('click', function(e) {
                          e.stopPropagation();
                          hls.currentLevel = idx;
                          btnQuality.innerText = label;
                          menuQuality.style.display = 'none';
                          resetHideTimer();
                        });
                        menuQuality.appendChild(btn);
                      }

                      createQualityOption('AUTO', -1);
                      levels.forEach(function(level, idx) {
                        var label = level.height ? level.height + 'P' : 'LEVEL ' + idx;
                        createQualityOption(label, idx);
                      });

                      btnQuality.style.display = 'inline-block';
                    });
                  } else {
                    // Try waiting for Hls script to load (polling up to 30 times = 15 seconds)
                    var checks = 0;
                    var interval = setInterval(function() {
                      checks++;
                      if (typeof Hls !== 'undefined' && Hls.isSupported()) {
                        clearInterval(interval);
                        initPlayer();
                      } else if (checks > 30) {
                        clearInterval(interval);
                        loadNative();
                      }
                    }, 500);
                  }
                } else {
                  loadNative();
                }
              }

              function loadNative() {
                video.src = videoSrc;
                video.addEventListener('loadedmetadata', function() {
                  video.play().catch(function(e) {});
                });
              }

              initPlayer();

              // Initial load state check
              showControls();
              onPlayStateChange();
            })();
          </script>
        </body>
        </html>
      `;
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
          toggleHud();
        } else if (msg.type === "player_controls_shown") {
          setShowHud(true);
          if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
          hudTimerRef.current = setTimeout(() => setShowHud(false), 4000);
        } else if (msg.type === "player_controls_hidden") {
          setShowHud(false);
          if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
        }

        // ── Network sniffer result ─────────────────────────────────────────
        if (msg.type === 'MEDIA_URL_DETECTED') {
          const { mediaUrl, referer } = msg;
          if (mediaUrl && mediaUrl.toLowerCase().includes('.m3u8')) {
            if (!sniffedMediaUrlRef.current || sniffedMediaUrlRef.current === episode?.video_url) {
              console.log('[Download] Sniffed .m3u8:', mediaUrl);
              sniffedMediaUrlRef.current = mediaUrl;
              sniffedRefererRef.current = referer || '';
              setSniffedMediaUrl(mediaUrl);
              setSniffedReferer(referer || '');
            }
          }
        }

        if (msg.type === 'SUBTITLE_URL_DETECTED') {
          const { subtitleUrl } = msg;
          if (subtitleUrl) {
            const lcUrl = subtitleUrl.toLowerCase();
            const isEnglish = lcUrl.includes('eng') || lcUrl.includes('english') || lcUrl.includes('/en/') || lcUrl.includes('_en.');
            if (isEnglish) {
              setSniffedSubtitles(prev => {
                if (prev.some(s => s.url === subtitleUrl)) return prev;
                console.log('[Download] Sniffed individual English subtitle URL:', subtitleUrl);
                const next = [...prev, { url: subtitleUrl, label: 'English', lang: 'eng' }];
                sniffedSubtitlesRef.current = next;
                return next;
              });
            }
          }
        }

        if (msg.type === 'SUBTITLES_DETECTED') {
          const { tracks } = msg;
          if (Array.isArray(tracks)) {
            const vttTracks = tracks
              .filter((t: any) => {
                const fileUrl = t.file || t.src;
                if (!fileUrl) return false;
                const label = (t.label || '').toLowerCase();
                const lcUrl = fileUrl.toLowerCase();
                const isEnglish = label.includes('eng') || label.includes('english') || lcUrl.includes('eng') || lcUrl.includes('english') || lcUrl.includes('/en/') || lcUrl.includes('_en.');
                if (!isEnglish) return false;
                const kind = t.kind || '';
                return kind === 'captions' || kind === 'subtitles' || lcUrl.includes('.vtt');
              })
              .map((t: any) => ({
                url: t.file || t.src,
                label: t.label || 'English',
                lang: 'eng',
              }));
            if (vttTracks.length > 0) {
              // Deduplicate: skip state update if URLs are identical to avoid re-renders
              const existingUrls = sniffedSubtitlesRef.current.map(s => s.url).join(',');
              const newUrls = vttTracks.map((s: any) => s.url).join(',');
              if (existingUrls !== newUrls) {
                console.log('[Download] Sniffed English subtitles:', vttTracks.length, 'tracks');
                sniffedSubtitlesRef.current = vttTracks;
                setSniffedSubtitles(vttTracks);
              }
            }
          }
        }

        if (msg.type === 'MEDIA_MANIFEST_READY') {
          const { mediaUrl, referer, manifestContent, cookies } = msg;
          if (mediaUrl && manifestContent) {
            console.log('[Download] Captured manifest for:', mediaUrl);
            sniffedManifestCacheRef.current = { ...sniffedManifestCacheRef.current, [mediaUrl]: manifestContent };
            setSniffedManifestCache(prev => ({ ...prev, [mediaUrl]: manifestContent }));
            if (cookies) {
              sniffedCookiesRef.current = cookies;
              setSniffedCookies(cookies);
            }
            if (!sniffedMediaUrlRef.current || sniffedMediaUrlRef.current === episode?.video_url) {
              sniffedMediaUrlRef.current = mediaUrl;
              sniffedRefererRef.current = referer || '';
              setSniffedMediaUrl(mediaUrl);
              setSniffedReferer(referer || '');
            }
          }
        }

        if (msg.type === 'DOWNLOAD_SEGMENT_CHUNK' || msg.type === 'DOWNLOAD_SEGMENT_ERROR' || msg.type === 'FETCH_TEXT_SUCCESS' || msg.type === 'FETCH_TEXT_ERROR') {
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
  // Reads directly from refs so it always gets the latest sniffed data,
  // immune to React state batching / closure timing races.
  const handleDownloadPress = useCallback(() => {
    const mediaUrl  = sniffedMediaUrlRef.current;
    const referer   = sniffedRefererRef.current;
    const cookies   = sniffedCookiesRef.current;
    const cache     = sniffedManifestCacheRef.current;
    const subtitles = sniffedSubtitlesRef.current;
    if (!mediaUrl || !episode) return;
    console.log('[Download] Starting — subtitles available:', subtitles.length);
    downloader.startDownload(
      mediaUrl,
      referer || embedOrigin,
      {
        episodeId: episode.id,
        title: `Ep ${episode.episode_number}: ${episode.title ?? ''}`,
        animeName: anime?.title ?? 'Unknown',
        thumbnailUrl: episode.thumbnail_url ?? anime?.poster_url ?? '',
      },
      undefined,
      cookies,
      cache,
      (js: string) => {
        webviewRef.current?.injectJavaScript(js);
      },
      subtitles
    );
  }, [embedOrigin, episode, anime, downloader]);

  // ── Auto-start download if autoDownload=true parameter is present ─────────
  useEffect(() => {
    if (autoDownload === 'true' && sniffedMediaUrl && episode && playerReady && downloader.status === 'idle') {
      handleDownloadPress();
    }
  }, [autoDownload, sniffedMediaUrl, episode, playerReady, downloader.status, handleDownloadPress]);

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
    setSniffedMediaUrl(null);
    setSniffedReferer('');
    setSniffedManifestCache({});
    setSniffedCookies('');
    setSniffedSubtitles([]);
    sniffedMediaUrlRef.current = null;
    sniffedRefererRef.current = '';
    sniffedManifestCacheRef.current = {};
    sniffedCookiesRef.current = '';
    sniffedSubtitlesRef.current = [];
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

  // Pre-populate sniffedMediaUrl with the direct video_url if available
  useEffect(() => {
    if (episode?.video_url && episode.video_url.toLowerCase().includes('.m3u8')) {
      setSniffedMediaUrl(prev => prev || episode.video_url || null);
    }
  }, [episode]);

  // Reset sniffed states when server changes
  useEffect(() => {
    setSniffedMediaUrl(null);
    setSniffedReferer('');
    setSniffedManifestCache({});
    setSniffedCookies('');
    setSniffedSubtitles([]);
    downloader.cancelDownload();
  }, [srv.embedUrl]);

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
        source={webViewSource}
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

          {/* Server switcher — opens picker (premium) or upgrade prompt (free) */}
          {(srv.servers.length > 1 || srv.isServerLocked) && (
            <TouchableOpacity
              style={styles.errorSwitchBtn}
              onPress={() =>
                srv.isServerLocked
                  ? router.push('/plans')
                  : setShowServerPicker(true)
              }
            >
              <Ionicons
                name={srv.isServerLocked ? 'lock-closed' : 'swap-horizontal'}
                size={15}
                color={COLORS.neonCyan}
              />
              <Text style={styles.errorSwitchBtnText}>
                {srv.isServerLocked
                  ? 'Unlock More Servers  •  Go Premium'
                  : `Switch Server  \u2022  ${srv.label}`}
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
                <View style={{ flex: 1 }} pointerEvents="none">
                  <Text style={styles.animeTitle} numberOfLines={1}>
                    {anime?.title?.toUpperCase()}
                  </Text>
                  <Text style={styles.episodeInfo} numberOfLines={1}>
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

                {/* Server chip — single tap opens picker (premium) or upgrade prompt (free) */}
                {srv.servers.length > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.serverChip,
                      srv.isServerLocked && styles.serverChipLocked,
                    ]}
                    onPress={() =>
                      srv.isServerLocked
                        ? router.push('/plans')
                        : setShowServerPicker(true)
                    }
                  >
                    <Ionicons
                      name={srv.isServerLocked ? 'lock-closed' : 'server-outline'}
                      size={11}
                      color={srv.isServerLocked ? COLORS.neonPink : COLORS.neonCyan}
                    />
                    <Text
                      style={[
                        styles.serverChipText,
                        srv.isServerLocked && { color: COLORS.neonPink },
                      ]}
                    >
                      {srv.label}
                    </Text>
                    {srv.isServerLocked ? (
                      <Text style={styles.serverChipLockLabel}>PRO</Text>
                    ) : (
                      <Ionicons name="chevron-down" size={10} color={COLORS.textMuted} />
                    )}
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
  /** Locked variant — pink border when free user has additional servers */
  serverChipLocked: {
    borderColor: "rgba(255,56,100,0.4)",
    backgroundColor: "rgba(255,56,100,0.08)",
  },
  serverChipText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.neonCyan,
    letterSpacing: 0.5,
  },
  serverChipLockLabel: {
    fontSize: 8,
    fontWeight: "900",
    color: COLORS.neonPink,
    letterSpacing: 1,
    backgroundColor: "rgba(255,56,100,0.2)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
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
  topHudLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14, marginRight: 16 },
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
