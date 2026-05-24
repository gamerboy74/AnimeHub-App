import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { animeAPI } from '../../src/lib/supabase';

const { width } = Dimensions.get('window');
const CARD_W = (width - SPACING.md * 2 - SPACING.sm) / 2;

const ALL_GENRES = [
  { name: 'Action',        color: '#FF7346', grad: ['transparent', 'rgba(255,115,70,0.55)', 'rgba(8,8,16,0.97)']  as const, icon: '⚔️' },
  { name: 'Sci-Fi',        color: '#00F5FF', grad: ['transparent', 'rgba(0,245,255,0.55)',  'rgba(8,8,16,0.97)']  as const, icon: '🚀' },
  { name: 'Fantasy',       color: '#BF5FFF', grad: ['transparent', 'rgba(191,95,255,0.55)', 'rgba(8,8,16,0.97)']  as const, icon: '🔮' },
  { name: 'Adventure',     color: '#FFB830', grad: ['transparent', 'rgba(255,184,48,0.55)', 'rgba(8,8,16,0.97)']  as const, icon: '🗺️' },
  { name: 'Romance',       color: '#FF2D78', grad: ['transparent', 'rgba(255,45,120,0.55)', 'rgba(8,8,16,0.97)']  as const, icon: '💕' },
  { name: 'Comedy',        color: '#FFE54C', grad: ['transparent', 'rgba(255,229,76,0.55)', 'rgba(8,8,16,0.97)']  as const, icon: '😂' },
  { name: 'Drama',         color: '#E8C4FF', grad: ['transparent', 'rgba(232,196,255,0.5)','rgba(8,8,16,0.97)']   as const, icon: '🎭' },
  { name: 'Thriller',      color: '#FF6B6B', grad: ['transparent', 'rgba(255,107,107,0.55)','rgba(8,8,16,0.97)']  as const, icon: '😱' },
  { name: 'Horror',        color: '#FF3333', grad: ['transparent', 'rgba(139,0,0,0.7)',     'rgba(8,8,16,0.97)']  as const, icon: '🩸' },
  { name: 'Mystery',       color: '#9B8FFF', grad: ['transparent', 'rgba(155,143,255,0.55)','rgba(8,8,16,0.97)']  as const, icon: '🔍' },
  { name: 'Sports',        color: '#00D4AA', grad: ['transparent', 'rgba(0,212,170,0.55)', 'rgba(8,8,16,0.97)']   as const, icon: '🏆' },
  { name: 'Slice of Life', color: '#A8E6CF', grad: ['transparent', 'rgba(168,230,207,0.5)','rgba(8,8,16,0.97)']   as const, icon: '🌸' },
  { name: 'Mecha',         color: '#7EC8E3', grad: ['transparent', 'rgba(126,200,227,0.55)','rgba(8,8,16,0.97)']  as const, icon: '🤖' },
  { name: 'Supernatural',  color: '#C77DFF', grad: ['transparent', 'rgba(199,125,255,0.55)','rgba(8,8,16,0.97)']  as const, icon: '👁️' },
  { name: 'Isekai',        color: '#FFC300', grad: ['transparent', 'rgba(255,195,0,0.55)', 'rgba(8,8,16,0.97)']   as const, icon: '🌀' },
  { name: 'Historical',    color: '#D4A574', grad: ['transparent', 'rgba(212,165,116,0.55)','rgba(8,8,16,0.97)']  as const, icon: '📜' },
];

export default function AllGenresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [genreImages, setGenreImages] = useState<Record<string, string>>({});

  useEffect(() => {
    // Fetch a random anime poster for each genre in parallel
    Promise.all(
      ALL_GENRES.map(g => animeAPI.getByGenre(g.name, 20))
    ).then(results => {
      const imgs: Record<string, string> = {};
      results.forEach((res, i) => {
        const list = (res.data || []).filter((a: any) => a.poster_url);
        if (list.length > 0) {
          const pick = list[Math.floor(Math.random() * list.length)];
          imgs[ALL_GENRES[i].name] = pick.poster_url;
        }
      });
      setGenreImages(imgs);
    }).catch(console.error);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerSub}>// EXPLORE</Text>
          <Text style={styles.headerTitle}>ALL GENRES</Text>
        </View>
        <Text style={styles.headerCount}>{ALL_GENRES.length} genres</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
        {ALL_GENRES.map((genre) => (
          <TouchableOpacity
            key={genre.name}
            style={styles.card}
            onPress={() => router.push(`/genre/${genre.name}`)}
            activeOpacity={0.82}
          >
            {/* Anime poster background */}
            {genreImages[genre.name] ? (
              <Image
                source={{ uri: genreImages[genre.name] }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            ) : (
              // Fallback solid bg while loading
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(25,25,29,0.98)' }]} />
            )}

            {/* Dark scrim so text is always readable */}
            <View style={styles.dim} />

            {/* Tinted gradient from image midpoint to dark bottom */}
            <LinearGradient
              colors={genre.grad}
              style={StyleSheet.absoluteFill}
            />

            {/* Content */}
            <View style={styles.cardContent}>
              <Text style={styles.genreIcon}>{genre.icon}</Text>
              <Text style={[styles.genreName, { color: genre.color }]}>
                {genre.name.toUpperCase()}
              </Text>
            </View>

            {/* Arrow chip */}
            <View style={styles.arrow}>
              <Ionicons name="arrow-forward" size={13} color={genre.color} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.md, paddingBottom: SPACING.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(25,25,29,0.8)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(189,157,255,0.1)',
  },
  headerSub: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 22, color: COLORS.text, fontWeight: '900', letterSpacing: -0.5 },
  headerCount: { marginLeft: 'auto' as any, fontSize: 12, color: COLORS.textMuted },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm,
    padding: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 100,
  },
  card: {
    width: CARD_W, height: 120,
    borderRadius: RADIUS.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(189,157,255,0.06)',
    justifyContent: 'flex-end',
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.44)',
  },
  cardContent: { padding: 12, gap: 3 },
  genreIcon: {
    fontSize: 24,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  genreName: {
    fontSize: 12, fontWeight: '900', letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  arrow: {
    position: 'absolute', top: 10, right: 10,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
});

