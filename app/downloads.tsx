import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { COLORS } from '../src/constants/theme';
import {
  getAllDownloads,
  deleteDownload,
  type DownloadedEpisode,
} from '../src/hooks/useHlsDownloader';

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

// ─── Offline Video Player Modal ───────────────────────────────────────────────

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

  return (
    <View style={StyleSheet.absoluteFill}>
      <StatusBar hidden />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls
      />
      <TouchableOpacity style={styles.closePlayer} onPress={onClose}>
        <BlurView intensity={40} tint="dark" style={styles.closePlayerBlur}>
          <Ionicons name="close" size={20} color={COLORS.text} />
        </BlurView>
      </TouchableOpacity>
    </View>
  );
}

// ─── Download Card ────────────────────────────────────────────────────────────

function DownloadCard({
  item,
  onPlay,
  onDelete,
}: {
  item: DownloadedEpisode;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Download',
      `Remove "${item.title}" from downloads? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ],
    );
  }, [item.title, onDelete]);

  return (
    <View style={styles.card}>
      {/* Thumbnail */}
      <TouchableOpacity style={styles.thumbWrap} onPress={onPlay} activeOpacity={0.85}>
        <Image
          source={{ uri: item.thumbnailUrl }}
          style={styles.thumb}
          contentFit="cover"
          transition={200}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={StyleSheet.absoluteFill}
        />
        {/* Play overlay */}
        <View style={styles.playOverlay}>
          <BlurView intensity={50} tint="dark" style={styles.playBtn}>
            <Ionicons name="play" size={22} color="#fff" />
          </BlurView>
        </View>
      </TouchableOpacity>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardAnime} numberOfLines={1}>
          {item.animeName}
        </Text>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.cardMeta}>
          <View style={styles.metaChip}>
            <Ionicons name="document-outline" size={10} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{item.totalSegments} segments</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="server-outline" size={10} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{formatBytes(item.sizeBytes)}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="calendar-outline" size={10} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{formatDate(item.downloadedAt)}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={onPlay}>
            <Ionicons name="play-circle" size={16} color={COLORS.neonCyan} />
            <Text style={[styles.actionText, { color: COLORS.neonCyan }]}>Watch Offline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={16} color={COLORS.neonPink} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DownloadsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [downloads, setDownloads] = useState<DownloadedEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingEpisode, setPlayingEpisode] = useState<DownloadedEpisode | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const all = await getAllDownloads();
    // Newest first
    setDownloads(all.sort((a, b) => b.downloadedAt - a.downloadedAt));
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

  const renderItem = useCallback(
    ({ item }: { item: DownloadedEpisode }) => (
      <DownloadCard
        item={item}
        onPlay={() => setPlayingEpisode(item)}
        onDelete={() => handleDelete(item.episodeId)}
      />
    ),
    [handleDelete],
  );

  const keyExtractor = useCallback((item: DownloadedEpisode) => item.episodeId, []);

  // ── Offline Player overlay ───────────────────────────────────────────────
  if (playingEpisode) {
    return (
      <OfflinePlayer
        episode={playingEpisode}
        onClose={() => setPlayingEpisode(null)}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Downloads</Text>
          <Text style={styles.headerSub}>
            {downloads.length} episode{downloads.length !== 1 ? 's' : ''} saved
          </Text>
        </View>
      </View>

      {/* ── Notice Banner ── */}
      <BlurView intensity={20} tint="dark" style={styles.noticeBanner}>
        <Ionicons name="information-circle-outline" size={14} color={COLORS.neonCyan} />
        <Text style={styles.noticeText}>
          Downloads use HLS segment caching. Tap Download while watching an episode to save it offline.
        </Text>
      </BlurView>

      {/* ── List ── */}
      {loading ? (
        <View style={styles.empty}>
          <Ionicons name="download-outline" size={56} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Loading…</Text>
        </View>
      ) : downloads.length === 0 ? (
        <View style={styles.empty}>
          <LinearGradient
            colors={['rgba(0,229,255,0.08)', 'transparent']}
            style={styles.emptyGlow}
          />
          <Ionicons name="cloud-download-outline" size={68} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No Downloads Yet</Text>
          <Text style={styles.emptySub}>
            Open any episode and tap{' '}
            <Text style={{ color: COLORS.neonCyan }}>Download</Text> in the player HUD to save it for offline viewing.
          </Text>
        </View>
      ) : (
        <FlatList
          data={downloads}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 32 },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg ?? '#0e0e11',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text ?? '#fff',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: COLORS.textMuted ?? '#888',
    marginTop: 2,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.15)',
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textMuted ?? '#888',
    lineHeight: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  separator: {
    height: 12,
  },
  // ── Card ──
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  thumbWrap: {
    width: 120,
    height: 110,
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cardInfo: {
    flex: 1,
    padding: 12,
    gap: 4,
  },
  cardAnime: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.neonCyan ?? '#00e5ff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text ?? '#fff',
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 9,
    color: COLORS.textMuted ?? '#888',
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(0,229,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.2)',
  },
  deleteBtn: {
    backgroundColor: 'rgba(255,80,120,0.08)',
    borderColor: 'rgba(255,80,120,0.2)',
    paddingHorizontal: 8,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // ── Empty ──
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
    color: COLORS.text ?? '#fff',
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted ?? '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  // ── Offline Player ──
  closePlayer: {
    position: 'absolute',
    top: 48,
    left: 20,
  },
  closePlayerBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
