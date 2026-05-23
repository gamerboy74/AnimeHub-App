import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { userAPI } from '../src/lib/supabase';

// ─── Badge definitions ────────────────────────────────────────────────────────
const BADGE_DEFS = [
  { id: '1', name: 'FIRST EP',  icon: 'play-circle',    color: COLORS.neon,      check: (p: any[], s: number, w: any[]) => p.length >= 1 },
  { id: '2', name: 'DEDICATED', icon: 'flash',           color: COLORS.neonCyan,  check: (p: any[], s: number) => s >= 3 },
  { id: '3', name: 'VETERAN',   icon: 'medal',           color: '#ff7346',        check: (p: any[], s: number) => p.length >= 10 },
  { id: '4', name: 'LISTER',    icon: 'list',            color: COLORS.neonPulse, check: (p: any[], s: number, w: any[]) => w.length >= 5 },
  { id: '5', name: 'WARRIOR',   icon: 'shield',          color: COLORS.neonGold,  check: (p: any[], s: number) => s >= 7 },
  { id: '6', name: 'LEGEND',    icon: 'star',            color: '#BF5FFF',        check: (p: any[], s: number) => p.length >= 50 },
];

const GENRE_COLORS = ['#00F5FF', '#BF5FFF', '#ff7346', '#FFD600', '#FF2D78', '#00F5B4'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeGenres(progress: any[]) {
  const counts: Record<string, number> = {};
  for (const p of progress) {
    const genres: string[] = p.genres || p.anime_genres || [];
    for (const g of genres) counts[g] = (counts[g] || 0) + 1;
  }
  const total = Math.max(Object.values(counts).reduce((a, b) => a + b, 0), 1);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count], i) => ({
      name,
      percent: Math.round((count / total) * 100),
      color: GENRE_COLORS[i % GENRE_COLORS.length],
    }));
}

function computeStreak(progress: any[]): number {
  const days = new Set(progress.map(p => new Date(p.last_watched).toDateString()));
  const sorted = Array.from(days).map(d => new Date(d).getTime()).sort((a, b) => b - a);
  let streak = 0;
  let check = new Date(); check.setHours(0, 0, 0, 0);
  for (const ts of sorted) {
    const d = new Date(ts); d.setHours(0, 0, 0, 0);
    if (Math.round((check.getTime() - d.getTime()) / 86400000) <= 1) { streak++; check = d; }
    else break;
  }
  return streak;
}

function formatWatchTime(seconds: number = 0) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h.toLocaleString()}h ${m}m`;
  return `${m}m`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [allProgress, setAllProgress] = useState<any[]>([]);
  const [watchlist, setWatchlist]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [progressRes, watchlistRes] = await Promise.all([
      userAPI.getProgress(user.id),
      userAPI.getWatchlist(user.id),
    ]);
    setAllProgress(progressRes.data || []);
    setWatchlist(watchlistRes.data?.map((i: any) => i.anime) || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const streak     = useMemo(() => computeStreak(allProgress), [allProgress]);
  const genreStats = useMemo(() => computeGenres(allProgress), [allProgress]);
  const badges     = useMemo(
    () => BADGE_DEFS.map(b => ({ ...b, earned: b.check(allProgress, streak, watchlist) })),
    [allProgress, streak, watchlist]
  );

  const completed = user?.anime_watched ?? allProgress.filter((p: any) => p.is_completed).length;
  const watchedToday = allProgress.some(p =>
    new Date(p.last_watched).toDateString() === new Date().toDateString()
  );

  if (loading) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.neon} size="large" />
        <Text style={styles.loadingText}>Loading your stats…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerLabel}>⚡ YOUR STATS</Text>
          <Text style={styles.headerTitle}>My Statistics</Text>
        </View>
      </View>

      {/* ── Bento Stat Tiles ── */}
      <View style={styles.section}>
        <View style={styles.statsGrid}>
          <StatTile
            value={formatWatchTime(user?.total_watch_time)}
            label="WATCH TIME"
            color={COLORS.neon}
            icon="time-outline"
          />
          <StatTile
            value={String(completed)}
            label="COMPLETED"
            color={COLORS.neonCyan}
            icon="checkmark-circle-outline"
          />
          <StatTile
            value={String(allProgress.length)}
            label="EPISODES"
            color="#ff7346"
            icon="play-outline"
          />
          <StatTile
            value={String(streak)}
            label="DAY STREAK"
            color={COLORS.neonPulse}
            icon="flash"
            isStreak
          />
        </View>
      </View>

      {/* ── Streak Card ── */}
      <View style={styles.section}>
        <BlurView intensity={20} style={styles.streakCard}>
          <LinearGradient
            colors={['rgba(0,245,255,0.05)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View />
          </LinearGradient>
          <View style={styles.streakHeader}>
            <View>
              <Text style={styles.streakTitle}>Current Streak</Text>
              <Text style={styles.streakSub}>
                {streak === 0
                  ? 'Start watching to build your streak!'
                  : watchedToday
                    ? `🔥 Great job! Streak maintained today.`
                    : `Watch 1 episode today to keep your ${streak}-day streak!`}
              </Text>
            </View>
            <View style={styles.streakBubble}>
              <Text style={styles.streakNumber}>{streak}</Text>
              <Text style={styles.streakDayLabel}>DAYS</Text>
            </View>
          </View>
          <View style={styles.streakProgressLabels}>
            <Text style={styles.progressLabel}>PROGRESS TO 30</Text>
            <Text style={[styles.progressLabel, { color: COLORS.text }]}>{streak}/30</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min((streak / 30) * 100, 100)}%` }]} />
          </View>
          <View style={styles.streakLevels}>
            <Text style={styles.levelLabel}>
              Level {Math.floor(streak / 7) + 1}: {['Genin','Chunin','Jonin','Anbu','Kage'][Math.min(Math.floor(streak / 7), 4)]}
            </Text>
            <Text style={styles.levelLabel}>Next: {Math.min((Math.floor(streak / 7) + 1) * 7, 30)} days</Text>
          </View>
        </BlurView>
      </View>

      {/* ── Top Genres ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Genres</Text>
        {genreStats.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="bar-chart-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Watch more anime to see your genre breakdown!</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {genreStats.map((g) => (
              <View key={g.name} style={styles.genreItem}>
                <View style={styles.genreLabelRow}>
                  <Text style={styles.genreName}>{g.name}</Text>
                  <Text style={[styles.genrePercent, { color: g.color }]}>{g.percent}%</Text>
                </View>
                <View style={styles.genreBarBg}>
                  <LinearGradient
                    colors={[g.color, g.color + '66']}
                    style={[styles.genreBarFill, { width: `${g.percent}%` }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <View />
                  </LinearGradient>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Earned Badges ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Earned Badges</Text>
        <View style={styles.badgeGrid}>
          {badges.map((badge) => (
            <View key={badge.id} style={[styles.badgeItem, badge.earned && styles.badgeItemEarned]}>
              <View style={[styles.badgeIconBox, !badge.earned && styles.lockedBadge, badge.earned && { borderColor: badge.color + '66' }]}>
                <Ionicons name={badge.icon as any} size={24} color={badge.earned ? badge.color : COLORS.textMuted} />
              </View>
              <Text style={[styles.badgeName, badge.earned && { color: badge.color }]}>{badge.name}</Text>
              {badge.earned && <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatTile({ value, label, color, icon, isStreak }: any) {
  return (
    <View style={[styles.statTile, { borderColor: color + '22' }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.statValueRow}>
        {isStreak && <Ionicons name="flash" size={16} color={color} style={{ marginRight: 2 }} />}
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  centered: { alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 12, color: COLORS.textMuted },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerLabel: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 20, color: COLORS.text, fontWeight: '900' },

  section: { paddingHorizontal: SPACING.md, marginBottom: SPACING.xl },
  sectionTitle: { fontSize: 18, color: COLORS.text, fontWeight: '900', marginBottom: SPACING.md },

  // Stat tiles
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile: {
    width: '47%', flexGrow: 1,
    backgroundColor: COLORS.bgElevated,
    padding: 18, borderRadius: RADIUS.lg,
    borderWidth: 1, gap: 6,
  },
  statIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '900', fontStyle: 'italic' },
  statLabel: { fontSize: 9, color: COLORS.textSub, fontWeight: '800', letterSpacing: 1.5 },

  // Streak
  streakCard: {
    padding: 20, borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(25,25,29,0.5)',
    overflow: 'hidden', gap: 12,
  },
  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  streakTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  streakSub: { fontSize: 12, color: COLORS.textSub, marginTop: 4, maxWidth: '75%' },
  streakBubble: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,245,255,0.1)',
    borderWidth: 2, borderColor: COLORS.neonCyan,
    alignItems: 'center', justifyContent: 'center',
  },
  streakNumber: { fontSize: 22, fontWeight: '900', color: COLORS.neonCyan },
  streakDayLabel: { fontSize: 7, fontWeight: '800', color: COLORS.neonCyan, letterSpacing: 1 },
  streakProgressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 9, fontWeight: '800', color: COLORS.neonCyan, letterSpacing: 1 },
  progressBarBg: { height: 8, backgroundColor: COLORS.bgCard, borderRadius: 4 },
  progressBarFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.neonCyan },
  streakLevels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  levelLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600' },

  // Genres
  card: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg,
    padding: 16, gap: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  genreItem: { gap: 6 },
  genreLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  genreName: { fontSize: 11, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase' },
  genrePercent: { fontSize: 11, fontWeight: '900' },
  genreBarBg: { height: 6, backgroundColor: COLORS.bgCard, borderRadius: 3, overflow: 'hidden' },
  genreBarFill: { height: '100%', borderRadius: 3 },

  // Badges
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeItem: {
    width: '30%', flexGrow: 1,
    alignItems: 'center', gap: 6,
    backgroundColor: COLORS.bgElevated,
    padding: 14, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  badgeItemEarned: { borderColor: 'rgba(191,95,255,0.3)' },
  badgeIconBox: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(191,95,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(191,95,255,0.15)',
  },
  lockedBadge: { opacity: 0.3, backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'transparent' },
  badgeName: { fontSize: 8, fontWeight: '900', color: COLORS.textSub, letterSpacing: 1, textAlign: 'center' },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },

  emptyBox: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg,
    padding: 30, alignItems: 'center', gap: 10,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(189,157,255,0.15)',
  },
  emptyText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },
});
