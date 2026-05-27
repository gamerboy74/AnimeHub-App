// Injected JS builders for the WebView video player
// Exposes sniffer, native controls hider, skip intro logic, and state bridge.

/** Part 1: Network sniffer — intercepts fetch/XHR to detect .m3u8 URLs */
export const buildSnifferJS = () => `
  (function() {
    // Cross-frame helper: posts to RN if available, otherwise bubbles up to parent.
    // Ensures sniffer events from cross-origin iframes still reach React Native.
    function _rnPost(obj) {
      try {
        var s = JSON.stringify(obj);
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(s);
        } else {
          window.parent.postMessage(s, '*');
        }
      } catch(e) {}
    }
    var _mediaReported = {};
    function _reportMedia(url) {
      try {
        if (!url || typeof url !== 'string') return;
        if (_mediaReported[url]) return;
        var lc = url.toLowerCase();
        
        // Intercept subtitle files directly (.vtt or .srt)
        if (lc.indexOf('.vtt') !== -1 || lc.indexOf('.srt') !== -1) {
          _mediaReported[url] = true;
          _rnPost({ type: 'SUBTITLE_URL_DETECTED', subtitleUrl: url });
          return;
        }

        if (!lc.includes('.m3u8') && !lc.includes('.mp4') && !lc.includes('.mkv')) return;
        _mediaReported[url] = true;
        _rnPost({
          type: 'MEDIA_URL_DETECTED',
          mediaUrl: url,
          referer: window.location.href,
          origin: window.location.origin,
        });
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
              _rnPost({
                type: 'MEDIA_MANIFEST_READY',
                mediaUrl: actualUrl,
                referer: window.location.href,
                manifestContent: text,
                cookies: document.cookie,
              });
            }).catch(function(e) {});
          }

          // Check if response contains tracks/subtitles
          res.clone().text().then(function(text) {
            if (text && (text.indexOf('"tracks"') !== -1 || text.indexOf('"subtitles"') !== -1)) {
              try {
                var json = JSON.parse(text);
                if (json && json.tracks && Array.isArray(json.tracks)) {
                  _rnPost({ type: 'SUBTITLES_DETECTED', tracks: json.tracks });
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
      var aUrl = url; // Fix 3: use local alias to avoid closure over mutable 'actualUrl'
      this.addEventListener('readystatechange', function() {
        // Fix 3: guard check first — skip binary segments before touching responseText
        if (this.readyState !== 4 || this.status < 200 || this.status >= 300) return;
        try {
          var lcUrl = (aUrl || '').toLowerCase();
          // Skip binary segment types — avoid deserializing large payloads unnecessarily
          if (lcUrl.indexOf('.ts') !== -1 || lcUrl.indexOf('.aac') !== -1 ||
              lcUrl.indexOf('.fmp4') !== -1 ||
              (lcUrl.indexOf('.mp4') !== -1 && lcUrl.indexOf('.m3u8') === -1)) return;
          var text = this.responseText;
          if (lcUrl.indexOf('.m3u8') !== -1) {
            _rnPost({
              type: 'MEDIA_MANIFEST_READY',
              mediaUrl: aUrl,
              referer: window.location.href,
              manifestContent: text,
              cookies: document.cookie,
            });
          }
          if (text && (text.indexOf('"tracks"') !== -1 || text.indexOf('"subtitles"') !== -1)) {
            var json = JSON.parse(text);
            if (json && json.tracks && Array.isArray(json.tracks)) {
              _rnPost({ type: 'SUBTITLES_DETECTED', tracks: json.tracks });
            }
          }
        } catch(e) {}
      });
      _reportMedia(url);
      return _origOpen.apply(this, arguments);
    };
    
    // Periodically scan the DOM for video sources and track/subtitles tags.
    // Self-terminates after 60 s (40 ticks) — by then any src elements the page
    // will inject have already been found; no need to run for the entire session.
    var _domScanTicks = 0;
    var _domScanInterval = setInterval(function() {
      _domScanTicks++;
      try {
        document.querySelectorAll('source[src],video[src],track[src]').forEach(function(el) {
          _reportMedia(el.src || el.getAttribute('src'));
        });
      } catch(e) {}
      if (_domScanTicks >= 40) clearInterval(_domScanInterval);
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
            _rnPost({
              type: 'DOWNLOAD_SEGMENT_CHUNK',
              index: index,
              url: url,
              base64: base64data
            });
          };
          reader.readAsDataURL(blob);
        })
        .catch(function(err) {
          _rnPost({
            type: 'DOWNLOAD_SEGMENT_ERROR',
            index: index,
            url: url,
            error: err ? err.message : 'Unknown WebView segment fetch error'
          });
        });
    };

    window.__rn_fetch_text = function(url, callbackId) {
      fetch(url)
        .then(function(res) {
          if (!res.ok) throw new Error("Status " + res.status);
          return res.text();
        })
        .then(function(text) {
          _rnPost({ type: 'FETCH_TEXT_SUCCESS', callbackId: callbackId, text: text });
        })
        .catch(function(err) {
          _rnPost({ type: 'FETCH_TEXT_ERROR', callbackId: callbackId, error: err ? err.message : 'Fetch text error' });
        });
    };
  })();
`;

/** Part 2: Main player script — polling, resume, skip-intro, HUD tap */
export const buildMainInjectedJS = (resumeSeconds: number, autoSkipIntro: boolean, pollIntervalMs: number = 5000) => `
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

    // ─── RN CONTROL BRIDGE ──────────────────────────────────────────────────
    // These are called by React Native via injectJavaScript().
    // Quality and CC lists are pushed AUTOMATICALLY via JWPlayer events
    // (no request-response round-trip needed).

    function broadcastCommand(payload) {
      var strPayload = JSON.stringify(payload);
      // Fix 5: per-frame catch — accessing cross-origin win.frames[i] throws SecurityError
      // which the outer catch previously swallowed, aborting the rest of the loop.
      function sendToWindow(win) {
        try { win.postMessage(strPayload, '*'); } catch(e) {}
        try {
          for (var i = 0; i < win.frames.length; i++) {
            try { sendToWindow(win.frames[i]); } catch(e) {} // per-frame catch
          }
        } catch(e) {}
      }
      sendToWindow(window);
    }

    // Listener to receive and execute broadcasted commands within each frame
    window.addEventListener('message', function(e) {
      try {
        var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data && data.type === 'rn_command') {
          if (data.command === 'play') {
            try { jwplayer().play(); } catch(err) {}
            try { var v = document.querySelector('video'); if (v) v.play(); } catch(err) {}
          } else if (data.command === 'pause') {
            try { jwplayer().pause(); } catch(err) {}
            try { var v = document.querySelector('video'); if (v) v.pause(); } catch(err) {}
          } else if (data.command === 'seek') {
            resumeApplied_jw = true;
            resumeApplied_vid = true;
            try {
              var p = jwplayer();
              if (p && typeof p.seek === 'function') { p.seek(data.seconds); }
            } catch(err) {}
            try { var v = document.querySelector('video'); if (v) v.currentTime = data.seconds; } catch(err) {}
          } else if (data.command === 'volume') {
            try { jwplayer().setVolume(data.volume * 100); } catch(err) {}
            try { var vid = document.querySelector('video'); if (vid) vid.volume = data.volume; } catch(err) {}
          } else if (data.command === 'setQuality') {
            try { jwplayer().setCurrentQuality(data.index); } catch(err) {}
          } else if (data.command === 'setSubtitle') {
            try { jwplayer().setCurrentCaptions(data.index); } catch(err) {}
          }
        } else if (data && data.type === 'iframe_click') {
          if (window === window.top) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'player_tap' }));
          } else {
            window.parent.postMessage(JSON.stringify({ type: 'iframe_click' }), '*');
          }
        } else if (data && data.type && window === window.top && window.ReactNativeWebView) {
          // Fix 8: relay any message bubbled up from a child frame (e.g. _rnPost from sniffer
          // in cross-origin iframe) — forward to RN as if it came from the top frame.
          window.ReactNativeWebView.postMessage(JSON.stringify(data));
        }
      } catch(err) {}
    });

    window.__rn_play = function() {
      broadcastCommand({ type: 'rn_command', command: 'play' });
    };

    window.__rn_pause = function() {
      broadcastCommand({ type: 'rn_command', command: 'pause' });
    };

    window.__rn_seek = function(seconds) {
      broadcastCommand({ type: 'rn_command', command: 'seek', seconds: seconds });
    };

    window.__rn_volume = function(v) {
      broadcastCommand({ type: 'rn_command', command: 'volume', volume: v });
    };

    // Quality control: setCurrentQuality(idx) where idx comes from the 'levels' list
    window.__rn_setQuality = function(idx) {
      broadcastCommand({ type: 'rn_command', command: 'setQuality', index: idx });
    };

    // Subtitle control: setCurrentCaptions(idx) where 0 = Off, 1+ = tracks
    window.__rn_setSubtitle = function(idx) {
      broadcastCommand({ type: 'rn_command', command: 'setSubtitle', index: idx });
    };

    var attempts          = 0;
    var resumeApplied_jw  = false; // Fix 4: separate flags — JWPlayer and HTML5 share same closure
    var resumeApplied_vid = false; // so one winning first must not block the other path
    var pollInterval      = null;

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

      // ── EVENT-DRIVEN quality levels push ────────────────────────────────────
      // JWPlayer fires 'levels' when the quality list is populated from the
      // manifest. We push immediately to RN — no setTimeout or polling needed.
      function pushQualities() {
        try {
          var q = p.getQualityLevels();
          var cur = p.getCurrentQuality();
          if (q && q.length > 0) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'qualities',
              levels: q,
              current: typeof cur === 'number' ? cur : -1,
            }));
          }
        } catch(e) {}
      }
      try { p.on('levels',        pushQualities); } catch(e) {}
      try { p.on('levelsChanged', function(data) {
        // data.currentQuality = new active index
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'qualityChanged',
          current: data && typeof data.currentQuality !== 'undefined' ? data.currentQuality : -1,
        }));
      }); } catch(e) {}
      // Also push immediately in case levels already loaded before we hooked in
      pushQualities();

      // ── EVENT-DRIVEN captions/CC push ────────────────────────────────────────
      // JWPlayer fires 'captionsList' once the captions list is known.
      function pushCaptions() {
        try {
          var t = p.getCaptionsList();
          // JWPlayer always prepends {id:0, label:'Off'} — skip it if that's
          // the only entry (means no real captions are available).
          if (t && t.length > 1) {
            var curCap = 0;
            try { curCap = p.getCurrentCaptions(); } catch(_e) {}
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'subtitles',
              tracks: t, // full list including 'Off' at index 0
              current: typeof curCap === 'number' ? curCap : 0,
            }));
          }
        } catch(e) {}
      }
      try { p.on('captionsList', pushCaptions); } catch(e) {}
      // Push immediately in case list is already available
      pushCaptions();
      // Sync active CC track index whenever JWPlayer switches captions
      try { p.on('captionsChanged', function(data) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'captionChanged',
          current: data && typeof data.track !== 'undefined' ? data.track : 0,
        }));
      }); } catch(e) {}

      // ── Report JWPlayer subtitles from playlist tracks (VTT via playlist) ────
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

      // ── Instant play/pause state — no polling lag ─────────────────────────
      // JWPlayer fires these events the moment play state changes, so the HUD
      // updates instantly instead of waiting for the next poll tick.
      function pushPlayState(playing) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'playstate', playing: playing
          }));
        } catch(e) {}
      }
      try { p.on('play',    function() { pushPlayState(true);  }); } catch(e) {}
      try { p.on('playing', function() { pushPlayState(true);  }); } catch(e) {}
      try { p.on('pause',   function() { pushPlayState(false); }); } catch(e) {}
      try { p.on('idle',    function() { pushPlayState(false); }); } catch(e) {}
      // Push current state immediately so HUD is correct from the start
      try { pushPlayState(p.getState() === 'playing'); } catch(e) {}

      // ── Immediate progress on first frame — shows progress bar without waiting 5s ──
      // 'firstFrame' fires the instant the first video frame is decoded/displayed.
      // At that point getDuration() is reliable and we can show the scrubber.
      function pushProgress() {
        try {
          var _cur = Math.floor(p.getPosition());
          var _dur = Math.floor(p.getDuration());
          if (_dur > 0) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'progress',
              current: _cur,
              duration: _dur,
              playing: p.getState() === 'playing',
            }));
          }
        } catch(e) {}
      }
      try { p.on('firstFrame', pushProgress); } catch(e) {}
      try { p.on('time', function _onFirstTime(d) {
        // 'time' fires continuously during playback — send once to establish duration,
        // then unsubscribe to avoid flooding the bridge.
        try { p.off('time', _onFirstTime); } catch(_e) {}
        pushProgress();
      }); } catch(e) {}
      // Also push now if duration already populated (e.g. player was paused/resumed)
      pushProgress();

      pollInterval = setInterval(function() {
        try {
          if (!p || typeof p.getPosition !== 'function') return;
          var current  = Math.floor(p.getPosition());
          var duration = Math.floor(p.getDuration());
          var state    = p.getState();

          if (!resumeApplied_jw && duration > 5 && ${resumeSeconds} > 5) {
            resumeApplied_jw = true;
            p.seek(${resumeSeconds});
          }

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type:     'progress',
            current:  current,
            duration: duration,
            playing:  state === 'playing',
          }));
        } catch(e) {}
      }, ${pollIntervalMs});
    }

    // Poll for JWPlayer availability
    var readyCheck = setInterval(function() {
      attempts++;
      try {
        var p = jwplayer();
        if (p && typeof p.getPosition === 'function') {
          clearInterval(readyCheck);
          clearInterval(videoInterval); // Fix 6: JWPlayer won — stop HTML5 fallback poller
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
      clearInterval(readyCheck); // Fix 6: HTML5 won — stop JWPlayer poller

      vid.addEventListener('loadedmetadata', function() {
        if (!resumeApplied_vid && ${resumeSeconds} > 5) {
          resumeApplied_vid = true;
          vid.currentTime = ${resumeSeconds};
        }
        // Immediately report duration so the progress bar appears right away
        if (!isNaN(vid.duration) && vid.duration > 0) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'progress',
            current: Math.floor(vid.currentTime),
            duration: Math.floor(vid.duration),
            playing: !vid.paused,
          }));
        }
      });
      if (!resumeApplied_vid && ${resumeSeconds} > 5 && vid.readyState >= 1) {
        resumeApplied_vid = true;
        vid.currentTime = ${resumeSeconds};
      }

      // ── Episode complete (HTML5 'ended' event) ──────────────────────────────
      vid.addEventListener('ended', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'episode_complete' }));
      });

      // ── Instant play/pause for HTML5 video ───────────────────────────────────
      function pushVidPlayState() {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'playstate', playing: !vid.paused
          }));
        } catch(e) {}
      }
      vid.addEventListener('play',    pushVidPlayState);
      vid.addEventListener('playing', pushVidPlayState);
      vid.addEventListener('pause',   pushVidPlayState);
      vid.addEventListener('waiting', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'playstate', playing: false }));
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
      }, ${pollIntervalMs});
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
        if (${resumeSeconds} > 5 && !resumeApplied_jw && !resumeApplied_vid) return;
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
      // Fix 7: removed MutationObserver for skip detection — the 500ms setInterval
      // below already catches buttons reliably and doesn't add per-mutation overhead.
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
    // Fix 1: only the TOP frame sends player_tap. With injectedJavaScriptForMainFrameOnly=false
    // the listener fires in every iframe — without this guard one tap fires 2-3 messages,
    // causing the HUD to toggle on/off/on in rapid succession.
    document.addEventListener('click', function() {
      try {
        if (window === window.top) {
          // Top frame: notify RN directly
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'player_tap' }));
        } else {
          // Child frame: bubble up to parent which will relay to RN
          window.parent.postMessage(JSON.stringify({ type: 'iframe_click' }), '*');
        }
      } catch(e) {}
    }, true); // capture phase — fires before the player's own handlers

  })();
  true;
`;

/** Part 2b: Hide embedded player native controls + expose RN bridge */
export const buildHideControlsJS = () => `
  (function() {
    var _hStyle = document.createElement('style');
    _hStyle.textContent = [
      // JWPlayer controls
      '.jw-controls, .jw-controlbar, .jw-settings-menu, .jw-nextup-container { display:none !important; }',
      // Vidstream / Megacloud / VideoJS / Plyr
      '.player-controls, .vjs-control-bar, .plyr__controls { display:none !important; }',
      // Generic browser media controls
      'video::-webkit-media-controls { display:none !important; }',
      'video::-webkit-media-controls-enclosure { display:none !important; }',
    ].join('');
    (document.head || document.documentElement).appendChild(_hStyle);

    // Re-apply via MutationObserver — some players re-inject their controls.
    // Fix 2: filter to added element nodes only — the original fired querySelectorAll on the
    // entire document for EVERY DOM mutation (text, attr, style), which runs hundreds of
    // times per second on an active video player.
    var _hideSelectors = ['.jw-controls','.jw-controlbar','.vjs-control-bar','.plyr__controls','.player-controls'];
    new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return; // elements only — skip text/comment nodes
          _hideSelectors.forEach(function(sel) {
            if (node.matches && node.matches(sel)) node.style.setProperty('display','none','important');
            node.querySelectorAll(sel).forEach(function(el) {
              el.style.setProperty('display','none','important');
            });
          });
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true }); // childList only — no attr/characterData noise
  })();
`;

export const buildNativePlayerOnlyJS = () => `
  (function() {
    // Tap → Toggle HUD listener
    // Listen for any click/tap inside the WebView page. The event is NOT
    // cancelled so the player's own controls still fire normally. We just
    // piggyback on it to notify React Native so it can show/hide the HUD.
    // Fix 1: top-frame guard (same as buildMainInjectedJS — prevents N messages per tap)
    document.addEventListener('click', function() {
      try {
        if (window === window.top) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'player_tap' }));
        } else {
          window.parent.postMessage(JSON.stringify({ type: 'iframe_click' }), '*');
        }
      } catch(e) {}
    }, true); // capture phase — fires before the player's own handlers

    window.addEventListener('message', function(e) {
      try {
        var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (data && data.type === 'iframe_click') {
          if (window === window.top) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'player_tap' }));
          } else {
            window.parent.postMessage(JSON.stringify({ type: 'iframe_click' }), '*');
          }
        }
      } catch(err) {}
    });
  })();
  true;
`;

// Compose: sniffer first, then hide controls, then main player script
export const buildCombinedJS = (
  resumeSeconds: number,
  autoSkipIntro: boolean,
  useNativePlayerOnly: boolean,
  pollIntervalMs: number = 5000
) => {
  if (useNativePlayerOnly) {
    return buildSnifferJS() + '\n' + buildNativePlayerOnlyJS();
  }
  return (
    buildSnifferJS() +
    '\n' +
    buildHideControlsJS() +
    '\n' +
    buildMainInjectedJS(resumeSeconds, autoSkipIntro, pollIntervalMs)
  );
};
