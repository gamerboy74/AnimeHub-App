import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, TOUCH } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { userAPI } from '../src/lib/supabase';
import { BADGE_DEFS } from '../src/constants/badges';
import { haptic } from '../src/lib/haptics';
import {
  computeGenres,
  computeStreak,
  computeLongestStreak,
  computeWatchTime,
  computeCompletedAnime,
  formatWatchTime,
  computeWeeklyActivity,
  GENRE_COLORS,
} from '../src/lib/userStats';

// ─── Animated badge glow component ───────────────────────────────────────────
function BadgeCard({ badge }: { badge: any }) {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!badge.earned) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, [badge.earned]);

  const { cur, max } = badge.progress;
  const pct = Math.round((cur / max) * 100);
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });

  return (
    <View style={[
      styles.badgeItem,
      badge.earned
        ? { borderColor: badge.color + '60', backgroundColor: badge.color + '0D' }
        : { borderColor: COLORS.border, opacity: 0.65 },
    ]}>
      {/* Glow ring behind icon (earned only) */}
      {badge.earned && (
        <Animated.View style={[styles.badgeGlow, { backgroundColor: badge.color, opacity: glowOpacity }]} />
      )}

      <View style={[
        styles.badgeIconBox,
        { borderColor: badge.earned ? badge.color + '80' : 'transparent',
          backgroundColor: badge.earned ? badge.color + '22' : 'rgba(30,30,36,0.8)' },
      ]}>
        <Ionicons name={badge.icon as any} size={22} color={badge.earned ? badge.color : COLORS.textMuted} />
        {badge.earned && (
          <View style={[styles.checkBadge, { backgroundColor: badge.color }]}>
            <Ionicons name="checkmark" size={8} color="#000" />
          </View>
        )}
      </View>

      <Text style={[styles.badgeName, badge.earned && { color: badge.color }]}>{badge.name}</Text>
      <Text style={styles.badgeDesc} numberOfLines={1}>{badge.desc}</Text>

      {/* Progress bar */}
      <View style={styles.badgeProgressBg}>
        <View style={[styles.badgeProgressFill, {
          width: `${pct}%`,
          backgroundColor: badge.earned ? badge.color : COLORS.textMuted,
        }]} />
      </View>
      <Text style={[styles.badgeProgressLabel, badge.earned && { color: badge.color }]}>
        {badge.earned ? '✓ EARNED' : `${cur}/${max}`}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [allProgress, setAllProgress] = useState<any[]>([]);
  const [watchlist, setWatchlist]     = useState<any[]>([]);
  const [dbStats, setDbStats]         = useState<any>(null);
  const [dbBadges, setDbBadges]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [progressRes, watchlistRes, statsRes, badgesRes] = await Promise.all([
        userAPI.getProgressLight(user.id),
        userAPI.getWatchlistLight(user.id),
        userAPI.getUserStats(user.id),
        userAPI.getUserBadges(user.id),
      ]);
      
      if (progressRes.error) {
        console.error('[Stats] Error fetching watch progress:', progressRes.error);
      }
      if (watchlistRes.error) {
        console.error('[Stats] Error fetching watchlist:', watchlistRes.error);
      }

      setAllProgress(progressRes.data || []);
      setWatchlist(watchlistRes.data || []);
      
      if (statsRes && !statsRes.error && statsRes.data) {
        setDbStats(statsRes.data);
      } else {
        setDbStats(null);
      }
      
      if (badgesRes && !badgesRes.error && badgesRes.data) {
        setDbBadges(badgesRes.data);
      } else {
        setDbBadges([]);
      }
    } catch (err) {
      console.error('[Stats] Unexpected error loading stats data:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const streak = useMemo(() => {
    return dbStats ? dbStats.current_streak : computeStreak(allProgress);
  }, [allProgress, dbStats]);

  const longestStreak = useMemo(() => {
    return dbStats ? dbStats.longest_streak : computeLongestStreak(allProgress);
  }, [allProgress, dbStats]);

  const genreStats    = useMemo(() => computeGenres(allProgress),         [allProgress]);
  
  const totalWatchSec = useMemo(() => {
    return dbStats ? dbStats.total_watch_time : computeWatchTime(allProgress);
  }, [allProgress, dbStats]);

  const completedCnt = useMemo(() => {
    return dbStats ? dbStats.completed_anime_count : computeCompletedAnime(allProgress);
  }, [allProgress, dbStats]);

  const weeklyActivity = useMemo(() => computeWeeklyActivity(allProgress), [allProgress]);
  const maxWeeklyMins = useMemo(
    () => Math.max(...weeklyActivity.map(d => d.minutes), 30),
    [weeklyActivity]
  );
  const weeklyTotalMins = useMemo(
    () => weeklyActivity.reduce((acc, d) => acc + d.minutes, 0),
    [weeklyActivity]
  );

  const badges = useMemo(
    () => BADGE_DEFS.map(b => {
      const earnedFromDb = dbBadges.some((dbB: any) => dbB.badge_code === b.code);
      const earnedFromClient = b.check(allProgress, longestStreak, watchlist);
      const earned = earnedFromDb || earnedFromClient;
      
      const progress = b.progress(allProgress, longestStreak, watchlist);
      if (earned) {
        progress.cur = progress.max; // ensure full bar visual if awarded
      }
      return {
        ...b,
        earned,
        progress,
      };
    }),
    [allProgress, longestStreak, watchlist, dbBadges]
  );

  const watchedToday = allProgress.some(
    p => new Date(p.last_watched).toDateString() === new Date().toDateString()
  );

  const earnedCount = badges.filter(b => b.earned).length;

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
        <TouchableOpacity
          style={styles.backBtn}
          hitSlop={TOUCH.hitSlop}
          activeOpacity={0.7}
          onPress={() => {
            haptic.selection();
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>⚡ YOUR STATS</Text>
          <Text style={styles.headerTitle}>My Statistics</Text>
        </View>
        <View style={styles.earnedPill}>
          <Text style={styles.earnedPillText}>{earnedCount}/{badges.length} badges</Text>
        </View>
      </View>

      {/* ── Stat Tiles — computed from real progress data ── */}
      <View style={styles.section}>
        <View style={styles.statsGrid}>
          <StatTile value={formatWatchTime(totalWatchSec)} label="WATCH TIME"  color={COLORS.neon}      icon="time-outline" />
          <StatTile value={String(completedCnt)}           label="COMPLETED"   color={COLORS.neonCyan}  icon="checkmark-circle-outline" />
          <StatTile value={String(allProgress.length)}     label="EPISODES"    color="#ff7346"          icon="play-outline" />
          <StatTile value={String(streak)}                 label="DAY STREAK"  color={COLORS.neonPulse} icon="flash" isStreak />
        </View>
      </View>

      {/* ── Streak Card ── */}
      <View style={styles.section}>
        {/* At-risk banner */}
        {streak > 0 && !watchedToday && (
          <View style={styles.atRiskBanner}>
            <Ionicons name="warning-outline" size={14} color="#FFD600" />
            <Text style={styles.atRiskText}>
              ⚠️ Watch an episode today to keep your {streak}-day streak!
            </Text>
          </View>
        )}
        <BlurView intensity={20} style={styles.streakCard}>
          <LinearGradient
            colors={['rgba(0,245,255,0.06)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          ><View /></LinearGradient>
          <View style={styles.streakHeader}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.streakTitle}>Current Streak</Text>
              <Text style={styles.streakSub}>
                {streak === 0
                  ? longestStreak > 0
                    ? `Best was ${longestStreak} days — start again today!`
                    : 'Start watching to build your streak!'
                  : watchedToday
                    ? '🔥 Great job! Streak maintained today.'
                    : `Watch 1 ep today to keep your ${streak}-day streak!`}
              </Text>
            </View>
            <View style={styles.streakBubble}>
              <Text style={styles.streakNumber}>{streak}</Text>
              <Text style={styles.streakDayLabel}>DAYS</Text>
            </View>
          </View>

          {/* Best streak row */}
          <View style={styles.bestStreakRow}>
            <Ionicons name="trophy-outline" size={12} color={COLORS.neonGold} />
            <Text style={styles.bestStreakText}>
              Best streak: <Text style={{ color: COLORS.neonGold, fontWeight: '900' }}>{longestStreak} days</Text>
            </Text>
          </View>

          <View style={styles.streakProgressLabels}>
            <Text style={styles.progressLabel}>PROGRESS TO 30</Text>
            <Text style={[styles.progressLabel, { color: COLORS.text }]}>{streak}/30</Text>
          </View>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={[COLORS.neonCyan, '#00F5B4']}
              style={[styles.progressBarFill, { width: `${Math.min((streak / 30) * 100, 100)}%` }]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            ><View /></LinearGradient>
          </View>
          <View style={styles.streakLevels}>
            <Text style={styles.levelLabel}>
              Lv.{Math.floor(streak / 7) + 1} {['Genin','Chunin','Jonin','Anbu','Kage'][Math.min(Math.floor(streak / 7), 4)]}
            </Text>
            <Text style={styles.levelLabel}>Next: {Math.min((Math.floor(streak / 7) + 1) * 7, 30)} days</Text>
          </View>
        </BlurView>
      </View>

      {/* ── Weekly Activity Chart ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Weekly Activity</Text>
          <Text style={styles.weeklyTotalLabel}>{formatWatchTime(weeklyTotalMins * 60)} this week</Text>
        </View>
        <BlurView intensity={20} style={styles.weeklyCard}>
          <LinearGradient
            colors={['rgba(255,43,60,0.08)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View />
          </LinearGradient>

          <View style={styles.chartContainer}>
            {weeklyActivity.map((day) => {
              const heightPct = Math.max((day.minutes / maxWeeklyMins) * 100, 8);
              return (
                <View key={day.dateStr} style={styles.barColumn}>
                  <Text style={[styles.barMinsText, day.isToday && { color: COLORS.neon }]}>
                    {day.minutes > 0 ? `${day.minutes}m` : '-'}
                  </Text>
                  <View style={styles.barTrack}>
                    <LinearGradient
                      colors={
                        day.isToday
                          ? [COLORS.neon, COLORS.neonPink]
                          : day.minutes > 0
                          ? [COLORS.neonCyan, '#00F5B4']
                          : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']
                      }
                      style={[
                        styles.barFill,
                        { height: `${heightPct}%` },
                        day.isToday && styles.barFillToday,
                      ]}
                      start={{ x: 0, y: 1 }}
                      end={{ x: 0, y: 0 }}
                    >
                      <View />
                    </LinearGradient>
                  </View>
                  <Text style={[styles.barDayLabel, day.isToday && styles.barDayLabelToday]}>
                    {day.dayLabel}
                  </Text>
                  <Text style={styles.barDateLabel}>
                    {day.dateStr.split(' ')[1] || ''}
                  </Text>
                </View>
              );
            })}
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
                    colors={[g.color, g.color + '55']}
                    style={[styles.genreBarFill, { width: `${g.percent}%` }]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  ><View /></LinearGradient>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Badges ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Badges</Text>
          <Text style={styles.earnedLabel}>{earnedCount} / {badges.length} earned</Text>
        </View>
        <View style={styles.badgeGrid}>
          {badges.map((badge) => <BadgeCard key={badge.id} badge={badge} />)}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── StatTile sub-component ───────────────────────────────────────────────────
function StatTile({ value, label, color, icon, isStreak }: any) {
  return (
    <View style={[styles.statTile, { borderColor: color + '30' }]}>
      <View style={[styles.statIconWrap, { backgroundColor: color + '18' }]}>
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 12, color: COLORS.textMuted },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: SPACING.sm,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerLabel: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 20, color: COLORS.text, fontWeight: '900' },
  earnedPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(255,43,60,0.12)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,43,60,0.35)',
  },
  earnedPillText: { fontSize: 10, color: COLORS.neon, fontWeight: '800' },

  section: { paddingHorizontal: SPACING.md, marginBottom: SPACING.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: SPACING.md },
  sectionTitle: { fontSize: 18, color: COLORS.text, fontWeight: '900' },
  earnedLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile: {
    width: '47%', flexGrow: 1, backgroundColor: COLORS.bgElevated,
    padding: 18, borderRadius: RADIUS.lg, borderWidth: 1, gap: 6,
  },
  statIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValueRow: { flexDirection: 'row', alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '900', fontStyle: 'italic' },
  statLabel: { fontSize: 9, color: COLORS.textSub, fontWeight: '800', letterSpacing: 1.5 },

  atRiskBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,214,0,0.08)',
    borderRadius: RADIUS.md, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,214,0,0.25)',
  },
  atRiskText: { fontSize: 11, color: '#FFD600', fontWeight: '700', flex: 1 },

  bestStreakRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 2,
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: 'rgba(255,214,0,0.12)',
  },
  bestStreakText: { fontSize: 11, color: COLORS.textSub, fontWeight: '600' },

  streakCard: { padding: 20, borderRadius: RADIUS.lg, backgroundColor: 'rgba(25,25,29,0.5)', overflow: 'hidden', gap: 12 },
  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  streakTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  streakSub: { fontSize: 12, color: COLORS.textSub, marginTop: 4 },
  streakBubble: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,245,255,0.1)', borderWidth: 2, borderColor: COLORS.neonCyan, alignItems: 'center', justifyContent: 'center' },
  streakNumber: { fontSize: 22, fontWeight: '900', color: COLORS.neonCyan },
  streakDayLabel: { fontSize: 7, fontWeight: '800', color: COLORS.neonCyan, letterSpacing: 1 },
  streakProgressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 9, fontWeight: '800', color: COLORS.neonCyan, letterSpacing: 1 },
  progressBarBg: { height: 8, backgroundColor: COLORS.bgCard, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  streakLevels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  levelLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600' },

  weeklyCard: {
    padding: 16,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(25,25,29,0.5)',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  weeklyTotalLabel: { fontSize: 11, color: COLORS.neon, fontWeight: '700' },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 130,
    paddingTop: 10,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    gap: 4,
  },
  barMinsText: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '700',
    marginBottom: 2,
  },
  barTrack: {
    width: 14,
    height: 70,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 7,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barFillToday: {
    shadowColor: COLORS.neon,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  barDayLabel: {
    fontSize: 10,
    color: COLORS.textSub,
    fontWeight: '700',
    marginTop: 4,
  },
  barDayLabelToday: {
    color: COLORS.neon,
    fontWeight: '900',
  },
  barDateLabel: {
    fontSize: 8,
    color: COLORS.textMuted,
    fontWeight: '600',
  },

  card: { backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, padding: 16, gap: 14, borderWidth: 1, borderColor: COLORS.border },
  genreItem: { gap: 6 },
  genreLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  genreName: { fontSize: 11, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase' },
  genrePercent: { fontSize: 11, fontWeight: '900' },
  genreBarBg: { height: 6, backgroundColor: COLORS.bgCard, borderRadius: 3, overflow: 'hidden' },
  genreBarFill: { height: '100%', borderRadius: 3 },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeItem: {
    width: '30%', flexGrow: 1, alignItems: 'center', gap: 4,
    backgroundColor: COLORS.bgElevated, padding: 12,
    borderRadius: RADIUS.md, borderWidth: 1, overflow: 'hidden',
  },
  badgeGlow: {
    position: 'absolute', top: -20, left: '50%', marginLeft: -20,
    width: 40, height: 40, borderRadius: 20,
  },
  badgeIconBox: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, position: 'relative',
  },
  checkBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.bgElevated,
  },
  badgeName: { fontSize: 8, fontWeight: '900', color: COLORS.textSub, letterSpacing: 1, textAlign: 'center' },
  badgeDesc: { fontSize: 7, color: COLORS.textMuted, textAlign: 'center' },
  badgeProgressBg: { width: '100%', height: 3, backgroundColor: COLORS.bgCard, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  badgeProgressFill: { height: '100%', borderRadius: 2 },
  badgeProgressLabel: { fontSize: 7, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.5 },

  emptyBox: { backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, padding: 30, alignItems: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.borderNeutral },
  emptyText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },
});
