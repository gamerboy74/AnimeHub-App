import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { AnimeWithStats, userAPI } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useTrendingAnime, useTopRatedAnime, useRecentAnime, useGenreAnime, fetchGenreAnime } from '../../src/hooks/useQueries';
import { usePrefetch } from '../../src/hooks/usePrefetch';
import HeroCarousel from '../../src/components/ui/HeroCarousel';
import AnimeCard from '../../src/components/ui/AnimeCard';
import SectionHeader from '../../src/components/ui/SectionHeader';
import SubscriptionExpiryBanner from '../../src/components/subscription/SubscriptionExpiryBanner';
import { haptic } from '../../src/lib/haptics';

const POPULAR_GENRES = [
  { name: 'Action', color: '#FF7346', tagline: 'High-octane battles & adrenaline' },
  { name: 'Fantasy', color: '#FF4757', tagline: 'Mythical realms, beasts & magic' },
  { name: 'Sci-Fi', color: '#00F5FF', tagline: 'Futuristic worlds & cyberpunk' },
  { name: 'Romance', color: '#FF2D78', tagline: 'Heartfelt emotional stories' },
  { name: 'Adventure', color: '#FFB830', tagline: 'Epic quests & uncharted lands' },
  { name: 'Comedy', color: '#FFE54C', tagline: 'Hilarious moments & non-stop laughs' },
];

// ── HERO CAROUSEL INTERVAL (ms) ───────────────────────────────────────────────
const HERO_SLIDE_COUNT = 5;

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
  const { data: fantasyAnime = [] } = useGenreAnime('Fantasy', 10);

  // ── User Watch History (Continue Watching) ─────────────────────────────────────────
  const { data: progressData = [] } = useQuery<any[]>({
    queryKey: ['user', user?.id, 'history'],
    enabled: !!user?.id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await userAPI.getProgress(user.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const continueWatching = useMemo(() => {
    if (!user?.id || !progressData.length) return [];
    const unique = progressData.filter((p: any, index: number, self: any[]) =>
      index === self.findIndex((t: any) => t.anime_id === p.anime_id)
    );
    return unique
      .filter((p: any) => {
        const isCompleted = p.is_completed && p.total_episodes && p.episode_number === p.total_episodes;
        if (isCompleted) return false;
        if (!p.last_watched) return false;
        const lastWatchedDate = new Date(p.last_watched).getTime();
        const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        return lastWatchedDate >= fourteenDaysAgo;
      })
      .slice(0, 10);
  }, [user?.id, progressData]);

  // ── Hero carousel — top N trending anime that have a banner or poster ──────────────
  const heroSlides = useMemo(
    () => trending.filter(a => !!(a.banner_url || a.poster_url)).slice(0, HERO_SLIDE_COUNT),
    [trending],
  );

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
      queryClient.invalidateQueries({ queryKey: ['anime', 'genre-popular'] }),
      user?.id ? queryClient.invalidateQueries({ queryKey: ['user', user.id, 'history'] }) : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [queryClient, user?.id]);

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
      {/* Safe-area top space so content never sits behind the status bar */}
      <View style={{ height: insets.top > 0 ? insets.top + SPACING.xs : SPACING.md }} />

      {/* Subscription Expiry Reminder Banner (renders only if user's subscription expires in <= 2 days) */}
      <SubscriptionExpiryBanner />

      {/* ── Auto-Rotating Hero Paging Carousel (Isolated & Optimized) ── */}
      {heroSlides.length > 0 && (
        <HeroCarousel slides={heroSlides} />
      )}

      {/* ── Continue Watching (Quick Jump Back In) ── */}
      {continueWatching.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.continueSectionSub}>RESUME PLAYBACK</Text>
              <Text style={styles.sectionLabel}>Continue Watching</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/library')} activeOpacity={0.7}>
              <Text style={styles.seeAll}>VIEW ALL →</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.continueScroll}
            scrollEventThrottle={100}
          >
            {continueWatching.map((item: any) => {
              const progress = item.episode_duration > 0
                ? (item.progress_seconds / item.episode_duration) * 100
                : item.progress_percentage || 0;
              return (
                <ContinueCard
                  key={item.id || item.episode_id}
                  item={item}
                  progress={progress}
                  onPress={() => item.episode_id && router.push(`/watch/${item.episode_id}`)}
                />
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Trending */}
      <AnimeRow
        title="TRENDING"
        subtitle="TOP PICKS THIS WEEK"
        data={trending}
        router={router}
        seeAllRoute="/trending"
      />

      {/* Popular Genres Spotlight */}
      <PopularGenresSection />

      {/* Top Rated */}
      <AnimeRow
        title="TOP RATED"
        subtitle="HIGHEST COMMUNITY SCORES"
        data={topRated}
        router={router}
        showStats
        seeAllRoute="/top-rated"
      />

      {/* Curated Genre Row: Fantasy & Magic */}
      <AnimeRow
        title="FANTASY & MAGIC"
        subtitle="MYTHICAL REALMS & LEGENDS"
        data={fantasyAnime}
        router={router}
        showStats
        seeAllRoute="/genre/Fantasy"
      />

      {/* Recently Added */}
      <AnimeRow
        title="NEW ARRIVALS"
        subtitle="RECENT RELEASES"
        data={recent}
        router={router}
        seeAllRoute="/new-arrivals"
      />
    </ScrollView>
  );
}

// ─── MEMOIZED CONTINUE WATCHING CARD ──────────────────────────────────────────
interface ContinueCardProps {
  item: any;
  progress: number;
  onPress: () => void;
}

const ContinueCard = React.memo(
  ({ item, progress, onPress }: ContinueCardProps) => (
    <TouchableOpacity
      style={styles.continueCard}
      activeOpacity={0.88}
      onPress={onPress}
    >
      <View style={styles.continueThumbBox}>
        <Image
          source={{ uri: item.thumbnail_url || item.poster_url }}
          style={styles.continueThumb}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.continueOverlay} />
        <LinearGradient
          colors={['transparent', 'rgba(8,8,16,0.6)', 'rgba(8,8,16,0.95)']}
          locations={[0.2, 0.65, 1]}
          style={styles.continueBottomGrad}
        />
        <View style={styles.continuePlayBox}>
          <Ionicons name="play" size={14} color="#000" />
        </View>
        <View style={styles.continueProgressBox}>
          <View style={styles.continueProgressBg}>
            <View style={[styles.continueProgressFill, { width: `${Math.min(progress, 100)}%` }]} />
          </View>
            <View style={styles.continueProgressLabels}>
                    <Text style={styles.continueProgressEp}>EP {item.episode_number}</Text>
                    <Text style={styles.continueProgressPercent}>
                      {item.episode_duration > 0
                        ? `${Math.max(0, Math.ceil((item.episode_duration - item.progress_seconds) / 60))}m left`
                        : `${Math.round(progress)}%`}
                    </Text>
                  </View>
        </View>
      </View>
      <Text style={styles.continueCardTitle} numberOfLines={1}>
        {item.anime_title || item.title}
      </Text>
      <Text style={styles.continueCardSub} numberOfLines={1}>
        {item.episode_title ? `EP ${item.episode_number} • ${item.episode_title}` : `Episode ${item.episode_number}`}
      </Text>
    </TouchableOpacity>
  ),
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item.episode_id === next.item.episode_id &&
    Math.floor(prev.progress) === Math.floor(next.progress)
);

// ─── MEMOIZED LOCAL ANIME CARD WRAPPER ─────────────────────────────────────────
interface HomeAnimeCardProps {
  item: AnimeWithStats;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
  showStats: boolean;
}

const HomeAnimeCard = React.memo(
  ({ item, onPress, onLongPress, showStats }: HomeAnimeCardProps) => {
    return (
      <AnimeCard
        anime={item}
        onPress={onPress}
        onLongPress={() => onLongPress(item.id)}
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

    // One hook call per list row — not per card. Cards receive a stable callback.
    const { prefetchAnime } = usePrefetch();

    const handleCardPress = useCallback((id: string) => {
      router.push(`/anime/${id}`);
    }, [router]);

    const handleLongPress = useCallback((id: string) => {
      prefetchAnime(id);
    }, [prefetchAnime]);

    const renderItem = useCallback(({ item }: { item: any }) => (
      <HomeAnimeCard
        item={item}
        onPress={handleCardPress}
        onLongPress={handleLongPress}
        showStats={showStats}
      />
    ), [handleCardPress, handleLongPress, showStats]);

    const keyExtractor = useCallback((item: any) => item.id, []);

    return (
      <View style={styles.section}>
        <SectionHeader
          label={subtitle}
          title={title}
          onSeeAll={seeAllRoute ? () => router.push(seeAllRoute) : undefined}
        />
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

// ─── POPULAR GENRES SPOTLIGHT ────────────────────────────────────────────────
const PopularGenresSection = React.memo(() => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedGenre, setSelectedGenre] = useState('Action');
  const { data: animeList = [], isLoading } = useGenreAnime(selectedGenre, 10);
  const { prefetchAnime } = usePrefetch();

  // Silently warm TanStack cache for other popular genres on idle so tab switches are instant
  useEffect(() => {
    const timer = setTimeout(() => {
      POPULAR_GENRES.forEach((g) => {
        if (g.name !== 'Action') {
          queryClient.prefetchQuery({
            queryKey: ['anime', 'genre-popular', g.name, 10],
            staleTime: 10 * 60 * 1000,
            queryFn: () => fetchGenreAnime(g.name, 10),
          });
        }
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [queryClient]);

  const activeMeta = useMemo(
    () => POPULAR_GENRES.find((g) => g.name === selectedGenre) || POPULAR_GENRES[0],
    [selectedGenre]
  );

  const handleCardPress = useCallback((id: string) => {
    router.push(`/anime/${id}`);
  }, [router]);

  const handleLongPress = useCallback((id: string) => {
    prefetchAnime(id);
  }, [prefetchAnime]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <HomeAnimeCard
      item={item}
      onPress={handleCardPress}
      onLongPress={handleLongPress}
      showStats
    />
  ), [handleCardPress, handleLongPress]);

  const keyExtractor = useCallback((item: any) => item.id, []);

  return (
    <View style={styles.section}>
      <SectionHeader
        label="CURATED DISCOVERY"
        title="POPULAR GENRES"
        onSeeAll={() => router.push('/genre')}
        seeAllLabel="ALL GENRES →"
      />

      {/* Interactive Genre Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.popularGenreChips}
      >
        {POPULAR_GENRES.map((g) => {
          const isSelected = g.name === selectedGenre;
          return (
            <TouchableOpacity
              key={g.name}
              style={[
                styles.popularGenreChip,
                isSelected && {
                  borderColor: g.color,
                  backgroundColor: `${g.color}22`,
                },
              ]}
              onPress={() => {
                haptic.selection();
                setSelectedGenre(g.name);
              }}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.popularGenreChipText,
                  isSelected && [styles.popularGenreChipTextActive, { color: g.color }],
                ]}
              >
                {g.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Dynamic Subheader: Tagline & View Specific Genre */}
      <View style={styles.genreSubheaderRow}>
        <Text style={styles.genreSubheaderTagline} numberOfLines={1}>
          {activeMeta.tagline}
        </Text>
        <TouchableOpacity
          onPress={() => router.push(`/genre/${selectedGenre}`)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.genreSubheaderLink, { color: activeMeta.color }]}>
            VIEW ALL {selectedGenre.toUpperCase()} →
          </Text>
        </TouchableOpacity>
      </View>

      {/* Anime Carousel */}
      {isLoading ? (
        <View style={styles.genreLoadingContainer}>
          <ActivityIndicator size="small" color={activeMeta.color} />
        </View>
      ) : (
        <FlatList
          horizontal
          data={animeList}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ paddingLeft: SPACING.md, paddingRight: SPACING.sm }}
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews
          windowSize={3}
          maxToRenderPerBatch={5}
          initialNumToRender={5}
          ListFooterComponent={
            animeList.length > 0 ? (
              <TouchableOpacity
                style={styles.moreGenreCard}
                onPress={() => router.push(`/genre/${selectedGenre}`)}
                activeOpacity={0.8}
              >
                <View style={[styles.moreGenreIconCircle, { borderColor: `${activeMeta.color}66` }]}>
                  <Ionicons name="arrow-forward" size={20} color={activeMeta.color} />
                </View>
                <Text style={styles.moreGenreTitle}>More {selectedGenre}</Text>
                <Text style={styles.moreGenreSub}>View All</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
});

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



  section: { marginBottom: SPACING.lg },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md, marginBottom: SPACING.sm,
  },
  sectionLabel: {
    fontSize: 14, color: COLORS.text,
    fontWeight: '800', letterSpacing: 1.5,
  },
  sectionSub: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 1 },
  seeAll: { fontSize: 10, color: COLORS.textSub, letterSpacing: 1 },

  genreSectionTag: {
    fontSize: 9,
    color: COLORS.neonCyan,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 2,
  },
  popularGenreChips: {
    paddingHorizontal: SPACING.md,
    gap: 8,
    paddingBottom: 4,
  },
  popularGenreChip: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  popularGenreChipText: {
    fontSize: 12,
    color: COLORS.textSub,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  popularGenreChipTextActive: {
    fontWeight: '700',
  },
  genreSubheaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginTop: 6,
    marginBottom: SPACING.sm,
  },
  genreSubheaderTagline: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    flex: 1,
    marginRight: SPACING.sm,
  },
  genreSubheaderLink: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  genreLoadingContainer: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreGenreCard: {
    width: 120,
    height: 160 * 1.45,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.xs,
    marginRight: SPACING.md,
    padding: SPACING.sm,
  },
  moreGenreIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  moreGenreTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  moreGenreSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },

  continueSectionSub: {
    fontSize: 9,
    color: COLORS.neonPulse || COLORS.neonCyan,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 2,
  },
  continueScroll: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  continueCard: {
    width: 240,
  },
  continueThumbBox: {
    aspectRatio: 16 / 9,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    position: 'relative',
  },
  continueThumb: {
    ...StyleSheet.absoluteFillObject,
  },
  continueOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,16,0.18)',
  },
  continueBottomGrad: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  continuePlayBox: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.neon,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.neon,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  continueProgressBox: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  continueProgressBg: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  continueProgressFill: {
    height: '100%',
    backgroundColor: COLORS.neonCyan,
    shadowColor: COLORS.neonCyan,
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  continueProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  continueProgressEp: {
    fontSize: 9,
    color: COLORS.text,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  continueProgressPercent: {
    fontSize: 9,
    color: COLORS.neonCyan,
    fontWeight: '700',
  },
  continueCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 6,
  },
  continueCardSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
});
