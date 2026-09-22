import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  useWindowDimensions,
  LayoutAnimation,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { Anime, AnimeWithStats } from '../../lib/supabase';
import { haptic } from '../../lib/haptics';

const DEFAULT_INTERVAL_MS = 5000;

interface HeroSlideItemProps {
  item: Anime | AnimeWithStats;
  cardWidth: number;
  onPress: (id: string) => void;
  onPlay: (id: string) => void;
  onInfo: (id: string) => void;
}

// ─── MEMOIZED HERO SLIDE ITEM ────────────────────────────────────────────────
const HeroSlideItem = React.memo(function HeroSlideItem({
  item,
  cardWidth,
  onPress,
  onPlay,
  onInfo,
}: HeroSlideItemProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const handleCardPress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  const handlePlayPress = useCallback(() => {
    haptic.light();
    onPlay(item.id);
  }, [item.id, onPlay]);

  const handleInfoPress = useCallback(() => {
    haptic.light();
    onInfo(item.id);
  }, [item.id, onInfo]);

  const imageUrl = item.banner_url || item.poster_url || '';
  const genres = ((item as any).genres as string[]) || [];
  const rating = (item as AnimeWithStats).user_rating_avg;
  const totalEpisodes = (item as any).total_episodes;

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      style={[styles.slideCard, { width: cardWidth }]}
      onPress={handleCardPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Featured: ${item.title}`}
    >
      {/* High-priority cached background banner */}
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.heroBg}
          contentFit="cover"
          priority="high"
          cachePolicy="memory-disk"
          transition={200}
        />
      ) : (
        <View style={[styles.heroBg, styles.placeholderBg]} />
      )}

      {/* Cyberpunk corner accents */}
      <View style={styles.heroCornerTL} pointerEvents="none" />
      <View style={styles.heroCornerBR} pointerEvents="none" />

      {/* Cinematic Gradient overlays */}
      <LinearGradient
        colors={['rgba(8,8,16,0.3)', 'rgba(8,8,16,0.65)', 'rgba(8,8,16,0.95)']}
        locations={[0.1, 0.55, 1]}
        style={styles.heroOverlayGradient}
        pointerEvents="none"
      />

      {/* Hero content card */}
      <View style={styles.heroContent}>
        {/* Trending badge */}
        <View style={styles.heroTrendingBadge}>
          <Animated.View style={[styles.trendingDot, { opacity: pulseAnim }]} />
          <Text style={styles.trendingText}>TRENDING NOW</Text>
        </View>

        {/* Title */}
        <Text style={styles.heroTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.title_japanese && (
          <Text style={styles.heroTitleJp} numberOfLines={1}>
            {item.title_japanese}
          </Text>
        )}

        {/* Metadata row */}
        <View style={styles.heroMeta}>
          {item.year && <Text style={styles.heroMetaText}>{item.year}</Text>}
          {item.type && <Text style={styles.heroMetaText}>• {item.type}</Text>}
          {totalEpisodes && (
            <Text style={styles.heroMetaText}>• {totalEpisodes} eps</Text>
          )}
          {rating ? (
            <View style={styles.heroRating}>
              <Ionicons name="star" size={12} color={COLORS.neonGold} />
              <Text style={styles.heroRatingText}>{Number(rating).toFixed(1)}</Text>
            </View>
          ) : null}
        </View>

        {/* Genre pills */}
        {genres.length > 0 && (
          <View style={styles.heroGenreRow}>
            {genres.slice(0, 3).map((g: string) => (
              <View key={g} style={styles.heroGenrePill}>
                <Text style={styles.heroGenrePillText}>{g}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.heroButtons}>
          <TouchableOpacity
            style={styles.playBtn}
            onPress={handlePlayPress}
            activeOpacity={0.8}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Play ${item.title}`}
          >
            <Ionicons name="play" size={16} color={COLORS.bg} />
            <Text style={styles.playBtnText}>PLAY NOW</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.infoBtn}
            onPress={handleInfoPress}
            activeOpacity={0.8}
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
  );
});

// ─── HERO CAROUSEL CONTAINER ─────────────────────────────────────────────────
export interface HeroCarouselProps {
  slides: (Anime | AnimeWithStats)[];
  intervalMs?: number;
  onPlayPress?: (id: string) => void;
  onInfoPress?: (id: string) => void;
}

export const HeroCarousel = React.memo(function HeroCarousel({
  slides,
  intervalMs = DEFAULT_INTERVAL_MS,
  onPlayPress,
  onInfoPress,
}: HeroCarouselProps) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const cardWidth = useMemo(() => width - SPACING.md * 2, [width]);

  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUserScrollingRef = useRef(false);
  const flatListRef = useRef<FlatList>(null);

  // Keep activeIndex in sync with ref without re-triggering intervals
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // 1. Batch prefetch all hero banner images into memory-disk cache immediately
  useEffect(() => {
    if (slides.length > 0) {
      const bannerUrls = slides
        .map((s) => s.banner_url || s.poster_url)
        .filter((u): u is string => typeof u === 'string' && u.length > 0);

      if (bannerUrls.length > 0) {
        // Expo Image prefetch runs asynchronously and stores in memory & disk cache
        Image.prefetch(bannerUrls);
      }
    }
  }, [slides]);

  // 2. Safe AutoPlay Controller with Tab Focus Awareness
  const startAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }

    // Don't auto-rotate if tab is blurred or only 1 slide exists
    if (!isFocused || slides.length <= 1) return;

    autoPlayRef.current = setInterval(() => {
      if (!isUserScrollingRef.current) {
        const next = (activeIndexRef.current + 1) % slides.length;
        if (Platform.OS !== 'web') {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
        activeIndexRef.current = next;
        setActiveIndex(next);
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
      }
    }, intervalMs);
  }, [isFocused, slides.length, intervalMs]);

  // 3. Pause autoplay when screen loses focus (e.g. switched to Explore / Profile)
  useEffect(() => {
    if (isFocused) {
      startAutoPlay();
    } else if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
    };
  }, [isFocused, startAutoPlay]);

  // 4. Stable Navigation callbacks
  const handlePress = useCallback(
    (id: string) => {
      router.push(`/anime/${id}`);
    },
    [router]
  );

  const handlePlay = useCallback(
    (id: string) => {
      if (onPlayPress) {
        onPlayPress(id);
      } else {
        router.push(`/anime/episodes/${id}`);
      }
    },
    [onPlayPress, router]
  );

  const handleInfo = useCallback(
    (id: string) => {
      if (onInfoPress) {
        onInfoPress(id);
      } else {
        router.push(`/anime/${id}`);
      }
    },
    [onInfoPress, router]
  );

  // 5. Scroll & Paging handlers
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / cardWidth);
      if (index >= 0 && index < slides.length && index !== activeIndexRef.current) {
        activeIndexRef.current = index;
        setActiveIndex(index);
      }
    },
    [cardWidth, slides.length]
  );

  const handleScrollBeginDrag = useCallback(() => {
    isUserScrollingRef.current = true;
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
  }, []);

  const handleScrollEndDrag = useCallback(() => {
    isUserScrollingRef.current = false;
    startAutoPlay();
  }, [startAutoPlay]);

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      isUserScrollingRef.current = false;
      const offsetX = e.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / cardWidth);
      if (index >= 0 && index < slides.length) {
        activeIndexRef.current = index;
        setActiveIndex(index);
      }
      startAutoPlay();
    },
    [cardWidth, slides.length, startAutoPlay]
  );

  const scrollToIndex = useCallback((index: number) => {
    haptic.light();
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    activeIndexRef.current = index;
    setActiveIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  // 6. getItemLayout for instant O(1) index jumping
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: cardWidth,
      offset: cardWidth * index,
      index,
    }),
    [cardWidth]
  );

  // 7. Crash prevention for unmounted/unmeasured scrollToIndex
  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
      setTimeout(() => {
        if (flatListRef.current && info.index < slides.length) {
          flatListRef.current.scrollToIndex({ index: info.index, animated: true });
        }
      }, 80);
    },
    [slides.length]
  );

  const keyExtractor = useCallback((item: Anime | AnimeWithStats) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: Anime | AnimeWithStats }) => (
      <HeroSlideItem
        item={item}
        cardWidth={cardWidth}
        onPress={handlePress}
        onPlay={handlePlay}
        onInfo={handleInfo}
      />
    ),
    [cardWidth, handlePress, handlePlay, handleInfo]
  );

  if (!slides || slides.length === 0) return null;

  return (
    <View style={styles.heroContainer}>
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        snapToInterval={cardWidth}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        removeClippedSubviews={false} // Keep all 5 slides hot in memory for 0-flash cycling
        windowSize={Math.max(3, slides.length)}
        initialNumToRender={slides.length}
        maxToRenderPerBatch={slides.length}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        renderItem={renderItem}
      />

      {/* Interactive Dot indicators overlayed on the bottom center */}
      {slides.length > 1 && (
        <View style={styles.heroDotRow} pointerEvents="box-none">
          {slides.map((_, i) => {
            const isActive = i === activeIndex;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => scrollToIndex(i)}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Go to slide ${i + 1}`}
              >
                <View
                  style={[
                    styles.heroDot,
                    isActive && styles.heroDotActive,
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
});

export default HeroCarousel;

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  heroContainer: {
    marginHorizontal: SPACING.md,
    height: 420,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    position: 'relative',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  slideCard: {
    height: 420,
    position: 'relative',
    overflow: 'hidden',
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholderBg: {
    backgroundColor: COLORS.bgCard,
  },
  heroOverlayGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  heroCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 24,
    height: 24,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: COLORS.neon,
    borderTopLeftRadius: RADIUS.lg,
    zIndex: 2,
  },
  heroCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: COLORS.neonPink,
    borderBottomRightRadius: RADIUS.lg,
    zIndex: 2,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    zIndex: 3,
  },
  heroTrendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.xs,
  },
  trendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.neonPink,
  },
  trendingText: {
    fontSize: 10,
    color: COLORS.neonPink,
    fontWeight: '700',
    letterSpacing: 2,
  },
  heroTitle: {
    fontSize: 26,
    color: COLORS.text,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  heroTitleJp: {
    fontSize: 13,
    color: COLORS.textSub,
    marginTop: 4,
    letterSpacing: 1,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.xs,
    flexWrap: 'wrap',
  },
  heroMetaText: {
    fontSize: 11,
    color: COLORS.textSub,
  },
  heroRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  heroRatingText: {
    fontSize: 11,
    color: COLORS.neonGold,
    fontWeight: '700',
  },
  heroGenreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  heroGenrePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroGenrePillText: {
    fontSize: 9,
    color: COLORS.textSub,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.neon,
    paddingVertical: 10,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.sm,
  },
  playBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  infoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.neon,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,43,60,0.12)',
  },
  infoBtnText: {
    color: COLORS.neon,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
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
});
