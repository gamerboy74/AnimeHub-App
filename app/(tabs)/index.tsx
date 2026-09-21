import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator,
  Animated, useWindowDimensions,
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
import { useTrendingAnime, useTopRatedAnime, useRecentAnime } from '../../src/hooks/useQueries';
import { usePrefetch } from '../../src/hooks/usePrefetch';
import AnimeCard from '../../src/components/ui/AnimeCard';
import SubscriptionExpiryBanner from '../../src/components/subscription/SubscriptionExpiryBanner';
import { GENRE_NAMES } from '../../src/constants/genres';

const GENRES = GENRE_NAMES;

// ── HERO CAROUSEL INTERVAL (ms) ───────────────────────────────────────────────
const HERO_INTERVAL_MS = 5000;
const HERO_SLIDE_COUNT = 5;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { prefetchAnimeList } = usePrefetch();
  const [refreshing, setRefreshing] = useState(false);

  // ── TanStack Query — cached; no re-fetch on tab switch within staleTime ────────────
  const { data: trending = [], isLoading: loadingTrend } = useTrendingAnime();
  const { data: topRated = [], isLoading: loadingRated } = useTopRatedAnime();
  const { data: recent = [], isLoading: loadingRecent } = useRecentAnime();

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

  const [heroIndex, setHeroIndex] = useState(0);
  const heroIndexRef = useRef(0);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUserScrollingRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);

  // Sync index to ref to avoid stale closures in setInterval without recreating the timer
  useEffect(() => {
    heroIndexRef.current = heroIndex;
  }, [heroIndex]);

  // Silently warm the cache for the top 5 visible cards while the user
  // looks at the hero section — navigation feels instant afterward
  useEffect(() => {
    if (trending.length > 0) {
      prefetchAnimeList(trending.map(a => a.id), 5);
    }
  }, [trending, prefetchAnimeList]);

  const startAutoPlay = useCallback(() => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    if (heroSlides.length <= 1) return;
    autoPlayRef.current = setInterval(() => {
      if (!isUserScrollingRef.current) {
        const next = (heroIndexRef.current + 1) % heroSlides.length;
        setHeroIndex(next);
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
      }
    }, HERO_INTERVAL_MS);
  }, [heroSlides.length]);

  useEffect(() => {
    startAutoPlay();
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [startAutoPlay]);

  const handleScroll = useCallback((e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const cardWidth = width - SPACING.md * 2;
    const index = Math.round(offsetX / cardWidth);
    if (index >= 0 && index < heroSlides.length && index !== heroIndexRef.current) {
      setHeroIndex(index);
    }
  }, [heroSlides.length]);

  const scrollToIndex = useCallback((index: number) => {
    setHeroIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: width - SPACING.md * 2,
    offset: (width - SPACING.md * 2) * index,
    index,
  }), [width]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['anime', 'trending'] }),
      queryClient.invalidateQueries({ queryKey: ['anime', 'top-rated'] }),
      queryClient.invalidateQueries({ queryKey: ['anime', 'new-arrivals'] }),
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
      {/* Space for Universal Header overlap if needed, otherwise start content */}
      <View style={{ height: SPACING.md }} />

      {/* Subscription Expiry Reminder Banner (renders only if user's subscription expires in <= 2 days) */}
      <SubscriptionExpiryBanner />

      {/* ── Auto-Rotating Hero Paging Carousel ── */}
      {heroSlides.length > 0 && (
        <View style={styles.hero}>
          <FlatList
            ref={flatListRef}
            data={heroSlides}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            getItemLayout={getItemLayout}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onScrollBeginDrag={() => {
              isUserScrollingRef.current = true;
              if (autoPlayRef.current) {
                clearInterval(autoPlayRef.current);
                autoPlayRef.current = null;
              }
            }}
            onScrollEndDrag={() => {
              isUserScrollingRef.current = false;
              startAutoPlay();
            }}
            onMomentumScrollEnd={(e) => {
              isUserScrollingRef.current = false;
              const offsetX = e.nativeEvent.contentOffset.x;
              const cardWidth = width - SPACING.md * 2;
              const index = Math.round(offsetX / cardWidth);
              if (index >= 0 && index < heroSlides.length) {
                setHeroIndex(index);
              }
              startAutoPlay();
            }}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.95}
                style={{ width: width - SPACING.md * 2, height: 420 }}
                onPress={() => router.push(`/anime/${item.id}`)}
              >
                <Image
                  source={{ uri: item.banner_url || item.poster_url || '' }}
                  style={styles.heroBg}
                  contentFit="cover"
                  transition={200}
                />
                <View style={styles.heroOverlay} />

                <View style={styles.heroContent}>
                  <View style={styles.heroTrendingBadge}>
                    <View style={styles.trendingDot} />
                    <Text style={styles.trendingText}>TRENDING NOW</Text>
                  </View>
                  <Text style={styles.heroTitle} numberOfLines={2}>{item.title}</Text>
                  {item.title_japanese && (
                    <Text style={styles.heroTitleJp} numberOfLines={1}>{item.title_japanese}</Text>
                  )}
                  <View style={styles.heroMeta}>
                    {item.year && <Text style={styles.heroMetaText}>{item.year}</Text>}
                    {item.type && <Text style={styles.heroMetaText}>• {item.type}</Text>}
                    {item.status && <Text style={styles.heroMetaText}>• {item.status}</Text>}
                    {item.user_rating_avg && (
                      <View style={styles.heroRating}>
                        <Ionicons name="star" size={12} color={COLORS.neonGold} />
                        <Text style={styles.heroRatingText}>{Number(item.user_rating_avg).toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.heroButtons}>
                    <TouchableOpacity
                      style={styles.playBtn}
                      onPress={() => router.push(`/anime/episodes/${item.id}`)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`Play ${item.title}`}
                    >
                      <Ionicons name="play" size={16} color={COLORS.bg} />
                      <Text style={styles.playBtnText}>PLAY NOW</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.infoBtn}
                      onPress={() => router.push(`/anime/${item.id}`)}
                      accessible={true}
                      accessibilityRole="button"
                      accessibilityLabel={`More info about ${item.title}`}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={COLORS.neon} />
                      <Text style={styles.infoBtnText}>MORE INFO</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />

          {/* Dot indicators overlayed on the bottom center */}
          {heroSlides.length > 1 && (
            <View style={styles.heroDotRow}>
              {heroSlides.map((_, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => scrollToIndex(i)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <View
                    style={[
                      styles.heroDot,
                      i === heroIndex && styles.heroDotActive,
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
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
          >
            {continueWatching.map((item: any) => {
              const progress = item.episode_duration > 0
                ? (item.progress_seconds / item.episode_duration) * 100
                : item.progress_percentage || 0;
              return (
                <TouchableOpacity
                  key={item.id || item.episode_id}
                  style={styles.continueCard}
                  activeOpacity={0.88}
                  onPress={() => item.episode_id && router.push(`/watch/${item.episode_id}`)}
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
                        <Text style={styles.continueProgressPercent}>{Math.round(progress)}%</Text>
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
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Genre Pills */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>GENRES</Text>
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
        title="TRENDING"
        subtitle="TOP PICKS THIS WEEK"
        data={trending}
        router={router}
        seeAllRoute="/trending"
      />

      {/* Top Rated */}
      <AnimeRow
        title="TOP RATED"
        subtitle="HIGHEST COMMUNITY SCORES"
        data={topRated}
        router={router}
        showStats
        seeAllRoute="/top-rated"
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
    paddingBottom: SPACING.xl,
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

  // ── Hero carousel dots & nav ──────────────────────────────────────────────
  heroDotRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 10,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  heroDotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.neon,
    shadowColor: COLORS.neon,
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },

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
    fontSize: 14, color: COLORS.text,
    fontWeight: '800', letterSpacing: 1.5,
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
