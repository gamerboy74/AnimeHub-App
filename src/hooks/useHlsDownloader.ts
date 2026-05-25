import { useState, useRef, useCallback, useEffect } from 'react';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DownloadStatus =
  | 'idle'
  | 'sniffing'     // WebView has not yet detected the .m3u8 URL
  | 'preparing'    // Fetching & parsing manifests
  | 'downloading'  // Downloading .ts segments
  | 'done'         // All done — local file ready
  | 'error';

export interface DownloadedEpisode {
  episodeId: string;
  title: string;
  animeName: string;
  thumbnailUrl: string;
  localManifestUri: string;  // file:// path to local .m3u8
  downloadedAt: number;      // timestamp ms
  totalSegments: number;
  sizeBytes: number;         // approx total size
}

export interface HlsDownloaderResult {
  status: DownloadStatus;
  progress: number;           // 0.0 – 1.0
  error: string | null;
  downloadedEpisode: DownloadedEpisode | null;
  /** Call this when WebView sniffs a .m3u8 URL */
  startDownload: (
    m3u8Url: string,
    referer: string,
    episodeMeta: { episodeId: string; title: string; animeName: string; thumbnailUrl: string },
    manifestContent?: string,
    cookies?: string,
    manifestCache?: Record<string, string>,
    injectJS?: (js: string) => void,
    subtitles?: { url: string; label: string; lang: string }[],
  ) => void;
  cancelDownload: () => void;
  handleDownloadMessage: (msg: any) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DOWNLOADS_STORAGE_KEY = 'animehub:downloads';
const DOWNLOADS_DIR = `${FileSystem.documentDirectory}animehub_downloads/`;

// Concurrent segment downloads (keep low to avoid memory pressure)
const CONCURRENCY = 3;

// User-Agent to pass when fetching manifests / segments
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve a relative URL against a base URL */
function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
  try {
    return new URL(relative, base).href;
  } catch {
    const baseDir = base.substring(0, base.lastIndexOf('/') + 1);
    return baseDir + relative;
  }
}

/** Sanitize a string for use as a filesystem directory name */
function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 40);
}

/**
 * Fetch a text resource with streaming-friendly headers.
 * Returns null on failure.
 */
async function fetchText(url: string, referer: string, cookies?: string): Promise<string | null> {
  console.log(`[HLS fetchText] Fetching: ${url}`);
  try {
    const headers: Record<string, string> = {
      'User-Agent': UA,
    };
    if (referer) {
      headers['Referer'] = referer;
      try {
        headers['Origin'] = new URL(referer).origin;
      } catch {}
    }
    if (cookies) {
      headers['Cookie'] = cookies;
    }
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`[HLS fetchText] Failed with status ${res.status}: ${res.statusText}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.error(`[HLS fetchText] Network/fetch error for ${url}:`, err);
    return null;
  }
}

interface SegmentInfo {
  url: string;
  localFilename: string;
}

/**
 * Parse an HLS media playlist and return all segment URLs.
 * If the URL points to a master playlist, picks the highest-bandwidth variant.
 */
async function resolveMediaPlaylist(
  manifestUrl: string,
  referer: string,
  manifestCache?: Record<string, string>,
  cookies?: string,
  fetchTextFn?: (url: string) => Promise<string | null>,
): Promise<{ mediaUrl: string; segments: SegmentInfo[]; manifestText: string } | null> {
  let text = manifestCache ? manifestCache[manifestUrl] : null;
  if (!text) {
    if (fetchTextFn) {
      text = await fetchTextFn(manifestUrl);
    } else {
      text = await fetchText(manifestUrl, referer, cookies);
    }
  }
  if (!text) return null;

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // ── Master playlist: find best variant ────────────────────────────────────
  if (lines.some((l) => l.includes('#EXT-X-STREAM-INF'))) {
    let bestBandwidth = -1;
    let bestVariantUrl = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        const bwMatch = line.match(/BANDWIDTH=(\d+)/);
        const bw = bwMatch ? parseInt(bwMatch[1], 10) : 0;
        const variantLine = lines[i + 1];
        if (variantLine && !variantLine.startsWith('#')) {
          if (bw > bestBandwidth) {
            bestBandwidth = bw;
            bestVariantUrl = resolveUrl(manifestUrl, variantLine);
          }
          i++; // skip the URL line we just consumed
        }
      }
    }

    if (!bestVariantUrl) return null;
    // Recursively parse the chosen media playlist
    return resolveMediaPlaylist(bestVariantUrl, referer, manifestCache, cookies, fetchTextFn);
  }

  // ── Media playlist: collect segments ─────────────────────────────────────
  const segments: SegmentInfo[] = [];
  let segIdx = 0;
  for (const line of lines) {
    if (!line.startsWith('#')) {
      const url = resolveUrl(manifestUrl, line);
      const ext = url.includes('.ts') ? '.ts' : url.includes('.aac') ? '.aac' : '.seg';
      segments.push({ url, localFilename: `seg_${String(segIdx).padStart(5, '0')}${ext}` });
      segIdx++;
    }
  }

  return { mediaUrl: manifestUrl, segments, manifestText: text };
}

/**
 * Build a local .m3u8 file by rewriting the original manifest's segment URLs.
 * This preserves all original metadata like exact segment durations and
 * discontinuities, preventing native players (ExoPlayer) from stalling.
 */
function buildLocalManifest(originalManifest: string, segments: SegmentInfo[], folderUri: string): string {
  const lines = originalManifest.split('\n');
  let segmentIdx = 0;
  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('#')) {
      return trimmed;
    }
    const seg = segments[segmentIdx];
    if (seg) {
      segmentIdx++;
      return `${folderUri}${seg.localFilename}`;
    }
    return trimmed;
  });
  return newLines.join('\n');
}

/**
 * Preprocess downloaded WebVTT subtitles to inject a custom style block
 * (giving them a grayish background) and position settings to push them up.
 */
function processVttContent(content: string): string {
  let processed = content.trim();
  if (!processed.startsWith('WEBVTT')) {
    processed = 'WEBVTT\n' + processed;
  }

  // Inject STYLE block for gray background
  if (processed.indexOf('STYLE') === -1) {
    const styleBlock = [
      'STYLE',
      '::cue {',
      '  background-color: rgba(40, 40, 40, 0.65) !important;',
      '  color: #ffffff !important;',
      '}',
      ''
    ].join('\n');
    
    const lines = processed.split('\n');
    let insertIdx = 1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === 'WEBVTT') {
        insertIdx = i + 1;
        break;
      }
    }
    lines.splice(insertIdx, 0, styleBlock);
    processed = lines.join('\n');
  }

  // Adjust cue vertical line position to push subtitles a little up (e.g. line:82%)
  const lines = processed.split('\n');
  const timestampRegex = /^(\d{2}:\d{2}:\d{2}[.,]\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}[.,]\d{3})(.*)$/;
  const timestampShortRegex = /^(\d{2}:\d{2}[.,]\d{3}\s+-->\s+\d{2}:\d{2}[.,]\d{3})(.*)$/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match = line.match(timestampRegex);
    if (!match) {
      match = line.match(timestampShortRegex);
    }
    
    if (match) {
      const baseTimestamp = match[1];
      const existingSettings = match[2].trim();
      
      // Strip any pre-existing line setting and enforce line:82%
      let newSettings = existingSettings.replace(/line:\S+/g, '').trim();
      newSettings = (newSettings + ' line:82%').trim();
      
      lines[i] = `${baseTimestamp} ${newSettings}`;
    }
  }

  return lines.join('\n');
}

/** Run an async function over an array with bounded concurrency */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
  onProgress: (done: number) => void,
): Promise<void> {
  let done = 0;
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i], i);
      done++;
      onProgress(done);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
}

// ─── Persistent Storage Helpers ───────────────────────────────────────────────

async function loadSavedDownloads(): Promise<DownloadedEpisode[]> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveDownloads(list: DownloadedEpisode[]): Promise<void> {
  await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(list));
}

export async function getAllDownloads(): Promise<DownloadedEpisode[]> {
  return loadSavedDownloads();
}

export async function deleteDownload(episodeId: string): Promise<void> {
  const list = await loadSavedDownloads();
  const ep = list.find((d) => d.episodeId === episodeId);
  if (ep) {
    // Remove the folder
    const folderUri = ep.localManifestUri.substring(0, ep.localManifestUri.lastIndexOf('/') + 1);
    try { await FileSystem.deleteAsync(folderUri, { idempotent: true }); } catch {}
  }
  const updated = list.filter((d) => d.episodeId !== episodeId);
  await saveDownloads(updated);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useHlsDownloader(): HlsDownloaderResult {
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadedEpisode, setDownloadedEpisode] = useState<DownloadedEpisode | null>(null);
  const cancelledRef = useRef(false);

  const pendingSegmentsRef = useRef<Record<number, {
    resolve: () => void;
    reject: (err: string) => void;
    writeChunk: (base64: string) => Promise<void>;
  }>>({});
  const pendingTextFetchesRef = useRef<Record<string, {
    resolve: (text: string) => void;
    reject: (err: string) => void;
  }>>({});
  const injectJSRef = useRef<((js: string) => void) | null>(null);

  const fetchTextViaWebView = useCallback((url: string) => {
    if (!injectJSRef.current) return Promise.resolve(null);

    return new Promise<string | null>((resolve, reject) => {
      const callbackId = Math.random().toString(36).substring(2, 11);
      pendingTextFetchesRef.current[callbackId] = {
        resolve,
        reject: (err) => {
          console.warn(`[HLS fetchText WebView] Error for ${url}:`, err);
          resolve(null); // fallback
        }
      };

      const js = `
        try {
          if (typeof window.__rn_fetch_text === 'function') {
            window.__rn_fetch_text(${JSON.stringify(url)}, ${JSON.stringify(callbackId)});
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'FETCH_TEXT_ERROR',
              callbackId: ${JSON.stringify(callbackId)},
              error: 'window.__rn_fetch_text is not defined'
            }));
          }
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FETCH_TEXT_ERROR',
            callbackId: ${JSON.stringify(callbackId)},
            error: e.message
          }));
        }
        true;
      `;
      injectJSRef.current!(js);
    });
  }, []);

  const cancelDownload = useCallback(() => {
    cancelledRef.current = true;
    setStatus('idle');
    setProgress(0);
    setError(null);
    // Reject all pending segment downloads
    Object.keys(pendingSegmentsRef.current).forEach((key) => {
      const idx = parseInt(key, 10);
      pendingSegmentsRef.current[idx]?.reject('Download cancelled');
    });
    pendingSegmentsRef.current = {};
    // Reject all pending text fetches
    Object.keys(pendingTextFetchesRef.current).forEach((key) => {
      pendingTextFetchesRef.current[key]?.reject('Download cancelled');
    });
    pendingTextFetchesRef.current = {};
    injectJSRef.current = null;
  }, []);

  const handleDownloadMessage = useCallback((msg: any) => {
    if (msg.type === 'DOWNLOAD_SEGMENT_CHUNK') {
      const { index, base64 } = msg;
      const pending = pendingSegmentsRef.current[index];
      if (pending) {
        delete pendingSegmentsRef.current[index];
        pending.writeChunk(base64)
          .then(() => pending.resolve())
          .catch((err) => pending.reject(err?.message ?? 'Write failed'));
      }
    } else if (msg.type === 'DOWNLOAD_SEGMENT_ERROR') {
      const { index, error: errStr } = msg;
      const pending = pendingSegmentsRef.current[index];
      if (pending) {
        delete pendingSegmentsRef.current[index];
        pending.reject(errStr || 'Failed to download segment via WebView');
      }
    } else if (msg.type === 'FETCH_TEXT_SUCCESS') {
      const { callbackId, text } = msg;
      const pending = pendingTextFetchesRef.current[callbackId];
      if (pending) {
        delete pendingTextFetchesRef.current[callbackId];
        pending.resolve(text);
      }
    } else if (msg.type === 'FETCH_TEXT_ERROR') {
      const { callbackId, error: errStr } = msg;
      const pending = pendingTextFetchesRef.current[callbackId];
      if (pending) {
        delete pendingTextFetchesRef.current[callbackId];
        pending.reject(errStr || 'Failed to fetch text via WebView');
      }
    }
  }, []);

  const startDownload = useCallback(
    async (
      m3u8Url: string,
      referer: string,
      meta: { episodeId: string; title: string; animeName: string; thumbnailUrl: string },
      manifestContent?: string,
      cookies?: string,
      manifestCache?: Record<string, string>,
      injectJS?: (js: string) => void,
      subtitles?: { url: string; label: string; lang: string }[],
    ) => {
      cancelledRef.current = false;
      setStatus('preparing');
      setProgress(0);
      setError(null);
      setDownloadedEpisode(null);
      injectJSRef.current = injectJS ?? null;
      pendingSegmentsRef.current = {};

      try {
        // ── 1. Resolve & parse manifest ──────────────────────────────────────
        // If manifestContent is provided for the root URL, pre-populate manifestCache
        const cache = { ...manifestCache };
        if (manifestContent) {
          cache[m3u8Url] = manifestContent;
        }

        const resolved = await resolveMediaPlaylist(
          m3u8Url,
          referer,
          cache,
          cookies,
          injectJSRef.current ? fetchTextViaWebView : undefined
        );
        if (!resolved || resolved.segments.length === 0) {
          throw new Error('Could not parse HLS manifest or no segments found.');
        }
        if (cancelledRef.current) return;

        const { segments, manifestText } = resolved;

        // ── 2. Prepare local directory ───────────────────────────────────────
        const folderName = `${safeName(meta.animeName)}_ep${safeName(meta.title)}`;
        const folderUri = `${DOWNLOADS_DIR}${folderName}/`;
        await FileSystem.makeDirectoryAsync(folderUri, { intermediates: true });

        // ── 3. Download segments ─────────────────────────────────────────────
        setStatus('downloading');
        let totalBytes = 0;

        await runWithConcurrency(
          segments,
          CONCURRENCY,
          async (seg, i) => {
            if (cancelledRef.current) return;
            const destUri = `${folderUri}${seg.localFilename}`;

            // Skip if already downloaded (resume support)
            const info = await FileSystem.getInfoAsync(destUri);
            if (info.exists) {
              if ('size' in info) totalBytes += (info as any).size ?? 0;
              return;
            }

            if (injectJSRef.current) {
              // Download via WebView to bypass JA3 TLS Fingerprinting / Bot Protection
              let resolvePromise: () => void;
              let rejectPromise: (err: any) => void;
              const promise = new Promise<void>((res, rej) => {
                resolvePromise = res;
                rejectPromise = rej;
              });

              pendingSegmentsRef.current[i] = {
                resolve: resolvePromise!,
                reject: rejectPromise!,
                writeChunk: async (base64: string) => {
                  await FileSystem.writeAsStringAsync(destUri, base64, {
                    encoding: FileSystem.EncodingType.Base64,
                  });
                }
              };

              const js = `
                try {
                  if (typeof window.__rn_download_segment === 'function') {
                    window.__rn_download_segment(${JSON.stringify(seg.url)}, ${i});
                  } else {
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'DOWNLOAD_SEGMENT_ERROR',
                      index: ${i},
                      url: ${JSON.stringify(seg.url)},
                      error: 'window.__rn_download_segment is not defined'
                    }));
                  }
                } catch (e) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'DOWNLOAD_SEGMENT_ERROR',
                    index: ${i},
                    url: ${JSON.stringify(seg.url)},
                    error: e.message
                  }));
                }
                true;
              `;
              injectJSRef.current(js);
              await promise;
            } else {
              // Standard native fetch fallback
              const downloadHeaders: Record<string, string> = {
                'User-Agent': UA,
              };
              if (referer) {
                downloadHeaders['Referer'] = referer;
                try {
                  downloadHeaders['Origin'] = new URL(referer).origin;
                } catch {}
              }
              if (cookies) {
                downloadHeaders['Cookie'] = cookies;
              }

              const dlResult = await FileSystem.downloadAsync(seg.url, destUri, {
                headers: downloadHeaders,
              });
              if (dlResult.status >= 400) {
                throw new Error(`Segment ${i} failed with ${dlResult.status}`);
              }
            }

            const segInfo = await FileSystem.getInfoAsync(destUri);
            if (segInfo.exists && 'size' in segInfo) {
              totalBytes += (segInfo as any).size ?? 0;
            }
          },
          (done) => {
            if (!cancelledRef.current) {
              setProgress(done / segments.length);
            }
          },
        );

        if (cancelledRef.current) return;

        // ── 4. Write local manifest ──────────────────────────────────────────
        const localManifestContent = buildLocalManifest(manifestText, segments, folderUri);
        const localManifestUri = `${folderUri}playlist.m3u8`;

        if (subtitles && subtitles.length > 0) {
          const downloadedSubs: { label: string; lang: string; localFilename: string }[] = [];

          for (const sub of subtitles) {
            const subFilename = `sub_${sub.lang}.vtt`;
            const destSubUri = `${folderUri}${subFilename}`;
            const subM3u8Filename = `sub_${sub.lang}.m3u8`;
            const destSubM3u8Uri = `${folderUri}${subM3u8Filename}`;

            try {
              console.log(`[HLS Downloader] Downloading subtitle: ${sub.label} (${sub.url})`);
              const downloadHeaders: Record<string, string> = {
                'User-Agent': UA,
              };
              if (referer) {
                downloadHeaders['Referer'] = referer;
                try { downloadHeaders['Origin'] = new URL(referer).origin; } catch {}
              }
              if (cookies) {
                downloadHeaders['Cookie'] = cookies;
              }

              let rawVtt: string | null = null;
              if (injectJSRef.current) {
                rawVtt = await fetchTextViaWebView(sub.url);
              }
              if (!rawVtt) {
                // Fallback to native download
                await FileSystem.downloadAsync(sub.url, destSubUri, {
                  headers: downloadHeaders,
                });
                rawVtt = await FileSystem.readAsStringAsync(destSubUri, {
                  encoding: FileSystem.EncodingType.UTF8,
                });
              } else {
                await FileSystem.writeAsStringAsync(destSubUri, rawVtt, {
                  encoding: FileSystem.EncodingType.UTF8,
                });
              }

              // Preprocess the WebVTT file to apply custom background styling and position
              try {
                const processedVtt = processVttContent(rawVtt);
                await FileSystem.writeAsStringAsync(destSubUri, processedVtt, {
                  encoding: FileSystem.EncodingType.UTF8,
                });
              } catch (parseErr) {
                console.warn('[HLS Downloader] Failed to preprocess VTT styling:', parseErr);
              }

              // Write subtitle media playlist wrapper (VOD format, single segment)
              const subM3u8Content = [
                '#EXTM3U',
                '#EXT-X-VERSION:4',
                '#EXT-X-TARGETDURATION:7200',
                '#EXT-X-MEDIA-SEQUENCE:0',
                '#EXT-X-PLAYLIST-TYPE:VOD',
                '#EXTINF:7200.0,',
                `${folderUri}${subFilename}`,
                '#EXT-X-ENDLIST'
              ].join('\n');

              await FileSystem.writeAsStringAsync(destSubM3u8Uri, subM3u8Content, {
                encoding: FileSystem.EncodingType.UTF8,
              });

              downloadedSubs.push({
                label: sub.label,
                lang: sub.lang,
                localFilename: subM3u8Filename,
              });
            } catch (subErr) {
              console.error(`[HLS Downloader] Failed to download subtitles for ${sub.label}:`, subErr);
            }
          }

          if (downloadedSubs.length > 0) {
            // Write video stream to video.m3u8
            const videoManifestUri = `${folderUri}video.m3u8`;
            await FileSystem.writeAsStringAsync(videoManifestUri, localManifestContent, {
              encoding: FileSystem.EncodingType.UTF8,
            });

            // Write master playlist to playlist.m3u8
            const masterPlaylistLines = [
              '#EXTM3U',
              '#EXT-X-VERSION:4',
            ];

            downloadedSubs.forEach((sub, idx) => {
              const isDefault = idx === 0 ? 'YES' : 'NO';
              masterPlaylistLines.push(
                `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="${sub.label}",DEFAULT=${isDefault},AUTOSELECT=YES,LANGUAGE="${sub.lang}",URI="${folderUri}${sub.localFilename}"`
              );
            });

            masterPlaylistLines.push(
              `#EXT-X-STREAM-INF:BANDWIDTH=5000000,SUBTITLES="subs"`,
              `${folderUri}video.m3u8`
            );

            await FileSystem.writeAsStringAsync(localManifestUri, masterPlaylistLines.join('\n'), {
              encoding: FileSystem.EncodingType.UTF8,
            });
          } else {
            await FileSystem.writeAsStringAsync(localManifestUri, localManifestContent, {
              encoding: FileSystem.EncodingType.UTF8,
            });
          }
        } else {
          await FileSystem.writeAsStringAsync(localManifestUri, localManifestContent, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        }

        // ── 5. Persist to AsyncStorage ───────────────────────────────────────
        const episode: DownloadedEpisode = {
          episodeId: meta.episodeId,
          title: meta.title,
          animeName: meta.animeName,
          thumbnailUrl: meta.thumbnailUrl,
          localManifestUri,
          downloadedAt: Date.now(),
          totalSegments: segments.length,
          sizeBytes: totalBytes,
        };

        const list = await loadSavedDownloads();
        const filtered = list.filter((d) => d.episodeId !== meta.episodeId); // dedup
        await saveDownloads([...filtered, episode]);

        setDownloadedEpisode(episode);
        setStatus('done');
        setProgress(1);
      } catch (err: any) {
        console.error('[HLS Downloader Error]:', err);
        if (!cancelledRef.current) {
          setError(err?.message ?? 'Download failed');
          setStatus('error');
        }
      }
    },
    [],
  );

  return { status, progress, error, downloadedEpisode, startDownload, cancelDownload, handleDownloadMessage };
}
