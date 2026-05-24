import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Anime, AnimeWithStats } from '../../lib/supabase';
import { usePrefetch } from '../../hooks/usePrefetch';

const { width } = Dimensions.get('window');

type Props = {
  anime: Anime | AnimeWithStats;
  onPress: () => void;
  size?: 'sm' | 'md' | 'lg';
  showStats?: boolean;
};

const AnimeCard = React.memo(function AnimeCard({ anime, onPress, size = 'md', showStats = false }: Props) {
  const { prefetchAnime } = usePrefetch();
  // Memoized per `size` — avoids recalculating on every render triggered by parent
  const { cardWidth, cardHeight } = useMemo(() => {
    const w = size === 'sm' ? 120 : size === 'lg' ? width - 32 : 160;
    const h = size === 'lg' ? 220 : w * 1.45;
    return { cardWidth: w, cardHeight: h };
  }, [size]);

  const stats = anime as AnimeWithStats;

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={() => prefetchAnime(anime.id)}
      activeOpacity={0.85}
      style={[styles.container, { width: cardWidth }]}
    >
      <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
        {/* Poster */}
        <Image
          source={{ uri: anime.poster_url || 'https://via.placeholder.com/160x230/0E0E1A/BF5FFF?text=?' }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />

        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(8,8,16,0.95)']}
          style={styles.gradientOverlay}
        />

        {/* Top badges */}
        <View style={styles.topRow}>
          {anime.age_rating && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{anime.age_rating}</Text>
            </View>
          )}
          {anime.type && (
            <View style={[styles.badge, styles.typeBadge]}>
              <Text style={styles.badgeText}>{anime.type}</Text>
            </View>
          )}
        </View>

        {/* Premium lock */}
        {(stats.premium_episode_count ?? 0) > 0 && (
          <View style={styles.premiumBadge}>
            <Ionicons name="star" size={10} color={COLORS.neonGold} />
          </View>
        )}

        {/* Bottom info */}
        <View style={styles.bottomInfo}>
          <Text style={styles.title} numberOfLines={2}>{anime.title}</Text>
          {anime.year && <Text style={styles.year}>{anime.year}</Text>}
          {showStats && stats.user_rating_avg && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={10} color={COLORS.neonGold} />
              <Text style={styles.rating}>{Number(stats.user_rating_avg).toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Neon border left accent */}
        <View style={styles.accentLine} />
      </View>
    </TouchableOpacity>
  );
});

export default AnimeCard;

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
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
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
    backgroundColor: 'rgba(8,8,16,0.8)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeBadge: {
    borderColor: 'rgba(191,95,255,0.4)',
    backgroundColor: 'rgba(191,95,255,0.15)',
  },
  badgeText: {
    fontSize: 9,
    color: COLORS.textSub,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  premiumBadge: {
    position: 'absolute',
    top: SPACING.xs,
    right: SPACING.xs,
    backgroundColor: 'rgba(255,214,0,0.2)',
    borderRadius: RADIUS.sm,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,214,0,0.5)',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.sm,
    backgroundColor: 'rgba(8,8,16,0.85)',
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
  accentLine: {
    position: 'absolute',
    left: 0,
    top: '20%',
    bottom: '20%',
    width: 2,
    backgroundColor: COLORS.neon,
    borderRadius: 1,
    opacity: 0.7,
  },
});
