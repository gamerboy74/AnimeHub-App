import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Anime, AnimeWithStats } from '../../lib/supabase';
import { haptic } from '../../lib/haptics';

type Props = {
  anime: Anime | AnimeWithStats;
  onPress: (id: string) => void;
  /** Optional: called on long-press. Hoist usePrefetch to the parent
   *  and pass `() => prefetchAnime(anime.id)` so this hook runs once
   *  per list instead of once per card. */
  onLongPress?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showStats?: boolean;
  style?: any;
  /** Pre-computed card width from parent (avoids per-card useWindowDimensions) */
  cardWidth?: number;
};

const AnimeCard = React.memo(function AnimeCard({ anime, onPress, onLongPress, size = 'md', showStats = false, style, cardWidth: cardWidthProp }: Props) {
  // Memoized per `size` — use prop if provided, otherwise use fixed sizes
  const { cardWidth, cardHeight } = useMemo(() => {
    const w = cardWidthProp !== undefined
      ? cardWidthProp
      : size === 'sm' ? 120 : size === 'lg' ? 320 : 160;
    const h = size === 'lg' ? 220 : w * 1.45;
    return { cardWidth: w, cardHeight: h };
  }, [size, cardWidthProp]);

  const stats = anime as AnimeWithStats;
  const isNew = useMemo(() => {
    if (!anime.created_at) return false;
    const added = new Date(anime.created_at).getTime();
    return Date.now() - added < 30 * 24 * 60 * 60 * 1000; // within 30 days
  }, [anime.created_at]);

  const handlePress = () => {
    haptic.light();
    onPress(anime.id);
  };

  const handleLongPress = () => {
    if (onLongPress) {
      haptic.medium();
      onLongPress();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.85}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${anime.title}, ${anime.type || 'Anime'}${anime.year ? `, ${anime.year}` : ''}${stats.user_rating_avg ? `, rating ${Number(stats.user_rating_avg).toFixed(1)}` : ''}`}
      accessibilityHint="Double tap to open anime details"
      style={[styles.container, { width: cardWidth }, style]}
    >
      <View
        style={[
          styles.card,
          { width: '100%' },
          size === 'lg' ? { height: 220 } : { aspectRatio: 1 / 1.45 },
        ]}
      >
        {/* Poster */}
        {anime.poster_url ? (
          <Image
            source={{ uri: anime.poster_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.posterFallback}>
            <Ionicons name="film-outline" size={32} color={COLORS.textMuted} />
          </View>
        )}

        {/* Seamless Cinematic Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(8,9,13,0.45)', 'rgba(8,9,13,0.96)']}
          locations={[0.15, 0.55, 1]}
          style={styles.gradientOverlay}
        />

        {/* Top badges */}
        <View style={styles.topRow}>
          {anime.age_rating && (
            <View style={styles.badge}>
              <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>{anime.age_rating}</Text>
            </View>
          )}
          {anime.type && (
            <View style={[styles.badge, styles.typeBadge]}>
              <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>{anime.type}</Text>
            </View>
          )}
        </View>

        {/* NEW badge — shown for anime added within last 30 days */}
        {isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}

        {/* Premium lock */}
        {(stats.premium_episode_count ?? 0) > 0 && (
          <View style={styles.premiumBadge}>
            <Ionicons name="star" size={10} color={COLORS.neonGold} />
          </View>
        )}

        {/* Bottom info */}
        <View style={styles.bottomInfo}>
          <Text style={styles.title} numberOfLines={2} maxFontSizeMultiplier={1.3}>{anime.title}</Text>
          {anime.year && <Text style={styles.year} maxFontSizeMultiplier={1.2}>{anime.year}</Text>}
          {showStats && stats.user_rating_avg && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={10} color={COLORS.neonGold} />
              <Text style={styles.rating} maxFontSizeMultiplier={1.2}>{Number(stats.user_rating_avg).toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default AnimeCard;


export { AnimeCardSkeleton, type AnimeCardSkeletonProps } from './Skeleton';

const styles = StyleSheet.create({
  container: {
    marginRight: SPACING.sm,
  },
  card: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  posterFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '75%',
    borderBottomLeftRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
  },
  topRow: {
    position: 'absolute',
    top: SPACING.xs,
    left: SPACING.xs,
    flexDirection: 'row',
    gap: 4,
  },
  badge: {
    backgroundColor: 'rgba(8,9,13,0.85)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeBadge: {
    borderColor: 'rgba(255,43,60,0.4)',
    backgroundColor: 'rgba(255,43,60,0.15)',
  },
  badgeText: {
    fontSize: 9,
    color: COLORS.textSub,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  newBadge: {
    position: 'absolute',
    bottom: 36,          // sits just above the title text
    left: SPACING.xs,
    backgroundColor: COLORS.neonCyan,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  newBadgeText: {
    fontSize: 8,
    color: '#000',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  premiumBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: 'rgba(255,184,0,0.2)',
    borderRadius: RADIUS.sm,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.5)',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.sm,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 16,
  },
  year: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  rating: {
    fontSize: 10,
    color: COLORS.neonGold,
    fontWeight: '700',
  },
});

