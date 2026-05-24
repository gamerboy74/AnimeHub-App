import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { AnimeWithStats } from '../../types/database';

const { width } = Dimensions.get('window');

interface HeroBannerProps {
  anime: AnimeWithStats;
  onPress: (id: string) => void;
  onPlay: (anime: AnimeWithStats) => void;
}

// Memoized: only re-renders if anime reference changes
export const HeroBanner = React.memo(function HeroBanner({ anime, onPress, onPlay }: HeroBannerProps) {
  if (!anime) return <View style={styles.placeholder} />;

  // Slice genres once — not on every render
  const visibleGenres = useMemo(() => anime.genres?.slice(0, 3) ?? [], [anime.genres]);

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(anime.id)} style={styles.root}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: anime.banner_url || anime.poster_url }}
          style={styles.image}
          contentFit="cover"
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
          >
            <Play color="#080810" size={20} fill="#080810" />
            <Text style={styles.playBtnText}>Watch Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  placeholder: { height: 384, backgroundColor: '#1a1a2e' },
  root: { width: '100%', backgroundColor: '#080810' },
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
    color: '#BF5FFF', fontWeight: '700', fontSize: 12,
    textTransform: 'uppercase', letterSpacing: 1.5,
  },
  title: {
    color: '#FFFFFF', fontSize: 32, fontWeight: '700',
    textAlign: 'center', marginBottom: 24,
  },
  buttonRow: { flexDirection: 'row', width: '100%', justifyContent: 'center' },
  playBtn: {
    backgroundColor: '#BF5FFF',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 32, borderRadius: 100,
    shadowColor: '#BF5FFF', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, shadowRadius: 12, elevation: 10,
    gap: 8,
  },
  playBtnText: {
    color: '#080810', fontWeight: '700', fontSize: 18,
  },
});
