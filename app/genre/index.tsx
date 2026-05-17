import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';

const { width } = Dimensions.get('window');
const CARD_W = (width - SPACING.md * 2 - SPACING.sm) / 2;

const ALL_GENRES = [
  { name: 'Action',     color: '#FF7346', grad: ['rgba(255,115,70,0.4)', 'rgba(8,8,16,0.95)'],  icon: '⚔️' },
  { name: 'Sci-Fi',    color: '#00F5FF', grad: ['rgba(0,245,255,0.4)', 'rgba(8,8,16,0.95)'],   icon: '🚀' },
  { name: 'Fantasy',   color: '#BF5FFF', grad: ['rgba(191,95,255,0.4)', 'rgba(8,8,16,0.95)'], icon: '🔮' },
  { name: 'Adventure', color: '#FFB830', grad: ['rgba(255,184,48,0.4)', 'rgba(8,8,16,0.95)'],  icon: '🗺️' },
  { name: 'Romance',   color: '#FF2D78', grad: ['rgba(255,45,120,0.4)', 'rgba(8,8,16,0.95)'],  icon: '💕' },
  { name: 'Comedy',    color: '#FFE54C', grad: ['rgba(255,229,76,0.4)', 'rgba(8,8,16,0.95)'],  icon: '😂' },
  { name: 'Drama',     color: '#E8C4FF', grad: ['rgba(232,196,255,0.4)', 'rgba(8,8,16,0.95)'], icon: '🎭' },
  { name: 'Thriller',  color: '#FF6B6B', grad: ['rgba(255,107,107,0.4)', 'rgba(8,8,16,0.95)'], icon: '😱' },
  { name: 'Horror',    color: '#8B0000', grad: ['rgba(139,0,0,0.5)', 'rgba(8,8,16,0.95)'],     icon: '🩸' },
  { name: 'Mystery',   color: '#9B8FFF', grad: ['rgba(155,143,255,0.4)', 'rgba(8,8,16,0.95)'], icon: '🔍' },
  { name: 'Sports',    color: '#00D4AA', grad: ['rgba(0,212,170,0.4)', 'rgba(8,8,16,0.95)'],   icon: '🏆' },
  { name: 'Slice of Life', color: '#A8E6CF', grad: ['rgba(168,230,207,0.3)', 'rgba(8,8,16,0.95)'], icon: '🌸' },
  { name: 'Mecha',     color: '#7EC8E3', grad: ['rgba(126,200,227,0.4)', 'rgba(8,8,16,0.95)'], icon: '🤖' },
  { name: 'Supernatural', color: '#C77DFF', grad: ['rgba(199,125,255,0.4)', 'rgba(8,8,16,0.95)'], icon: '👁️' },
  { name: 'Isekai',    color: '#FFC300', grad: ['rgba(255,195,0,0.4)', 'rgba(8,8,16,0.95)'],   icon: '🌀' },
  { name: 'Historical', color: '#D4A574', grad: ['rgba(212,165,116,0.4)', 'rgba(8,8,16,0.95)'], icon: '📜' },
];

export default function AllGenresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
        {/* Pair genres into rows of 2 */}
        {ALL_GENRES.map((genre) => (
          <TouchableOpacity
            key={genre.name}
            style={styles.card}
            onPress={() => router.push(`/genre/${genre.name}`)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['rgba(25,25,29,0.95)', 'rgba(15,15,18,0.98)']}
              style={StyleSheet.absoluteFill}
            />
            {/* Accent glow blob */}
            <View style={[styles.glowBlob, { backgroundColor: genre.color }]} />

            <LinearGradient
              colors={genre.grad as [string, string]}
              style={styles.gradientOverlay}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            />

            <Text style={styles.genreIcon}>{genre.icon}</Text>
            <Text style={[styles.genreName, { color: genre.color }]}>{genre.name.toUpperCase()}</Text>
            <View style={styles.arrow}>
              <Ionicons name="arrow-forward" size={14} color={genre.color} />
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
    padding: SPACING.md, paddingTop: SPACING.sm,
  },
  card: {
    width: CARD_W, height: 110,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 14,
    borderWidth: 1, borderColor: 'rgba(189,157,255,0.07)',
  },
  glowBlob: {
    position: 'absolute', top: -20, right: -20,
    width: 80, height: 80,
    borderRadius: 40, opacity: 0.08,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },
  genreIcon: { fontSize: 26, marginBottom: 4 },
  genreName: { fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  arrow: {
    position: 'absolute', top: 12, right: 12,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
});
