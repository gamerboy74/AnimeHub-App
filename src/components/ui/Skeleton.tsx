import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

// ─── SHIMMER WRAPPER / PULSE CONTROLLER ──────────────────────────────────────
interface ShimmerProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

export function Shimmer({ children, style, duration = 1200 }: ShimmerProps) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  const translateX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    // Synchronized breathing opacity pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: duration / 2,
          useNativeDriver: true,
        }),
      ])
    );

    // Linear traveling sweep highlight
    const sweepLoop = Animated.loop(
      Animated.timing(translateX, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    sweepLoop.start();

    return () => {
      pulseLoop.stop();
      sweepLoop.stop();
    };
  }, [pulse, translateX, duration]);

  return (
    <Animated.View style={[style, { opacity: pulse }]}>
      {children}
    </Animated.View>
  );
}

// ─── SKELETON BOX PRIMITIVE ──────────────────────────────────────────────────
interface SkeletonBoxProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function SkeletonBox({
  width,
  height,
  borderRadius = RADIUS.sm,
  style,
}: SkeletonBoxProps) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.8,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        styles.boxBase,
        {
          width: width as any,
          height: height as any,
          borderRadius,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

// ─── ANIME CARD SKELETON (High-Fidelity Match for AnimeCard) ─────────────────
export interface AnimeCardSkeletonProps {
  cardWidth?: number;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  showStats?: boolean;
}

export function AnimeCardSkeleton({
  cardWidth: cardWidthProp,
  size = 'md',
  style,
  showStats = false,
}: AnimeCardSkeletonProps) {
  const defaultWidth = size === 'sm' ? 120 : size === 'lg' ? 320 : 160;
  const w = cardWidthProp !== undefined ? cardWidthProp : defaultWidth;
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.cardRoot, { width: w }, style]}>
      <Animated.View
        style={[
          styles.cardBody,
          size === 'lg' ? { height: 220 } : { aspectRatio: 1 / 1.45 },
          { opacity: pulse },
        ]}
      >
        {/* Top Badges Placeholder */}
        <View style={styles.cardTopRow}>
          <View style={styles.cardBadgeSkeleton} />
          <View style={[styles.cardBadgeSkeleton, { width: 34 }]} />
        </View>

        {/* Realistic bottom gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(8,9,13,0.5)', 'rgba(8,9,13,0.95)']}
          locations={[0.2, 0.6, 1]}
          style={styles.cardGradient}
        />

        {/* Bottom Info Placeholders */}
        <View style={styles.cardBottomInfo}>
          {/* Title line 1 */}
          <View style={styles.titleLine1} />
          {/* Title line 2 */}
          <View style={styles.titleLine2} />

          {/* Subtitle / Year / Rating row */}
          <View style={styles.cardMetaRow}>
            <View style={styles.yearPill} />
            {showStats && <View style={styles.ratingPill} />}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── HERO CAROUSEL SKELETON ──────────────────────────────────────────────────
export function HeroCarouselSkeleton() {
  const { width } = useWindowDimensions();
  const cardWidth = width - SPACING.md * 2;
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.heroContainer}>
      <View style={[styles.heroCard, { width: cardWidth }]}>
        {/* Cyberpunk corner accents */}
        <View style={styles.heroCornerTL} pointerEvents="none" />
        <View style={styles.heroCornerBR} pointerEvents="none" />

        {/* Background gradient */}
        <LinearGradient
          colors={['rgba(16,18,26,0.9)', 'rgba(8,9,13,0.7)', 'rgba(8,9,13,0.98)']}
          locations={[0.1, 0.5, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Hero Content Skeletons */}
        <Animated.View style={[styles.heroContent, { opacity: pulse }]}>
          {/* Trending badge pill */}
          <View style={styles.heroTrendingBadge}>
            <View style={styles.heroTrendingDot} />
            <View style={styles.heroTrendingTextBar} />
          </View>

          {/* Title placeholders */}
          <View style={styles.heroTitleBar1} />
          <View style={styles.heroTitleBar2} />

          {/* Japanese subtitle bar */}
          <View style={styles.heroJpBar} />

          {/* Metadata row */}
          <View style={styles.heroMetaRow}>
            <View style={styles.heroMetaChip} />
            <View style={styles.heroMetaChip} />
            <View style={styles.heroMetaChip} />
          </View>

          {/* Genre pills */}
          <View style={styles.heroGenreRow}>
            <View style={styles.heroGenrePill} />
            <View style={[styles.heroGenrePill, { width: 56 }]} />
            <View style={[styles.heroGenrePill, { width: 68 }]} />
          </View>

          {/* Action buttons */}
          <View style={styles.heroButtons}>
            <View style={styles.heroPlayBtn} />
            <View style={styles.heroInfoBtn} />
          </View>
        </Animated.View>

        {/* Dots Indicators Placeholder */}
        <View style={styles.heroDotRow}>
          <View style={styles.heroDotActive} />
          <View style={styles.heroDot} />
          <View style={styles.heroDot} />
          <View style={styles.heroDot} />
          <View style={styles.heroDot} />
        </View>
      </View>
    </View>
  );
}

// ─── HERO BANNER SKELETON (Single Banner for Detail or Alternative Layouts) ──
export function HeroBannerSkeleton({ height = 450 }: { height?: number | string } = {}) {
  const { width } = useWindowDimensions();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.heroBannerRoot, { width, height: height as any }]}>
      <LinearGradient
        colors={['rgba(16,18,26,0.6)', 'rgba(8,9,13,0.85)', '#08090D']}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View style={[styles.heroBannerContent, { opacity: pulse }]}>
        {/* Genre pills */}
        <View style={styles.heroBannerGenreRow}>
          <View style={styles.heroGenrePill} />
          <View style={styles.heroGenrePill} />
        </View>
        {/* Title */}
        <View style={styles.heroBannerTitleBar} />
        <View style={[styles.heroBannerTitleBar, { width: '50%' }]} />
        {/* Play button */}
        <View style={styles.heroBannerPlayBtn} />
      </Animated.View>
    </View>
  );
}

// ─── ANIME ROW SKELETON ──────────────────────────────────────────────────────
interface AnimeRowSkeletonProps {
  title?: string;
  subtitle?: string;
  count?: number;
  showStats?: boolean;
}

export function AnimeRowSkeleton({
  title,
  subtitle,
  count = 4,
  showStats = false,
}: AnimeRowSkeletonProps) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.rowSection}>
      {/* Section Header */}
      <View style={styles.rowHeader}>
        <Animated.View style={{ opacity: pulse }}>
          <View style={styles.rowHeaderSubtitle} />
          <View style={styles.rowHeaderTitle} />
        </Animated.View>
        <Animated.View style={[styles.rowHeaderSeeAll, { opacity: pulse }]} />
      </View>

      {/* Horizontal Cards Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowCardsContainer}
        scrollEnabled={false}
      >
        {Array.from({ length: count }).map((_, i) => (
          <AnimeCardSkeleton key={i} size="md" showStats={showStats} />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── GRID SKELETON (For Explore / Catalog / Search / Lists) ───────────────────
interface GridSkeletonProps {
  cardWidth: number;
  count?: number;
  numColumns?: number;
  gap?: number;
  paddingHorizontal?: number;
  size?: 'sm' | 'md' | 'lg';
  showStats?: boolean;
}

export function GridSkeleton({
  cardWidth,
  count = 12,
  gap = 10,
  paddingHorizontal = SPACING.md,
  size = 'sm',
  showStats = false,
}: GridSkeletonProps) {
  return (
    <View
      style={[
        styles.gridWrap,
        {
          paddingHorizontal,
          columnGap: gap,
          rowGap: SPACING.md,
        },
      ]}
    >
      {Array.from({ length: count }).map((_, i) => (
        <AnimeCardSkeleton
          key={i}
          cardWidth={cardWidth}
          size={size}
          showStats={showStats}
          style={{ width: cardWidth, marginRight: 0 }}
        />
      ))}
    </View>
  );
}

// ─── FULL HOME SCREEN SKELETON (Seamless Initial Load) ────────────────────────
export function HomeScreenSkeleton({ insets }: { insets: { top: number } }) {
  return (
    <ScrollView
      style={styles.homeSkeletonContainer}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={false}
    >
      {/* Safe Area Top Spacer */}
      <View style={{ height: insets.top > 0 ? insets.top + SPACING.xs : SPACING.md }} />

      {/* Hero Carousel Skeleton */}
      <HeroCarouselSkeleton />

      {/* Trending Row Skeleton */}
      <AnimeRowSkeleton title="TRENDING" subtitle="TOP PICKS THIS WEEK" count={4} />

      {/* Top Rated Row Skeleton */}
      <AnimeRowSkeleton title="TOP RATED" subtitle="HIGHEST COMMUNITY SCORES" count={4} showStats />
    </ScrollView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  boxBase: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // Anime Card
  cardRoot: {
    marginRight: SPACING.sm,
  },
  cardBody: {
    width: '100%',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  cardTopRow: {
    position: 'absolute',
    top: SPACING.xs,
    left: SPACING.xs,
    flexDirection: 'row',
    gap: 4,
    zIndex: 2,
  },
  cardBadgeSkeleton: {
    width: 28,
    height: 14,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
  },
  cardBottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.xs + 2,
    zIndex: 3,
  },
  titleLine1: {
    width: '84%',
    height: 11,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 5,
  },
  titleLine2: {
    width: '54%',
    height: 11,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    marginBottom: 7,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  yearPill: {
    width: 32,
    height: 9,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  ratingPill: {
    width: 26,
    height: 9,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 184, 0, 0.2)',
  },

  // Hero Carousel
  heroContainer: {
    marginBottom: SPACING.lg,
  },
  heroCard: {
    marginHorizontal: SPACING.md,
    height: 420,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    zIndex: 4,
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
    zIndex: 4,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    backgroundColor: 'rgba(8,8,16,0.6)',
  },
  heroTrendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.xs,
    width: 110,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 43, 60, 0.15)',
    paddingHorizontal: 8,
  },
  heroTrendingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.neonPink,
  },
  heroTrendingTextBar: {
    width: 70,
    height: 7,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 71, 87, 0.4)',
  },
  heroTitleBar1: {
    width: '74%',
    height: 24,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: 6,
  },
  heroTitleBar2: {
    width: '46%',
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 8,
  },
  heroJpBar: {
    width: '32%',
    height: 11,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  heroMetaChip: {
    width: 44,
    height: 12,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroGenreRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  heroGenrePill: {
    width: 52,
    height: 20,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  heroPlayBtn: {
    width: 120,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255, 43, 60, 0.35)',
  },
  heroInfoBtn: {
    width: 105,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroDotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 43, 60, 0.6)',
  },

  // Hero Banner (Single)
  heroBannerRoot: {
    height: 450,
    backgroundColor: COLORS.bgCard,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  heroBannerContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heroBannerGenreRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  heroBannerTitleBar: {
    width: '70%',
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 8,
  },
  heroBannerPlayBtn: {
    width: 170,
    height: 48,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 43, 60, 0.4)',
    marginTop: 16,
  },

  // Anime Row
  rowSection: {
    marginBottom: SPACING.lg,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  rowHeaderSubtitle: {
    width: 90,
    height: 9,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 43, 60, 0.25)',
    marginBottom: 6,
  },
  rowHeaderTitle: {
    width: 130,
    height: 18,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  rowHeaderSeeAll: {
    width: 55,
    height: 11,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  rowCardsContainer: {
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
  },

  // Grid
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  // Full Home
  homeSkeletonContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
});
