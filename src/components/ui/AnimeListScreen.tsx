import React, { useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, RADIUS, TOUCH } from '../../constants/theme';
import { AnimeWithStats } from '../../lib/supabase';
import { fetchJikanWithFallback } from '../../lib/jikan';
import { haptic } from '../../lib/haptics';
import AnimeCard, { AnimeCardSkeleton } from './AnimeCard';

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

interface Props { type: ListType }

export default function AnimeListScreen({ type }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width: windowWidth } = useWindowDimensions();
  const cfg = CONFIG[type];

  // Dynamic responsive columns based on viewport
  const numColumns = windowWidth >= 1024 ? 6 : windowWidth >= 768 ? 5 : windowWidth >= 600 ? 4 : 3;
  const horizontalPadding = SPACING.md * 2;
  const totalGaps = (numColumns - 1) * SPACING.xs;
  const itemWidth = Math.floor((windowWidth - horizontalPadding - totalGaps) / numColumns);

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
    <View style={{ width: itemWidth }}>
      <AnimeCard
        anime={item}
        size="sm"
        showStats={type === 'top-rated'}
        style={{ width: itemWidth, marginRight: 0 }}
        onPress={handleCardPress}
      />
    </View>
  ), [handleCardPress, type, itemWidth]);

  const keyExtractor = useCallback((item: AnimeWithStats) => item.id, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            haptic.selection();
            router.back();
          }}
          hitSlop={TOUCH.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
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
        <View style={[styles.list, { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.xs, rowGap: SPACING.md }]}>
          {Array.from({ length: numColumns * 4 }).map((_, i) => (
            <AnimeCardSkeleton
              key={i}
              cardWidth={itemWidth}
              size="sm"
              showStats={type === 'top-rated'}
              style={{ width: itemWidth, marginRight: 0 }}
            />
          ))}
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
          key={`anime-list-${numColumns}`}
          data={animeList}
          keyExtractor={keyExtractor}
          numColumns={numColumns}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    backgroundColor: 'rgba(255,43,60,0.12)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.neon,
  },
  retryText: { color: COLORS.neon, fontWeight: '700' },

  list: { padding: SPACING.md, paddingBottom: 100 },
  row: { justifyContent: 'space-between', marginBottom: SPACING.md },
});
