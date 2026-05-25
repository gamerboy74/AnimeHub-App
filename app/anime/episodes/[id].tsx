import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../../../src/constants/theme';
import { Episode } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { useEpisodes } from '../../../src/hooks/useQueries';
import { getAllDownloads } from '../../../src/hooks/useHlsDownloader';

// Row height must match epRow.paddingVertical + content height + separator
const ITEM_HEIGHT = 56; // paddingVertical * 2 + ~24 content
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

  const [filter, setFilter] = useState<'all' | 'free' | 'premium'>('all');
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());

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

  // Alert only when error status actually changes (not on every render)
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

  const filtered = useMemo(
    () => episodes.filter(ep =>
      filter === 'all' ? true : filter === 'free' ? !ep.is_premium : ep.is_premium
    ),
    [episodes, filter],
  );

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

  const renderItem = useCallback(({ item: ep }: { item: Episode }) => (
    <EpisodeRow
      ep={ep}
      userSubscription={user?.subscription_type}
      isDownloaded={downloadedIds.has(ep.id)}
      onPress={handleEpPress}
      onDownloadPress={handleDownloadPress}
    />
  ), [user?.subscription_type, downloadedIds, handleEpPress, handleDownloadPress]);

  const keyExtractor = useCallback((item: Episode) => item.id, []);

  // Static component — no deps, no need for useCallback
  const ItemSeparator = () => <View style={styles.separator} />;

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: (ITEM_HEIGHT + SEPARATOR_HEIGHT) * index,
      index,
    }),
    [],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerSub}>// EPISODES</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>{animeTitle}</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'free', 'premium'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.episodeCount}>{filtered.length} eps</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.neon} style={{ marginTop: SPACING.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ItemSeparatorComponent={ItemSeparator}
          getItemLayout={getItemLayout}
          removeClippedSubviews
          windowSize={5}
          maxToRenderPerBatch={8}
          initialNumToRender={10}
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
  onPress: (ep: Episode) => void;
  onDownloadPress: (ep: Episode) => void;
}

const EpisodeRow = React.memo(
  ({ ep, userSubscription, isDownloaded, onPress, onDownloadPress }: EpisodeRowProps) => {
    const isLocked = ep.is_premium && userSubscription !== 'premium';
    return (
      <View style={styles.epRow}>
        <TouchableOpacity 
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.md }} 
          onPress={() => onPress(ep)}
        >
          <View style={styles.epLeft}>
            <View style={[styles.epNumBox, ep.is_premium && styles.epNumBoxPremium]}>
              {ep.is_premium
                ? <Ionicons name="star" size={14} color={COLORS.neonGold} />
                : <Text style={styles.epNumText}>{ep.episode_number}</Text>
              }
            </View>
          </View>
          <View style={styles.epMid}>
            <Text style={styles.epTitle} numberOfLines={1}>
              {ep.title || `Episode ${ep.episode_number}`}
            </Text>
            <View style={styles.epMetaRow}>
              {ep.duration && <Text style={styles.epMeta}>{Math.round(ep.duration / 60)}m</Text>}
              {ep.air_date && <Text style={styles.epMeta}>• {ep.air_date}</Text>}
              {ep.is_premium && <Text style={[styles.epMeta, { color: COLORS.neonGold }]}>• PREMIUM</Text>}
            </View>
          </View>
        </TouchableOpacity>

        {/* Action icons row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {isDownloaded ? (
            <View style={styles.downloadedBadge}>
              <Ionicons name="cloud-done" size={18} color={COLORS.neonCyan} />
            </View>
          ) : (
            !isLocked && (
              <TouchableOpacity onPress={() => onDownloadPress(ep)} style={styles.epDownloadBtn}>
                <Ionicons name="cloud-download-outline" size={18} color={COLORS.textSub} />
              </TouchableOpacity>
            )
          )}

          {isLocked
            ? <Ionicons name="lock-closed-outline" size={18} color={COLORS.neonGold} />
            : (
              <TouchableOpacity onPress={() => onPress(ep)}>
                <Ionicons name="play-circle-outline" size={24} color={COLORS.neon} />
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
      prevProps.ep.episode_number === nextProps.ep.episode_number &&
      prevProps.ep.title === nextProps.ep.title &&
      prevProps.ep.is_premium === nextProps.ep.is_premium
    );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  headerContent: { flex: 1 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerSub: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 18, color: COLORS.text, fontWeight: '800' },
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.md,
  },
  filterChip: {
    paddingVertical: 6, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  filterChipActive: { borderColor: COLORS.neon, backgroundColor: 'rgba(191,95,255,0.15)' },
  filterText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 1 },
  filterTextActive: { color: COLORS.neon },
  episodeCount: { fontSize: 12, color: COLORS.textMuted, marginLeft: 'auto' },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  epRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  downloadedBadge: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  epDownloadBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  epLeft: {},
  epNumBox: {
    width: 40, height: 40, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(191,95,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  epNumBoxPremium: {
    backgroundColor: 'rgba(255,214,0,0.1)',
    borderColor: 'rgba(255,214,0,0.3)',
  },
  epNumText: { fontSize: 14, color: COLORS.neon, fontWeight: '700' },
  epMid: { flex: 1 },
  epTitle: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  epMetaRow: { flexDirection: 'row', gap: 4, marginTop: 3 },
  epMeta: { fontSize: 11, color: COLORS.textMuted },
  separator: { height: 1, backgroundColor: COLORS.border },
});
