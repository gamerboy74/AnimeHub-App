import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, FlatList,
  TouchableOpacity, Dimensions, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { AnimeWithStats } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useTrendingAnime, useTopRatedAnime, useRecentAnime, useHeroAnime } from '../../src/hooks/useQueries';
import { usePrefetch } from '../../src/hooks/usePrefetch';
import AnimeCard from '../../src/components/ui/AnimeCard';

const { width } = Dimensions.get('window');

const GENRES = ['Action', 'Romance', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Sci-Fi', 'Slice of Life', 'Sports', 'Mystery'];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { prefetchAnimeList } = usePrefetch();
  const [refreshing, setRefreshing] = useState(false);

  // ── TanStack Query — cached; no re-fetch on tab switch within staleTime ────────────
  const { data: trending = [], isLoading: loadingTrend } = useTrendingAnime();
  const { data: topRated = [], isLoading: loadingRated } = useTopRatedAnime();
  const { data: recent = [], isLoading: loadingRecent } = useRecentAnime();

  // Hero: first trending item that has a banner_url (guaranteed by useHeroAnime)
  const { data: hero } = useHeroAnime();

  const loading = loadingTrend || loadingRated || loadingRecent;

  // Silently warm the cache for the top 5 visible cards while the user
  // looks at the hero section — navigation feels instant afterward
  useEffect(() => {
    if (trending.length > 0) {
      prefetchAnimeList(trending.map(a => a.id), 5);
    }
  }, [trending, prefetchAnimeList]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['anime', 'trending'] }),
      queryClient.invalidateQueries({ queryKey: ['anime', 'top-rated'] }),
      queryClient.invalidateQueries({ queryKey: ['anime', 'new-arrivals'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  // Only block full render on trending (needed for hero section).
  // Top-rated and recent render progressively via AnimeRow (returns null if empty).
  if (loadingTrend) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.neon} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.neon} />}
    >
      {/* Space for Universal Header overlap if needed, otherwise start content */}
      <View style={{ height: SPACING.md }} />

      {/* Hero Banner */}
      {hero && (
        <TouchableOpacity
          style={styles.hero}
          onPress={() => router.push(`/anime/${hero.id}`)}
          activeOpacity={0.92}
        >
          <Image
            source={{ uri: hero.banner_url || hero.poster_url || '' }}
            style={styles.heroBg}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.heroOverlay} />
          {/* Scan line effect */}
          <View style={styles.scanLines} />

          <View style={styles.heroContent}>
            <View style={styles.heroTrendingBadge}>
              <View style={styles.trendingDot} />
              <Text style={styles.trendingText}>// TRENDING NOW</Text>
            </View>
            <Text style={styles.heroTitle}>{hero.title}</Text>
            {hero.title_japanese && (
              <Text style={styles.heroTitleJp}>{hero.title_japanese}</Text>
            )}
            <View style={styles.heroMeta}>
              {hero.year && <Text style={styles.heroMetaText}>{hero.year}</Text>}
              {hero.type && <Text style={styles.heroMetaText}>• {hero.type}</Text>}
              {hero.status && <Text style={styles.heroMetaText}>• {hero.status}</Text>}
              {hero.user_rating_avg && (
                <View style={styles.heroRating}>
                  <Ionicons name="star" size={12} color={COLORS.neonGold} />
                  <Text style={styles.heroRatingText}>{Number(hero.user_rating_avg).toFixed(1)}</Text>
                </View>
              )}
            </View>
            <View style={styles.heroButtons}>
              <TouchableOpacity
                style={styles.playBtn}
                onPress={() => router.push(`/anime/episodes/${hero.id}`)}
              >
                <Ionicons name="play" size={16} color={COLORS.bg} />
                <Text style={styles.playBtnText}>PLAY NOW</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.infoBtn}
                onPress={() => router.push(`/anime/${hero.id}`)}
              >
                <Ionicons name="information-circle-outline" size={16} color={COLORS.neon} />
                <Text style={styles.infoBtnText}>MORE INFO</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Neon corner accent */}
          <View style={styles.heroCornerTL} />
          <View style={styles.heroCornerBR} />
        </TouchableOpacity>
      )}

      {/* Genre Pills */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>// GENRES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genrePills}>
          {GENRES.map((g) => (
            <TouchableOpacity
              key={g}
              style={styles.genrePill}
              onPress={() => router.push(`/genre/${g}`)}
            >
              <Text style={styles.genrePillText}>{g}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Trending */}
      <AnimeRow
        title="// TRENDING"
        subtitle="TRENDING"
        data={trending}
        router={router}
        seeAllRoute="/trending"
      />

      {/* Top Rated */}
      <AnimeRow
        title="// TOP RATED"
        subtitle="TOP RATED"
        data={topRated}
        router={router}
        showStats
        seeAllRoute="/top-rated"
      />

      {/* Recently Added */}
      <AnimeRow
        title="// NEW ARRIVALS"
        subtitle="RECENT"
        data={recent}
        router={router}
        seeAllRoute="/new-arrivals"
      />
    </ScrollView>
  );
}

// ─── MEMOIZED LOCAL ANIME CARD WRAPPER ─────────────────────────────────────────
interface HomeAnimeCardProps {
  item: AnimeWithStats;
  router: any;
  showStats: boolean;
}

const HomeAnimeCard = React.memo(
  ({ item, router, showStats }: HomeAnimeCardProps) => {
    return (
      <AnimeCard
        anime={item}
        onPress={() => router.push(`/anime/${item.id}`)}
        showStats={showStats}
      />
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.showStats === nextProps.showStats
    );
  }
);

// ─── MEMOIZED ANIME ROW ────────────────────────────────────────────────────────
const AnimeRow = React.memo(
  ({ title, subtitle, data, router, showStats = false, seeAllRoute }: any) => {
    if (!data?.length) return null;

    const renderItem = useCallback(({ item }: { item: any }) => (
      <HomeAnimeCard
        item={item}
        router={router}
        showStats={showStats}
      />
    ), [router, showStats]);

    const keyExtractor = useCallback((item: any) => item.id, []);

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionLabel}>{title}</Text>
            <Text style={styles.sectionSub}>{subtitle}</Text>
          </View>
          <TouchableOpacity onPress={() => seeAllRoute && router.push(seeAllRoute)}>
            <Text style={styles.seeAll}>SEE ALL →</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          horizontal
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ paddingLeft: SPACING.md, paddingRight: SPACING.sm }}
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews
          windowSize={3}
          maxToRenderPerBatch={5}
          initialNumToRender={5}
        />
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.title === nextProps.title &&
      prevProps.subtitle === nextProps.subtitle &&
      prevProps.data === nextProps.data &&
      prevProps.showStats === nextProps.showStats &&
      prevProps.seeAllRoute === nextProps.seeAllRoute
    );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: {
    flex: 1, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center', gap: SPACING.md,
  },
  loadingText: { color: COLORS.textSub, fontSize: 12, letterSpacing: 2 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  headerGreeting: { fontSize: 22, color: COLORS.text, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { fontSize: 10, color: COLORS.neon, letterSpacing: 3, marginTop: 2, fontWeight: '600' },
  headerRight: { flexDirection: 'row', gap: SPACING.xs },
  iconBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  hero: {
    marginHorizontal: SPACING.md,
    height: 420,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  heroBg: { ...StyleSheet.absoluteFillObject },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,16,0.55)',
  },
  scanLines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: SPACING.lg,
    backgroundColor: 'rgba(8,8,16,0.7)',
  },
  heroTrendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.xs,
  },
  trendingDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: COLORS.neonPink,
  },
  trendingText: {
    fontSize: 10, color: COLORS.neonPink,
    fontWeight: '700', letterSpacing: 2,
  },
  heroTitle: {
    fontSize: 26, color: COLORS.text,
    fontWeight: '900', letterSpacing: -0.5,
    lineHeight: 30,
  },
  heroTitleJp: {
    fontSize: 13, color: COLORS.textSub,
    marginTop: 4, letterSpacing: 1,
  },
  heroMeta: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginTop: SPACING.xs, flexWrap: 'wrap',
  },
  heroMetaText: { fontSize: 11, color: COLORS.textSub },
  heroRating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  heroRatingText: { fontSize: 11, color: COLORS.neonGold, fontWeight: '700' },
  heroButtons: {
    flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md,
  },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.neon,
    paddingVertical: 10, paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
  },
  playBtnText: { color: COLORS.bg, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  infoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: COLORS.neon,
    paddingVertical: 10, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(191,95,255,0.1)',
  },
  infoBtnText: { color: COLORS.neon, fontWeight: '700', fontSize: 12, letterSpacing: 1 },

  heroCornerTL: {
    position: 'absolute', top: 0, left: 0,
    width: 24, height: 24,
    borderTopWidth: 2, borderLeftWidth: 2,
    borderColor: COLORS.neon,
    borderTopLeftRadius: RADIUS.lg,
  },
  heroCornerBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24,
    borderBottomWidth: 2, borderRightWidth: 2,
    borderColor: COLORS.neonPink,
    borderBottomRightRadius: RADIUS.lg,
  },

  section: { marginBottom: SPACING.lg },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md, marginBottom: SPACING.sm,
  },
  sectionLabel: {
    fontSize: 13, color: COLORS.neon,
    fontWeight: '800', letterSpacing: 2,
  },
  sectionSub: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 1 },
  seeAll: { fontSize: 10, color: COLORS.textSub, letterSpacing: 1 },

  genrePills: { paddingHorizontal: SPACING.md, gap: SPACING.xs },
  genrePill: {
    paddingVertical: 7, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.border,
  },
  genrePillText: {
    fontSize: 12, color: COLORS.textSub,
    fontWeight: '600', letterSpacing: 0.5,
  },
});
