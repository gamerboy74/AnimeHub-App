import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { COLORS, SPACING, RADIUS, TOUCH } from '../../../src/constants/theme';
import { Episode } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { useEpisodes, useAnimeWatchProgress } from '../../../src/hooks/useQueries';
import { getAllDownloads } from '../../../src/hooks/useHlsDownloader';
import { haptic } from '../../../src/lib/haptics';

// How many episodes per range chunk (e.g. 1-50, 51-100)
const RANGE_SIZE = 50;

// Row height must match epRow.paddingVertical * 2 + ~24 content
const ITEM_HEIGHT = 56;
const SEPARATOR_HEIGHT = 1;

export default function EpisodesListScreen() {
  const params = useLocalSearchParams();
  const animeId = useMemo(() => {
    const raw = params.id;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) return raw[0] ?? '';
    return '';
  }, [params.id]);
  const animeTitle = typeof params.animeTitle === 'string' ? params.animeTitle : '';

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const listRef = useRef<FlatList<Episode>>(null);

  const [filter, setFilter] = useState<'all' | 'free' | 'premium'>('all');
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [activeRangeIndex, setActiveRangeIndex] = useState(0);

  // Watch progress — fetched once for the whole anime, keyed by episodeId
  const { data: watchProgressMap = new Map() } = useAnimeWatchProgress(animeId);

  const checkDownloads = useCallback(async () => {
    try {
      const list = await getAllDownloads();
      setDownloadedIds(new Set(list.map(d => d.episodeId)));
    } catch (e) {
      console.error('[EpisodesList] checkDownloads error:', e);
    }
  }, []);

  const navigation = useNavigation();

  useEffect(() => {
    checkDownloads();
    const unsubscribe = navigation.addListener('focus', () => {
      checkDownloads();
    });
    return unsubscribe;
  }, [navigation, checkDownloads]);

  // Cached — navigating back and re-entering won't re-fetch within staleTime
  const { data: allEpisodes = [], isLoading: loading, isError } = useEpisodes(animeId);

  useEffect(() => {
    if (isError) {
      Alert.alert('Error', 'Could not load episodes. Please go back and try again.');
    }
  }, [isError]);

  // Only show episodes that have a working stream URL
  const episodes = useMemo(
    () => allEpisodes.filter(ep => !!ep.video_url?.trim()),
    [allEpisodes],
  );

  // Apply free/premium filter
  const filtered = useMemo(
    () => episodes.filter(ep =>
      filter === 'all' ? true : filter === 'free' ? !ep.is_premium : ep.is_premium
    ),
    [episodes, filter],
  );

  // ── Range chunks (only generated when > RANGE_SIZE episodes) ──────────────
  const useRanges = filtered.length > RANGE_SIZE;

  const ranges = useMemo(() => {
    if (!useRanges) return [];
    const chunks: { label: string; start: number; end: number }[] = [];
    for (let i = 0; i < filtered.length; i += RANGE_SIZE) {
      const startEp = filtered[i].episode_number;
      const endEp = filtered[Math.min(i + RANGE_SIZE - 1, filtered.length - 1)].episode_number;
      chunks.push({ label: `${startEp}–${endEp}`, start: i, end: Math.min(i + RANGE_SIZE - 1, filtered.length - 1) });
    }
    return chunks;
  }, [filtered, useRanges]);

  // Auto-select the range that contains the first unwatched episode
  useEffect(() => {
    if (!useRanges || watchProgressMap.size === 0 || ranges.length === 0) return;
    // Find last watched episode index
    let lastWatchedIndex = -1;
    for (let i = 0; i < filtered.length; i++) {
      const prog = watchProgressMap.get(filtered[i].id);
      if (prog?.is_completed || (prog?.progress_seconds ?? 0) > 5) {
        lastWatchedIndex = i;
      }
    }
    if (lastWatchedIndex < 0) return; // nothing watched — stay at 0
    // Jump to the range that contains the next episode after lastWatched
    const nextIndex = Math.min(lastWatchedIndex + 1, filtered.length - 1);
    const rangeIdx = Math.floor(nextIndex / RANGE_SIZE);
    setActiveRangeIndex(Math.min(rangeIdx, ranges.length - 1));
  }, [useRanges, watchProgressMap.size, ranges.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Slice the filtered list to just the active range (when ranges are active)
  const visibleEpisodes = useMemo(() => {
    if (!useRanges) return filtered;
    const range = ranges[activeRangeIndex];
    if (!range) return filtered;
    return filtered.slice(range.start, range.end + 1);
  }, [filtered, useRanges, ranges, activeRangeIndex]);

  // When range changes, scroll to top
  const handleRangeChange = useCallback((idx: number) => {
    setActiveRangeIndex(idx);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const handleEpPress = useCallback((ep: Episode) => {
    if (ep.is_premium && user?.subscription_type !== 'premium') {
      Alert.alert('Premium Content', 'Upgrade to premium to watch this episode.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => router.push('/profile') },
      ]);
      return;
    }
    router.push(`/watch/${ep.id}?animeTitle=${encodeURIComponent(animeTitle)}`);
  }, [router, animeTitle, user?.subscription_type]);

  const handleDownloadPress = useCallback((ep: Episode) => {
    router.push(`/watch/${ep.id}?animeTitle=${encodeURIComponent(animeTitle)}&autoDownload=true`);
  }, [router, animeTitle]);

  const renderItem = useCallback(({ item: ep }: { item: Episode }) => {
    const progress = watchProgressMap.get(ep.id);
    return (
      <EpisodeRow
        ep={ep}
        userSubscription={user?.subscription_type}
        isDownloaded={downloadedIds.has(ep.id)}
        isWatched={progress?.is_completed ?? false}
        progressSeconds={progress?.progress_seconds ?? 0}
        onPress={handleEpPress}
        onDownloadPress={handleDownloadPress}
      />
    );
  }, [user?.subscription_type, downloadedIds, watchProgressMap, handleEpPress, handleDownloadPress]);

  const keyExtractor = useCallback((item: Episode) => item.id, []);

  const ItemSeparator = useCallback(() => <View style={styles.separator} />, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    [],
  );

  // Watched count badge in header
  const watchedCount = useMemo(() => {
    if (watchProgressMap.size === 0) return 0;
    return filtered.filter(ep => watchProgressMap.get(ep.id)?.is_completed).length;
  }, [filtered, watchProgressMap]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptic.selection();
            router.back();
          }}
          style={styles.backBtn}
          hitSlop={TOUCH.hitSlop}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerSub}>// EPISODES</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{animeTitle}</Text>
        </View>
        {/* Watched progress badge */}
        {watchedCount > 0 && (
          <View style={styles.watchedBadge}>
            <Ionicons name="checkmark-circle" size={13} color={COLORS.success} />
            <Text style={styles.watchedBadgeText}>{watchedCount}/{filtered.length}</Text>
          </View>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(['all', 'free', 'premium'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => {
              haptic.selection();
              setFilter(f);
              setActiveRangeIndex(0);
              listRef.current?.scrollToOffset({ offset: 0, animated: false });
            }}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.episodeCount}>{filtered.length} eps</Text>
      </View>

      {/* Range navigator — only shown when there are > RANGE_SIZE episodes */}
      {useRanges && !loading && (
        <View style={styles.rangeBar}>
          <Ionicons name="albums-outline" size={13} color={COLORS.textMuted} style={{ marginRight: 6 }} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rangeScroll}
          >
            {ranges.map((range, idx) => {
              // Count watched episodes in this range
              const rangeEps = filtered.slice(range.start, range.end + 1);
              const rangeWatched = rangeEps.filter(ep => watchProgressMap.get(ep.id)?.is_completed).length;
              const allWatched = rangeWatched === rangeEps.length;
              const isActive = idx === activeRangeIndex;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.rangeChip,
                    isActive && styles.rangeChipActive,
                    allWatched && !isActive && styles.rangeChipWatched,
                  ]}
                  onPress={() => {
                    haptic.selection();
                    handleRangeChange(idx);
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                >
                  {allWatched && !isActive && (
                    <Ionicons name="checkmark" size={10} color={COLORS.success} style={{ marginRight: 3 }} />
                  )}
                  <Text style={[
                    styles.rangeChipText,
                    isActive && styles.rangeChipTextActive,
                    allWatched && !isActive && styles.rangeChipTextWatched,
                  ]}>
                    {range.label}
                  </Text>
                  {rangeWatched > 0 && !allWatched && (
                    <View style={[styles.rangeProgressDot, { opacity: isActive ? 1 : 0.6 }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={COLORS.neon} style={{ marginTop: SPACING.xl }} />
      ) : (
        <FlatList
          ref={listRef}
          data={visibleEpisodes}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ItemSeparatorComponent={ItemSeparator}
          getItemLayout={getItemLayout}
          removeClippedSubviews
          windowSize={5}
          maxToRenderPerBatch={10}
          initialNumToRender={15}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="film-outline" size={36} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No episodes in this range</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── MEMOIZED EPISODE ROW ─────────────────────────────────────────────────────
interface EpisodeRowProps {
  ep: Episode;
  userSubscription?: string;
  isDownloaded: boolean;
  isWatched: boolean;
  progressSeconds: number;
  onPress: (ep: Episode) => void;
  onDownloadPress: (ep: Episode) => void;
}

const EpisodeRow = React.memo(
  ({ ep, userSubscription, isDownloaded, isWatched, progressSeconds, onPress, onDownloadPress }: EpisodeRowProps) => {
    const isLocked = ep.is_premium && userSubscription !== 'premium';
    const isInProgress = !isWatched && progressSeconds > 5;
    const progressRatio = ep.duration && ep.duration > 0 ? Math.min(progressSeconds / ep.duration, 1) : 0;

    return (
      <View style={[styles.epRow, isWatched && styles.epRowWatched]}>
        <TouchableOpacity
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.md }}
          onPress={() => onPress(ep)}
        >
          <View style={styles.epLeft}>
            <View style={[
              styles.epNumBox,
              ep.is_premium && styles.epNumBoxPremium,
              isWatched && styles.epNumBoxWatched,
            ]}>
              {isWatched ? (
                <Ionicons name="checkmark" size={18} color={COLORS.success} />
              ) : ep.is_premium ? (
                <Ionicons name="star" size={14} color={COLORS.neonGold} />
              ) : (
                <Text style={styles.epNumText}>{ep.episode_number}</Text>
              )}
              {isInProgress && progressRatio > 0 && (
                <View style={styles.epProgressBg}>
                  <View style={[styles.epProgressFill, { width: `${Math.round(progressRatio * 100)}%` as any }]} />
                </View>
              )}
            </View>
          </View>

          <View style={styles.epMid}>
            <Text style={[styles.epTitle, isWatched && styles.epTitleWatched]} numberOfLines={1}>
              {ep.title || `Episode ${ep.episode_number}`}
            </Text>
            <View style={styles.epMetaRow}>
              {ep.duration && <Text style={styles.epMeta}>{Math.round(ep.duration / 60)}m</Text>}
              {ep.air_date && <Text style={styles.epMeta}>• {ep.air_date}</Text>}
              {ep.is_premium && <Text style={[styles.epMeta, { color: COLORS.neonGold }]}>• PREMIUM</Text>}
              {isWatched && <Text style={[styles.epMeta, { color: COLORS.success }]}>• Watched</Text>}
              {isInProgress && (
                <Text style={[styles.epMeta, { color: COLORS.neon }]}>
                  • {Math.floor(progressSeconds / 60)}m watched
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        {/* Right action icons */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {isDownloaded ? (
            <View style={styles.downloadedBadge}>
              <Ionicons name="cloud-done" size={18} color={COLORS.neonCyan} />
            </View>
          ) : (
            userSubscription === 'premium' && (
              <TouchableOpacity onPress={() => onDownloadPress(ep)} style={styles.epDownloadBtn}>
                <Ionicons name="cloud-download-outline" size={18} color={COLORS.textSub} />
              </TouchableOpacity>
            )
          )}

          {isLocked
            ? <Ionicons name="lock-closed-outline" size={18} color={COLORS.neonGold} />
            : (
              <TouchableOpacity onPress={() => onPress(ep)}>
                <Ionicons
                  name={isWatched ? 'play-circle' : 'play-circle-outline'}
                  size={24}
                  color={isWatched ? COLORS.success : COLORS.neon}
                />
              </TouchableOpacity>
            )
          }
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.ep.id === nextProps.ep.id &&
      prevProps.userSubscription === nextProps.userSubscription &&
      prevProps.isDownloaded === nextProps.isDownloaded &&
      prevProps.isWatched === nextProps.isWatched &&
      prevProps.progressSeconds === nextProps.progressSeconds &&
      prevProps.ep.episode_number === nextProps.ep.episode_number &&
      prevProps.ep.title === nextProps.ep.title &&
      prevProps.ep.is_premium === nextProps.ep.is_premium
    );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md,
  },
  headerContent: { flex: 1 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerSub: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 18, color: COLORS.text, fontWeight: '800' },
  watchedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    backgroundColor: 'rgba(0,245,180,0.1)',
    borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: 'rgba(0,245,180,0.3)',
  },
  watchedBadgeText: { fontSize: 11, color: COLORS.success, fontWeight: '700' },

  // ── Filter chips ────────────────────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.sm,
  },
  filterChip: {
    paddingVertical: 6, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  filterChipActive: { borderColor: COLORS.neon, backgroundColor: 'rgba(255,43,60,0.15)' },
  filterText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 1 },
  filterTextActive: { color: COLORS.neon },
  episodeCount: { fontSize: 12, color: COLORS.textMuted, marginLeft: 'auto' },

  // ── Range navigator ─────────────────────────────────────────────────────────
  rangeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: SPACING.md,
    marginBottom: SPACING.sm,
    minHeight: 38,
  },
  rangeScroll: {
    gap: SPACING.xs,
    paddingRight: SPACING.md,
  },
  rangeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  rangeChipActive: {
    borderColor: COLORS.neon,
    backgroundColor: 'rgba(255,43,60,0.18)',
  },
  rangeChipWatched: {
    borderColor: 'rgba(0,245,180,0.35)',
    backgroundColor: 'rgba(0,245,180,0.07)',
  },
  rangeChipText: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5,
    color: COLORS.textMuted,
  },
  rangeChipTextActive: { color: COLORS.neon },
  rangeChipTextWatched: { color: COLORS.success },
  rangeProgressDot: {
    width: 5, height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.neon,
    marginLeft: 5,
  },

  // ── Episode list ────────────────────────────────────────────────────────────
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.xxl, gap: SPACING.sm,
  },
  emptyText: { fontSize: 14, color: COLORS.textMuted },

  // ── Episode row ─────────────────────────────────────────────────────────────
  epRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  epRowWatched: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.success,
    paddingLeft: SPACING.sm,
  },
  downloadedBadge: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  epDownloadBtn: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  epLeft: {},
  epNumBox: {
    width: 40, height: 40, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,43,60,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
    position: 'relative',
  },
  epNumBoxPremium: {
    backgroundColor: 'rgba(255,214,0,0.1)',
    borderColor: 'rgba(255,214,0,0.3)',
  },
  epNumBoxWatched: {
    backgroundColor: 'rgba(0,245,180,0.12)',
    borderColor: 'rgba(0,245,180,0.5)',
  },
  epProgressBg: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: 'rgba(255,43,60,0.2)',
  },
  epProgressFill: {
    height: 3,
    backgroundColor: COLORS.neon,
  },
  epNumText: { fontSize: 14, color: COLORS.neon, fontWeight: '700' },
  epMid: { flex: 1 },
  epTitle: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  epTitleWatched: { color: COLORS.textSub },
  epMetaRow: { flexDirection: 'row', gap: 4, marginTop: 3, flexWrap: 'wrap' },
  epMeta: { fontSize: 11, color: COLORS.textMuted },
  separator: { height: 1, backgroundColor: COLORS.border },
});
