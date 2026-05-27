/**
 * Generates the full HTML/CSS/JS template for the custom raw video and HLS player overlay.
 * Played inside the WebView container to bypass embedded ads and display styled UI overlays.
 *
 * @param embedUrl The raw video/manifest URL to stream.
 * @param isHls Whether the source is HLS (.m3u8).
 */
export function buildRawPlayerHTML(embedUrl: string, isHls: boolean): string {
  return `
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
          
          var videoSrc = '${embedUrl}';
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
}
