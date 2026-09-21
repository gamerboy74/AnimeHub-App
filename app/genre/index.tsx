import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { ALL_GENRES } from '../../src/constants/genres';

export default function AllGenresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const CARD_W = (width - SPACING.md * 2 - SPACING.sm) / 2;

  // Single query: fetch all anime that belong to any genre, partition client-side.
  // Replaces 16 parallel animeAPI.getByGenre() calls (16 DB round-trips → 1).
  const { data: genreImages = {} } = useQuery({
    queryKey: ['genre-index-posters'],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const genreNames = ALL_GENRES.map(g => g.name);
      // @ts-ignore — overlaps() may not be in types but works in PostgREST
      const { data } = await supabase
        .from('anime')
        .select('poster_url, genres')
        .overlaps('genres', genreNames)
        .limit(200);

      const imgs: Record<string, string> = {};
      const byGenre: Record<string, string[]> = {};

      for (const row of (data ?? []) as { poster_url: string; genres: string[] }[]) {
        if (!row.poster_url) continue;
        for (const g of (row.genres ?? [])) {
          if (!byGenre[g]) byGenre[g] = [];
          byGenre[g].push(row.poster_url);
        }
      }

      for (const g of genreNames) {
        const pool = byGenre[g];
        if (pool?.length) {
          imgs[g] = pool[Math.floor(Math.random() * pool.length)];
        }
      }
      return imgs;
    },
  });


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
            style={[styles.card, { width: CARD_W }]}
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
    height: 120,
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

