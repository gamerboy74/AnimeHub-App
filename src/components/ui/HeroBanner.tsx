import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { AnimeWithStats } from '../../types/database';
import { COLORS } from '../../constants/theme';

const { width } = Dimensions.get('window');

interface HeroBannerProps {
  anime: AnimeWithStats;
  onPress: (id: string) => void;
  onPlay: (anime: AnimeWithStats) => void;
}

import { HeroBannerSkeleton } from './Skeleton';

// Memoized: only re-renders if anime reference changes
export const HeroBanner = React.memo(function HeroBanner({ anime, onPress, onPlay }: HeroBannerProps) {
  if (!anime) return <HeroBannerSkeleton />;

  // Slice genres once — not on every render
  const visibleGenres = useMemo(() => anime.genres?.slice(0, 3) ?? [], [anime.genres]);

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(anime.id)} style={styles.root}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: anime.banner_url || anime.poster_url }}
          style={styles.image}
          contentFit="cover"
          priority="high"
          cachePolicy="memory-disk"
          transition={200}
        />
        {/* Top gradient for status bar visibility */}
        <LinearGradient
          colors={['rgba(8,8,16,0.6)', 'transparent']}
          style={styles.topGradient}
        />
        {/* Bottom gradient to blend into background */}
        <LinearGradient
          colors={['transparent', 'rgba(8,8,16,0.8)', '#080810']}
          style={styles.bottomGradient}
        />
      </View>

      <View style={styles.content}>
        {/* Genres */}
        <View style={styles.genreRow}>
          {visibleGenres.map((genre, index) => (
            <Text key={genre} style={styles.genreText}>
              {genre}{index < visibleGenres.length - 1 ? ' •' : ''}
            </Text>
          ))}
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {anime.title}
        </Text>

        {/* Play Button Row */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            onPress={() => onPlay(anime)}
            style={styles.playBtn}
            activeOpacity={0.8}
          >
            <Play color="#FFFFFF" size={20} fill="#FFFFFF" />
            <Text style={styles.playBtnText}>Watch Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  placeholder: { height: 384, backgroundColor: COLORS.bgCard },
  root: { width: '100%', backgroundColor: COLORS.bg },
  imageContainer: { width, height: 450 },
  image: { width: '100%', height: '100%' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 100 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 250 },
  content: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    paddingHorizontal: 24, alignItems: 'center',
  },
  genreRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  genreText: {
    color: COLORS.primary, fontWeight: '700', fontSize: 12,
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  title: {
    color: '#FFFFFF', fontSize: 32, fontWeight: '800',
    textAlign: 'center', marginBottom: 24,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
  },
  buttonRow: { flexDirection: 'row', width: '100%', justifyContent: 'center' },
  playBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, paddingHorizontal: 36, borderRadius: 100,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.65, shadowRadius: 16, elevation: 12,
    gap: 8,
  },
  playBtnText: {
    color: '#FFFFFF', fontWeight: '800', fontSize: 18,
    letterSpacing: 0.5,
  },
});

export { HeroBannerSkeleton } from './Skeleton';
