import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Dimensions,
  BackHandler,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import { COLORS, SHADOWS } from '../src/constants/theme';
import {
  getAllDownloads,
  deleteDownload,
  type DownloadedEpisode,
} from '../src/hooks/useHlsDownloader';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 44) / 2; // Perfect two-column spacing with margins

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(seconds: number = 0) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface GroupedAnime {
  animeName: string;
  thumbnailUrl: string;
  episodes: DownloadedEpisode[];
  totalSizeBytes: number;
}

// ─── Offline Video Player ─────────────────────────────────────────────────────

function OfflinePlayer({
  episode,
  onClose,
}: {
  episode: DownloadedEpisode;
  onClose: () => void;
}) {
  const player = useVideoPlayer(episode.localManifestUri, (p) => {
    p.play();
  });

  // Track whether the USER intentionally paused (vs unexpected buffering pause)
  const userPausedRef = useRef(false);

  // isPlaying/currentTime/duration polled directly — most reliable approach for expo-video 2.0.x
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [contentFit, setContentFit] = useState<'contain' | 'fill' | 'cover'>('contain');

  useEffect(() => {
    const watchdog = setInterval(() => {
      const playing = player.playing;
      const time    = player.currentTime;
      const dur     = player.duration;

      setIsPlaying(playing);
      setCurrentTime(time);
      setDuration(dur);

      // Auto-enable subtitles if they should be enabled and a track is available but not selected
      if (subtitlesEnabled && player.availableSubtitleTracks && player.availableSubtitleTracks.length > 0 && !player.subtitleTrack) {
        player.subtitleTrack = player.availableSubtitleTracks[0];
      }

      // Auto-resume: if the player stopped but the user didn't pause it,
      // kick it back to playing. Covers HLS segment-boundary stalls,
      // buffering pauses, and any other unexpected stops.
      const isEnding = (dur > 0 && !isNaN(dur) && !isNaN(time) && time >= dur - 0.5);
      if (!playing && !userPausedRef.current && !isEnding) {
        player.play();
      }
    }, 500);

    return () => clearInterval(watchdog);
  }, [player, subtitlesEnabled]);

  const [showHud, setShowHud] = useState(true);
  const hudTimerRef = useRef<any>(null);

  const resetHudTimer = useCallback(() => {
    setShowHud(true);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setShowHud(false), 4000);
  }, []);

  const toggleHud = useCallback(() => {
    setShowHud((prev) => {
      if (prev) {
        if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
        return false;
      } else {
        if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
        hudTimerRef.current = setTimeout(() => setShowHud(false), 4000);
        return true;
      }
    });
  }, []);

  useEffect(() => {
    resetHudTimer();
    return () => {
      if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    };
  }, [resetHudTimer]);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    NavigationBar.setVisibilityAsync("hidden");

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      NavigationBar.setVisibilityAsync("visible");
    };
  }, []);

  const handlePlayPause = useCallback(() => {
    if (!player) return;
    if (isPlaying) {
      userPausedRef.current = true;   // mark as intentional pause
      player.pause();
    } else {
      userPausedRef.current = false;  // user resumed
      player.play();
    }
    resetHudTimer();
  }, [player, isPlaying, resetHudTimer]);

  const handleSeek = useCallback((sec: number) => {
    if (!player) return;
    // Use currentTime directly as seekBy is less precise and causes buffering pauses
    player.currentTime = player.currentTime + sec;
    // Seeking briefly pauses the player in expo-video 2.0.x — force resume
    setTimeout(() => { if (!userPausedRef.current) player.play(); }, 300);
    resetHudTimer();
  }, [player, resetHudTimer]);

  const handleToggleSubtitles = useCallback(() => {
    if (!player) return;
    if (subtitlesEnabled) {
      player.subtitleTrack = null;
      setSubtitlesEnabled(false);
    } else if (player.availableSubtitleTracks && player.availableSubtitleTracks.length > 0) {
      player.subtitleTrack = player.availableSubtitleTracks[0];
      setSubtitlesEnabled(true);
    }
    resetHudTimer();
  }, [player, subtitlesEnabled, resetHudTimer]);

  const handleToggleResizeMode = useCallback(() => {
    setContentFit((prev) => {
      if (prev === 'contain') return 'fill';
      if (prev === 'fill') return 'cover';
      return 'contain';
    });
    resetHudTimer();
  }, [resetHudTimer]);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const progressBarWidthRef = useRef<number>(0);

  const handleProgressTap = useCallback((evt: any) => {
    if (!player || duration <= 0 || progressBarWidthRef.current <= 0) return;
    const tapX = evt.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, tapX / progressBarWidthRef.current));
    player.currentTime = ratio * duration;
    // Absolute seek also pauses — force resume
    setTimeout(() => { if (!userPausedRef.current) player.play(); }, 300);
    resetHudTimer();
  }, [player, duration, resetHudTimer]);

  return (
    <View style={styles.playerContainer}>
      <StatusBar hidden />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit={contentFit}
        nativeControls={false}
      />

      {/* Tap-to-toggle HUD — sits behind controls so buttons still receive touches */}
      <TouchableOpacity 
        style={StyleSheet.absoluteFill} 
        activeOpacity={1} 
        onPress={toggleHud}
      />

      {showHud && (
        <View style={styles.hudLayer} pointerEvents="box-none">
          {/* Top HUD */}
          <LinearGradient
            colors={['rgba(8,8,16,0.95)', 'rgba(8,8,16,0.5)', 'transparent']}
            style={styles.playerTopHud}
          >
            <TouchableOpacity onPress={onClose} style={styles.playerBackBtn}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerAnimeName} numberOfLines={1}>
                {episode.animeName.toUpperCase()}
              </Text>
              <Text style={styles.playerEpisodeTitle} numberOfLines={1}>
                {episode.title}
              </Text>
            </View>
          </LinearGradient>

          {/* Center Playback Controls */}
          <View style={styles.playerCenterControls}>
            <TouchableOpacity onPress={() => handleSeek(-10)} style={styles.playerControlBtn}>
              <Ionicons name="play-back" size={28} color={COLORS.text} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handlePlayPause} style={styles.playerPlayPauseBtn}>
              <BlurView intensity={45} tint="dark" style={styles.playerPlayPauseBlur}>
                <Ionicons name={isPlaying ? "pause" : "play"} size={36} color={COLORS.neonCyan} style={!isPlaying ? { marginLeft: 4 } : undefined} />
              </BlurView>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleSeek(10)} style={styles.playerControlBtn}>
              <Ionicons name="play-forward" size={28} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Bottom HUD */}
          <LinearGradient
            colors={['transparent', 'rgba(8,8,16,0.5)', 'rgba(8,8,16,0.95)']}
            style={styles.playerBottomHud}
          >
            <TouchableOpacity
              style={styles.playerProgressTrack}
              activeOpacity={1}
              onPress={handleProgressTap}
              onLayout={(e) => { progressBarWidthRef.current = e.nativeEvent.layout.width; }}
            >
              <View style={styles.playerProgressBar} pointerEvents="none">
                <View style={[styles.playerProgressFill, { width: `${pct}%` }]} />
                {/* Scrubber thumb dot */}
                <View style={[styles.playerScrubThumb, { left: `${pct}%` }]} />
              </View>
            </TouchableOpacity>

            <View style={styles.playerTimeRow}>
              <Text style={styles.playerTimeText}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity onPress={handleToggleResizeMode} style={styles.resizeBtn}>
                  <Ionicons 
                    name={
                      contentFit === 'contain' ? "resize" : 
                      contentFit === 'fill' ? "expand" : "scan"
                    } 
                    size={14} 
                    color={COLORS.neonCyan} 
                  />
                  <Text style={styles.resizeBtnText}>
                    {contentFit === 'contain' ? 'ORIGINAL' : 
                     contentFit === 'fill' ? 'STRETCH' : 'ZOOM'}
                  </Text>
                </TouchableOpacity>

                {player.availableSubtitleTracks && player.availableSubtitleTracks.length > 0 && (
                  <TouchableOpacity onPress={handleToggleSubtitles} style={[styles.ccButton, !subtitlesEnabled && styles.ccButtonDisabled]}>
                    <Ionicons name="chatbubble-ellipses" size={16} color={subtitlesEnabled ? COLORS.neonCyan : COLORS.textMuted} />
                    <Text style={[styles.ccButtonText, subtitlesEnabled ? { color: COLORS.neonCyan } : { color: COLORS.textMuted }]}>CC</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.offlineBadge}>
                  <Ionicons name="cloud-offline" size={10} color={COLORS.neonCyan} style={{ marginRight: 4 }} />
                  <Text style={styles.offlineBadgeText}>OFFLINE MODE</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
}

// ─── Episode Row (Detailed Episode Card) ──────────────────────────────────────

function EpisodeRow({
  episode,
  onPlay,
  onDelete,
}: {
  episode: DownloadedEpisode;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Download',
      `Remove "${episode.title}" from downloads? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ],
    );
  }, [episode.title, onDelete]);

  return (
    <View style={styles.episodeCard}>
      {/* Thumbnail with Glass play overlay */}
      <TouchableOpacity style={styles.epThumbWrap} onPress={onPlay} activeOpacity={0.85}>
        <Image
          source={{ uri: episode.thumbnailUrl }}
          style={styles.epThumb}
          contentFit="cover"
          transition={200}
        />
        <LinearGradient
          colors={['transparent', 'rgba(8,8,16,0.85)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.epPlayOverlay}>
          <BlurView intensity={35} tint="dark" style={styles.epPlayBtn}>
            <Ionicons name="play" size={16} color={COLORS.neonCyan} />
          </BlurView>
        </View>
      </TouchableOpacity>

      {/* Episode Info */}
      <View style={styles.epInfo}>
        <Text style={styles.epTitle} numberOfLines={1}>
          {episode.title}
        </Text>
        <View style={styles.epMetaRow}>
          <View style={styles.metaBadge}>
            <Ionicons name="file-tray-full-outline" size={9} color={COLORS.textSub} />
            <Text style={styles.metaBadgeText}>{formatBytes(episode.sizeBytes)}</Text>
          </View>
          <View style={styles.metaBadge}>
            <Ionicons name="calendar-outline" size={9} color={COLORS.textSub} />
            <Text style={styles.metaBadgeText}>{formatDate(episode.downloadedAt)}</Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.epActions}>
        <TouchableOpacity style={styles.actionCircleBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={18} color={COLORS.neonPink} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Grouped Anime Card (2-Column Premium Grid Item) ───────────────────────────

function GroupedAnimeCard({
  group,
  onPress,
}: {
  group: GroupedAnime;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity 
      style={styles.animeGridCard} 
      onPress={onPress} 
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: group.thumbnailUrl }}
        style={styles.gridPoster}
        contentFit="cover"
        transition={250}
      />
      <LinearGradient
        colors={['transparent', 'rgba(8,8,16,0.3)', 'rgba(8,8,16,0.95)']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Stored Count Badge (Cyber glass style) */}
      <View style={styles.gridBadge}>
        <BlurView intensity={45} tint="dark" style={styles.gridBadgeBlur}>
          <Text style={styles.gridBadgeText}>{group.episodes.length} EP</Text>
        </BlurView>
      </View>

      {/* Bottom Title Panel */}
      <View style={styles.gridTitlePanel}>
        <Text style={styles.gridTitle} numberOfLines={1}>
          {group.animeName}
        </Text>
        <Text style={styles.gridSubtitle}>
          {formatBytes(group.totalSizeBytes)} saved
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DownloadsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [downloads, setDownloads] = useState<DownloadedEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingEpisode, setPlayingEpisode] = useState<DownloadedEpisode | null>(null);
  const [selectedAnimeName, setSelectedAnimeName] = useState<string | null>(null);

  // ── Hardware back button handler ─────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (playingEpisode) {
        setPlayingEpisode(null);
        return true; // consumed
      }
      if (selectedAnimeName) {
        setSelectedAnimeName(null);
        return true; // consumed
      }
      return false; // let Expo Router handle it (goes back to prev screen)
    });
    return () => sub.remove();
  }, [playingEpisode, selectedAnimeName]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const all = await getAllDownloads();
    setDownloads(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = useCallback(
    async (episodeId: string) => {
      await deleteDownload(episodeId);
      await refresh();
    },
    [refresh],
  );

  // Group downloads by animeName
  const groupedList = React.useMemo(() => {
    const grouped = downloads.reduce<Record<string, GroupedAnime>>((acc, item) => {
      if (!acc[item.animeName]) {
        acc[item.animeName] = {
          animeName: item.animeName,
          thumbnailUrl: item.thumbnailUrl || '',
          episodes: [],
          totalSizeBytes: 0,
        };
      }
      acc[item.animeName].episodes.push(item);
      acc[item.animeName].totalSizeBytes += item.sizeBytes;
      return acc;
    }, {});

    return Object.values(grouped).sort((a, b) => {
      const latestA = Math.max(...a.episodes.map(e => e.downloadedAt));
      const latestB = Math.max(...b.episodes.map(e => e.downloadedAt));
      return latestB - latestA;
    }).map(group => {
      group.episodes.sort((x, y) => x.downloadedAt - y.downloadedAt);
      return group;
    });
  }, [downloads]);

  // Keep selected group structure up to date
  const selectedGroup = React.useMemo(() => {
    if (!selectedAnimeName) return null;
    return groupedList.find(g => g.animeName === selectedAnimeName) || null;
  }, [groupedList, selectedAnimeName]);

  useEffect(() => {
    if (selectedAnimeName && !selectedGroup) {
      setSelectedAnimeName(null);
    }
  }, [selectedGroup, selectedAnimeName]);

  // ── Offline Player overlay ───────────────────────────────────────────────
  if (playingEpisode) {
    return (
      <OfflinePlayer
        episode={playingEpisode}
        onClose={() => setPlayingEpisode(null)}
      />
    );
  }

  // ── Selected Anime Sub-Screen (Dedicated Page) ────────────────────────────────
  if (selectedAnimeName && selectedGroup) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

        {/* Sub-Header (Glassmorphic Topbar) */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedAnimeName(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>{selectedGroup.animeName}</Text>
            <Text style={styles.headerSub}>
              {selectedGroup.episodes.length} Episodes Saved • {formatBytes(selectedGroup.totalSizeBytes)}
            </Text>
          </View>
        </View>

        {/* Dynamic Glass Backdrop Banner */}
        <View style={styles.detailBanner}>
          <Image
            source={{ uri: selectedGroup.thumbnailUrl }}
            style={styles.detailBannerBlur}
            contentFit="cover"
            blurRadius={28}
          />
          <LinearGradient
            colors={['rgba(8,8,16,0.3)', 'rgba(8,8,16,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          
          <View style={styles.detailBannerContent}>
            <View style={styles.detailPosterWrap}>
              <Image
                source={{ uri: selectedGroup.thumbnailUrl }}
                style={styles.detailPoster}
                contentFit="cover"
                transition={200}
              />
            </View>
            <View style={styles.detailMetaInfo}>
              <Text style={styles.detailTitle} numberOfLines={2}>{selectedGroup.animeName}</Text>
              <View style={styles.detailStats}>
                <View style={styles.metaChip}>
                  <Ionicons name="disc" size={12} color={COLORS.neonCyan} />
                  <Text style={styles.metaChipText}>{selectedGroup.episodes.length} Files</Text>
                </View>
                <View style={styles.metaChip}>
                  <Ionicons name="folder-open" size={12} color={COLORS.neon} />
                  <Text style={[styles.metaChipText, { color: COLORS.neon }]}>{formatBytes(selectedGroup.totalSizeBytes)}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Cinematic Episode Grid List */}
        <FlatList
          data={selectedGroup.episodes}
          keyExtractor={(item) => item.episodeId}
          renderItem={({ item }) => (
            <EpisodeRow
              episode={item}
              onPlay={() => setPlayingEpisode(item)}
              onDelete={() => handleDelete(item.episodeId)}
            />
          )}
          contentContainerStyle={[
            styles.detailList,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.detailSeparator} />}
        />
      </View>
    );
  }

  // ── Main Page (Library Grid Layout) ──────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Offline Library</Text>
          <Text style={styles.headerSub}>
            {groupedList.length} titles available offline
          </Text>
        </View>
      </View>

      {/* Grid Library List */}
      {loading ? (
        <View style={styles.empty}>
          <Ionicons name="download-outline" size={56} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Accessing Vault…</Text>
        </View>
      ) : groupedList.length === 0 ? (
        <View style={styles.empty}>
          <LinearGradient
            colors={['rgba(0,245,255,0.08)', 'transparent']}
            style={styles.emptyGlow}
          />
          <Ionicons name="cloud-download-outline" size={68} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Vault is Empty</Text>
          <Text style={styles.emptySub}>
            Stream any episode, wait for it to sniff, and hit{' '}
            <Text style={{ color: COLORS.neonCyan }}>Download</Text> to secure offline access.
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedList}
          keyExtractor={(item) => item.animeName}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <GroupedAnimeCard
              group={item}
              onPress={() => setSelectedAnimeName(item.animeName)}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg ?? '#080810',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(191,95,255,0.08)',
    backgroundColor: COLORS.bg ?? '#080810',
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text ?? '#F0EEFF',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.textSub ?? '#8A87A8',
    marginTop: 2,
    fontWeight: '500',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.15)',
    backgroundColor: 'rgba(0,245,255,0.03)',
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSub ?? '#8A87A8',
    lineHeight: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  separator: {
    height: 12,
  },
  // ── 2-Column Premium Grid Card ──
  animeGridCard: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.45,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(191,95,255,0.15)',
    backgroundColor: COLORS.bgCard ?? '#0E0E1A',
    position: 'relative',
    ...SHADOWS.neon,
    shadowOpacity: 0.1, // Subtle, upscale shadow
  },
  gridPoster: {
    ...StyleSheet.absoluteFillObject,
  },
  gridBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.25)',
  },
  gridBadgeBlur: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.neonCyan ?? '#00F5FF',
    letterSpacing: 0.5,
  },
  gridTitlePanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    gap: 3,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text ?? '#F0EEFF',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gridSubtitle: {
    fontSize: 10,
    color: COLORS.neonCyan ?? '#00F5FF',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── Detail Sub-Page Banner ──
  detailBanner: {
    height: 180,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(191,95,255,0.08)',
  },
  detailBannerBlur: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  detailBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 20,
    gap: 16,
    zIndex: 2,
  },
  detailPosterWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    ...SHADOWS.neon,
    shadowRadius: 16,
    shadowOpacity: 0.35,
  },
  detailPoster: {
    width: 78,
    height: 108,
    backgroundColor: '#13131F',
  },
  detailMetaInfo: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 4,
    gap: 10,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text ?? '#F0EEFF',
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  detailStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.neonCyan ?? '#00F5FF',
  },
  // ── Cinematic Episode Card ──
  detailList: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  detailSeparator: {
    height: 14,
  },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.bgCard ?? '#0E0E1A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(191,95,255,0.08)',
    gap: 14,
    ...SHADOWS.neon,
    shadowOpacity: 0.04,
  },
  epThumbWrap: {
    width: 100,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#13131F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  epThumb: {
    width: '100%',
    height: '100%',
  },
  epPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  epPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0,245,255,0.3)',
  },
  epInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  epTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text ?? '#F0EEFF',
    lineHeight: 18,
  },
  epMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  metaBadgeText: {
    fontSize: 9,
    color: COLORS.textSub ?? '#8A87A8',
    fontWeight: '600',
  },
  epActions: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,45,120,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,45,120,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Empty State ──
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
    position: 'relative',
  },
  emptyGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: '30%',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text ?? '#F0EEFF',
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textSub ?? '#8A87A8',
    textAlign: 'center',
    lineHeight: 20,
  },
  // ── Landscape Video Player Styles ──
  playerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  playerTopHud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 16,
  },
  playerBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(8,8,16,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerAnimeName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.neonCyan ?? '#00F5FF',
    letterSpacing: 0.5,
  },
  playerEpisodeTitle: {
    fontSize: 13,
    color: COLORS.text ?? '#F0EEFF',
    marginTop: 2,
    fontWeight: '600',
  },
  playerCenterControls: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
  },
  playerControlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(8,8,16,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  playerPlayPauseBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.neonCyan ?? '#00F5FF',
    ...SHADOWS.neon,
  },
  playerPlayPauseBlur: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerBottomHud: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    paddingBottom: 24,
    paddingTop: 48,
  },
  playerProgressTrack: {
    width: '100%',
    height: 28,       // tall tap target — easier to tap accurately
    justifyContent: 'center',
    paddingVertical: 10,
  },
  playerProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  playerProgressFill: {
    height: '100%',
    backgroundColor: COLORS.neonCyan ?? '#00F5FF',
    borderRadius: 3,
  },
  playerScrubThumb: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.neonCyan ?? '#00F5FF',
    marginLeft: -7,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: COLORS.neonCyan ?? '#00F5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 8,
  },
  playerTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  playerTimeText: {
    fontSize: 12,
    color: COLORS.text ?? '#F0EEFF',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,245,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  offlineBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.neonCyan ?? '#00F5FF',
    letterSpacing: 0.5,
  },
  ccButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,245,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  ccButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  ccButtonText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  resizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,245,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  resizeBtnText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.neonCyan ?? '#00F5FF',
    letterSpacing: 0.5,
  },
  hudLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
});
