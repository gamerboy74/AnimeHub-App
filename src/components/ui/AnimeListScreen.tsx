import React, { useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { AnimeWithStats } from '../../lib/supabase';
import { fetchJikanWithFallback } from '../../lib/jikan';
import AnimeCard from './AnimeCard';

export type ListType = 'trending' | 'top-rated' | 'new-arrivals';

const CONFIG: Record<ListType, { title: string; label: string; queryKey: string }> = {
  'trending': {
    title: 'Trending Anime',
    label: '// TRENDING NOW',
    queryKey: 'trending',
  },
  'top-rated': {
    title: 'Top Rated Anime',
    label: '// TOP RATED',
    queryKey: 'top-rated',
  },
  'new-arrivals': {
    title: 'New Arrivals',
    label: '// NEW ARRIVALS',
    queryKey: 'new-arrivals',
  },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
// Calculate item width for 3 columns:
// Padding: SPACING.md (16) on each side, gap between cols: SPACING.xs (8)
const HORIZONTAL_PADDING = SPACING.md * 2;
const TOTAL_GAPS = (NUM_COLUMNS - 1) * SPACING.xs;
const ITEM_WIDTH = Math.floor((SCREEN_WIDTH - HORIZONTAL_PADDING - TOTAL_GAPS) / NUM_COLUMNS);

interface Props { type: ListType }

export default function AnimeListScreen({ type }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const cfg = CONFIG[type];

  // TanStack query — caches results and warms instantly from home cache
  const {
    data: animeList = [],
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useQuery({
    queryKey: ['anime', 'see-all', type],
    queryFn: () => fetchJikanWithFallback(type, 60),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // Provide instant placeholder from home query if available
    placeholderData: () => {
      const homeCache = queryClient.getQueryData<AnimeWithStats[]>(['anime', cfg.queryKey]);
      return homeCache;
    },
  });

  const handleCardPress = useCallback((id: string) => {
    router.push(`/anime/${id}`);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: AnimeWithStats }) => (
    <View style={{ width: ITEM_WIDTH }}>
      <AnimeCard
        anime={item}
        size="sm"
        showStats={type === 'top-rated'}
        style={{ width: ITEM_WIDTH, marginRight: 0 }}
        onPress={handleCardPress}
      />
    </View>
  ), [handleCardPress, type]);

  const keyExtractor = useCallback((item: AnimeWithStats) => item.id, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>{cfg.label}</Text>
          <Text style={styles.headerTitle}>{cfg.title}</Text>
        </View>
        {animeList.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.count}>{animeList.length} titles</Text>
          </View>
        )}
      </View>

      {isLoading && animeList.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.neon} size="large" />
          <Text style={styles.loadingText}>Loading {cfg.title}…</Text>
        </View>
      ) : error && animeList.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.danger} />
          <Text style={styles.errorText}>Could not load anime list.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={animeList}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          windowSize={7}
          maxToRenderPerBatch={9}
          initialNumToRender={12}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={COLORS.neon}
            />
          }
          renderItem={renderItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerLabel: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '800' },
  headerTitle: { fontSize: 20, color: COLORS.text, fontWeight: '900' },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  count: { fontSize: 11, color: COLORS.textSub, fontWeight: '700' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 12, color: COLORS.textMuted },
  errorText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl },
  retryBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(191,95,255,0.12)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.neon,
  },
  retryText: { color: COLORS.neon, fontWeight: '700' },

  list: { padding: SPACING.md, paddingBottom: 100 },
  row: { justifyContent: 'space-between', marginBottom: SPACING.md },
});
