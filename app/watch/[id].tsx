import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StatusBar, StyleSheet, Image, ScrollView, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useKeepAwake } from 'expo-keep-awake';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  useEpisodeDetails, useAnimeDetails, useEpisodes,
  useWatchProgress, useSimilarAnime
} from '../../src/hooks/useQueries';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/constants/theme';

// ─── INNER PLAYER ─────────────────────────────────────────────────────────────
// Separate component so useVideoPlayer is only called ONCE with a real URL.
// Exposes playback state up via callbacks so the overlay can render controls.
function VideoPlayer({
  url, savedProgressSeconds, onProgress, onNearEnd, onStateChange, onPlayerReady,
}: {
  url: string;
  savedProgressSeconds?: number;
  onProgress: (current: number, duration: number) => void;
  onNearEnd: () => void;
  onStateChange: (isPlaying: boolean, current: number, duration: number) => void;
  onPlayerReady: (player: any) => void;
}) {
  // Inject Referer/Origin headers for third-party CDNs (megacloud, etc.)
  const streamHeaders = {
    'Referer': 'https://megacloud.bloggy.click/',
    'Origin': 'https://megacloud.bloggy.click',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120',
  };
  const needsHeaders = url.includes('megacloud') || url.includes('stream/s-');
  const source = needsHeaders
    ? { uri: url, headers: streamHeaders }
    : { uri: url };
  const player = useVideoPlayer(source);
  const seekApplied = useRef(false);
  const videoReady = useRef(false);

  useEffect(() => {
    onPlayerReady(player);
    player.play();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const current = Math.floor(player.currentTime);
      const duration = Math.floor(player.duration);

      // Apply resume seek once we know the video has loaded (duration > 0)
      if (duration > 0 && !seekApplied.current && savedProgressSeconds && savedProgressSeconds > 5) {
        seekApplied.current = true;
        try { player.currentTime = savedProgressSeconds; } catch (_) {}
      }

      if (player.playing || current > 0) {
        videoReady.current = true;
      }

      // Sync progress every 5 s
      onProgress(current, duration);
      onStateChange(player.playing, current, duration);

      // Dynamic "up next" threshold: 10% of duration or 60 s, whichever is smaller
      const nearEndThreshold = duration > 0 ? Math.min(60, duration * 0.1) : 60;
      if (duration > 0 && duration - current < nearEndThreshold) onNearEnd();
    }, 5000);
    return () => clearInterval(interval);
  }, [player]);

  return (
    <View style={{ flex: 1 }}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
      />
    </View>
  );
}

// ─── PLAYBACK CONTROLS OVERLAY ────────────────────────────────────────────────
function PlaybackControls({
  player,
  isPlaying,
  currentSeconds,
  durationSeconds,
}: {
  player: any;
  isPlaying: boolean;
  currentSeconds: number;
  durationSeconds: number;
}) {
  const progressPct = durationSeconds > 0 ? (currentSeconds / durationSeconds) * 100 : 0;

  const handleSeekRelative = (delta: number) => {
    try {
      const next = Math.max(0, Math.min(durationSeconds, currentSeconds + delta));
      player.currentTime = next;
    } catch (_) {}
  };

  const handleTogglePlay = () => {
    try {
      if (isPlaying) { player.pause(); } else { player.play(); }
    } catch (_) {}
  };

  return (
    <View style={controlStyles.container}>
      {/* Center row: skip-back | play/pause | skip-forward */}
      <View style={controlStyles.btnRow}>
        <TouchableOpacity
          onPress={() => handleSeekRelative(-10)}
          style={controlStyles.sideBtn}
          accessibilityLabel="Skip back 10 seconds"
        >
          <Ionicons name="play-back" size={24} color={COLORS.text} />
          <Text style={controlStyles.skipLabel}>-10s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleTogglePlay}
          style={controlStyles.playBtn}
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        >
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={32} color='#000' />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSeekRelative(10)}
          style={controlStyles.sideBtn}
          accessibilityLabel="Skip forward 10 seconds"
        >
          <Ionicons name="play-forward" size={24} color={COLORS.text} />
          <Text style={controlStyles.skipLabel}>+10s</Text>
        </TouchableOpacity>
      </View>

      {/* Seek bar row */}
      <View style={controlStyles.seekRow}>
        <Text style={controlStyles.timeText}>{formatTime(currentSeconds)}</Text>
        <View style={controlStyles.seekTrack}>
          <View style={[controlStyles.seekFill, { width: `${progressPct}%` }]} />
          <View style={[controlStyles.seekThumb, { left: `${progressPct}%` }]} />
        </View>
        <Text style={controlStyles.timeText}>{formatTime(durationSeconds)}</Text>
      </View>
    </View>
  );
}

const controlStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 16,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    width: '100%',
  },
  sideBtn: {
    alignItems: 'center',
    gap: 4,
  },
  skipLabel: {
    fontSize: 10,
    color: COLORS.text,
    fontWeight: '700',
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.neon,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.neon,
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 12,
  },
  seekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  timeText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'center',
  },
  seekTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    position: 'relative',
  },
  seekFill: {
    height: '100%',
    backgroundColor: COLORS.neon,
    borderRadius: 2,
  },
  seekThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    top: -5,
    marginLeft: -7,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
});

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function WatchScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSelector, setShowSelector] = useState(false);
  const [showNextUp, setShowNextUp] = useState(false);
  const [resumeToast, setResumeToast] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState({ isPlaying: false, current: 0, duration: 0 });
  const playerRef = useRef<any>(null);
  const [streamError, setStreamError] = useState(false);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: episode, isLoading: loadingEp } = useEpisodeDetails(id as string);
  const { data: anime, isLoading: loadingAnime } = useAnimeDetails(episode?.anime_id);
  const { data: episodes } = useEpisodes(episode?.anime_id);
  const { data: savedProgress } = useWatchProgress(id as string);
  const { data: similarAnime } = useSimilarAnime(anime?.genres, anime?.id);

  const nextEpisode = episodes?.find(
    e => e.episode_number === (episode?.episode_number || 0) + 1
  );

  // ── Resolve URL ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!episode?.video_url) return;
    const url = episode.video_url.trim();
    if (!url) {
      setStreamError(true);
      return;
    }
    console.log('VIDEO URL:', url);
    setResolvedUrl(url);
    // Start a 12-second watchdog — if player never reports any progress, the stream is broken
    streamTimeoutRef.current = setTimeout(() => {
      setPlayerState(prev => {
        if (prev.current === 0 && prev.duration === 0) {
          setStreamError(true);
        }
        return prev;
      });
    }, 20000); // 20s watchdog — gives slow CDNs time to buffer
    return () => {
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
    };
  }, [episode?.video_url]);

  // ── Resume toast ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (resolvedUrl && savedProgress?.progress_seconds) {
      setResumeToast(true);
      setTimeout(() => setResumeToast(false), 3000);
    }
  }, [resolvedUrl]);

  // ── Prefetch next episode ───────────────────────────────────────────────────
  useEffect(() => {
    if (!nextEpisode?.id || !user?.id) return;
    queryClient.prefetchQuery({
      queryKey: ['episode', nextEpisode.id],
      queryFn: async () => {
        const { data } = await supabase.from('episodes').select('*').eq('id', nextEpisode.id).single();
        return data;
      }
    });
  }, [nextEpisode?.id]);

  // ── Progress sync callback ──────────────────────────────────────────────────
  const handleProgress = useCallback(async (current: number, duration: number) => {
    if (!user || !episode || current < 5) return;
    await supabase.from('user_watch_progress').upsert({
      user_id: user.id,
      episode_id: episode.id,
      progress_seconds: current,
      is_completed: duration > 0 && current > duration * 0.9,
      last_watched: new Date().toISOString(),
    }, { onConflict: 'user_id,episode_id' });
  }, [user, episode]);

  const handleNearEnd = useCallback(() => {
    if (nextEpisode) setShowNextUp(true);
  }, [nextEpisode]);

  // ── Orientation ─────────────────────────────────────────────────────────────
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => { ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); };
  }, []);

  useKeepAwake();

  // ── Loading ─────────────────────────────────────────────────────────────────
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

  // ── Error / loading guards ───────────────────────────────────────────────────
  if (!resolvedUrl && !streamError) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator size="large" color={COLORS.neonCyan} />
        <Text style={styles.loadingText}>Loading stream...</Text>
      </View>
    );
  }

  if (streamError) {
    return (
      <View style={styles.fullCenter}>
        <Ionicons name="cloud-offline-outline" size={56} color={COLORS.neonPink} />
        <Text style={[styles.errorTitle, { marginTop: 16 }]}>Stream Unavailable</Text>
        <Text style={[styles.loadingText, { textAlign: 'center', paddingHorizontal: 32 }]}>
          {'This episode\u2019s video could not be loaded.\nIt may be unavailable or region-locked.'}
        </Text>
        <View style={styles.errorBtnRow}>
          <TouchableOpacity
            style={styles.errorBtn}
            onPress={() => {
              setStreamError(false);
              setResolvedUrl(null);
              if (episode?.video_url) {
                setTimeout(() => setResolvedUrl(episode.video_url.trim()), 300);
              }
            }}
          >
            <Ionicons name="refresh" size={16} color='#000' />
            <Text style={styles.errorBtnText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.errorBtn, styles.errorBtnSecondary]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={COLORS.neon} />
            <Text style={[styles.errorBtnText, { color: COLORS.neon }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Player ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Player only mounts here — after resolvedUrl is confirmed non-null */}
      <VideoPlayer
        url={resolvedUrl}
        savedProgressSeconds={savedProgress?.progress_seconds}
        onProgress={handleProgress}
        onNearEnd={handleNearEnd}
        onPlayerReady={(p) => { playerRef.current = p; }}
        onStateChange={(isPlaying, current, duration) => {
          setPlayerState({ isPlaying, current, duration });
        }}
      />

      <TouchableOpacity
        activeOpacity={1}
        onPress={() => setControlsVisible(v => !v)}
        style={StyleSheet.absoluteFill}
      >
        <LinearGradient colors={['rgba(189,157,255,0.1)', 'transparent']} style={styles.glowTopLeft} />
        <LinearGradient colors={['transparent', 'rgba(0,227,253,0.1)']} style={styles.glowBottomRight} />

        {controlsVisible && (
          <View style={styles.overlay}>
            <LinearGradient
              colors={['rgba(14,14,17,0.9)', 'transparent', 'transparent', 'rgba(14,14,17,0.9)']}
              style={StyleSheet.absoluteFill}
            />

            {/* Top HUD */}
            <View style={styles.topHud}>
              <View style={styles.topHudLeft}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                  <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <View>
                  <Text style={styles.animeTitle}>{anime?.title?.toUpperCase()}</Text>
                  <Text style={styles.episodeInfo}>S1:E{episode.episode_number} • {episode.title}</Text>
                </View>
              </View>
              <View style={styles.topHudRight}>
                <TouchableOpacity style={styles.selectorBtn} onPress={() => setShowSelector(true)}>
                  <Ionicons name="list" size={16} color={COLORS.text} />
                  <Text style={styles.selectorBtnText}>EPISODES</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Resume Toast */}
            {resumeToast && (
              <View style={styles.resumeToast}>
                <BlurView intensity={40} style={styles.resumeToastBlur}>
                  <Ionicons name="time" size={14} color={COLORS.neon} />
                  <Text style={styles.resumeToastText}>
                    Resuming from {formatTime(savedProgress?.progress_seconds)}
                  </Text>
                </BlurView>
              </View>
            )}

            {/* Playback Controls */}
            <PlaybackControls
              player={playerRef.current}
              isPlaying={playerState.isPlaying}
              currentSeconds={playerState.current}
              durationSeconds={playerState.duration}
            />

            {/* Up Next */}
            {showNextUp && nextEpisode && (
              <TouchableOpacity
                style={styles.nextUpCard}
                onPress={() => router.replace(`/watch/${nextEpisode.id}`)}
              >
                <BlurView intensity={30} style={styles.nextUpBlur}>
                  <Image source={{ uri: nextEpisode.thumbnail_url || anime?.poster_url }} style={styles.nextUpThumb} />
                  <View>
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
      </TouchableOpacity>

      {/* Episode Selector */}
      {showSelector && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setShowSelector(false)} />
          <BlurView intensity={80} style={styles.selectorSheet} tint="dark">
            <View style={styles.selectorHeader}>
              <Text style={styles.selectorTitle}>EPISODES</Text>
              <TouchableOpacity onPress={() => setShowSelector(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorList}>
              {episodes?.map(ep => (
                <TouchableOpacity
                  key={ep.id}
                  style={[styles.selectorItem, ep.id === id && styles.activeItem]}
                  onPress={() => {
                    setShowSelector(false);
                    setResolvedUrl(null); // reset so new episode loads fresh
                    router.replace(`/watch/${ep.id}`);
                  }}
                >
                  <Image source={{ uri: ep.thumbnail_url || anime?.poster_url }} style={styles.selectorThumb} />
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

function formatTime(seconds: number = 0) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  fullCenter: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: COLORS.textSub, fontSize: 13, fontWeight: '600', marginTop: 8 },
  errorTitle: { color: COLORS.text, fontSize: 20, fontWeight: '900', marginTop: 12 },
  errorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: COLORS.neon,
    borderRadius: 24,
  },
  errorBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.neon,
  },
  errorBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },

  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 32 },
  glowTopLeft: { position: 'absolute', top: 0, left: 0, width: '40%', height: '40%', opacity: 0.5 },
  glowBottomRight: { position: 'absolute', bottom: 0, right: 0, width: '40%', height: '40%', opacity: 0.5 },

  topHud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  topHudLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  animeTitle: { color: COLORS.neonCyan, fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  episodeInfo: { color: COLORS.text, fontSize: 20, fontWeight: '900', marginTop: 2 },
  topHudRight: { flexDirection: 'row', gap: 12 },

  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16, height: 44, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  selectorBtnText: { color: COLORS.text, fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  resumeToast: { position: 'absolute', top: 120, alignSelf: 'center' },
  resumeToastBlur: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', overflow: 'hidden',
  },
  resumeToastText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },

  nextUpCard: { position: 'absolute', bottom: 100, right: 32, width: 280, borderRadius: 16, overflow: 'hidden' },
  nextUpBlur: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 12 },
  nextUpThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: COLORS.bgElevated },
  nextUpLabel: { fontSize: 8, fontWeight: '900', color: COLORS.neonCyan, letterSpacing: 1 },
  nextUpTitle: { fontSize: 11, fontWeight: '700', color: COLORS.text, width: 160 },

  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  selectorSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 32, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderWidth: 1, borderColor: 'rgba(189,157,255,0.2)',
  },
  selectorHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center' },
  selectorTitle: { fontSize: 24, fontWeight: '900', color: COLORS.neon, letterSpacing: -1, fontStyle: 'italic' },
  selectorList: { gap: 16, paddingBottom: 20 },
  selectorItem: { width: 180, gap: 12 },
  activeItem: { opacity: 1 },
  selectorThumb: { width: '100%', height: 100, borderRadius: 12, backgroundColor: COLORS.bgElevated },
  selectorInfo: { gap: 2 },
  selectorEpNum: { fontSize: 8, fontWeight: '800', color: COLORS.textSub, letterSpacing: 1 },
  selectorEpTitle: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  nowPlayingBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: COLORS.neon, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  nowPlayingText: { fontSize: 7, fontWeight: '900', color: '#000' },
});
