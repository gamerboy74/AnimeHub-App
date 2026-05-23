import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ScheduleEntry {
  mal_id: number;
  title: string;
  title_english?: string;
  images: { jpg: { image_url: string } };
  aired?: { from?: string };
  broadcast?: { day?: string; time?: string; timezone?: string };
  episodes?: number;
  score?: number;
  genres?: { name: string }[];
  synopsis?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const todayIndex = () => {
  // JS getDay(): 0=Sun,1=Mon,...,6=Sat → map to our 0=Mon index
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
};

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedDay, setSelectedDay] = useState(todayIndex());
  const [schedule, setSchedule] = useState<Record<string, ScheduleEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedule = useCallback(async () => {
    setError(null);
    try {
      // Jikan v4 — free, no API key. Fetches currently airing schedule per day.
      const results: Record<string, ScheduleEntry[]> = {};
      const day = DAYS[selectedDay].toLowerCase();
      const res = await fetch(
        `https://api.jikan.moe/v4/schedules?filter=${day}&limit=25`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!res.ok) throw new Error(`Jikan API error: ${res.status}`);
      const json = await res.json();
      results[DAYS[selectedDay]] = json.data ?? [];
      setSchedule(results);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDay]);

  useEffect(() => {
    setLoading(true);
    setSchedule({});
    fetchSchedule();
  }, [fetchSchedule]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSchedule();
  };

  const entries: ScheduleEntry[] = schedule[DAYS[selectedDay]] ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>// AIRING SCHEDULE</Text>
          <Text style={styles.headerTitle}>This Week</Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Day selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayScroll}
        contentContainerStyle={styles.dayScrollContent}
      >
        {DAYS.map((day, i) => {
          const isToday = i === todayIndex();
          const isSelected = i === selectedDay;
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayChip, isSelected && styles.dayChipActive]}
              onPress={() => setSelectedDay(i)}
              activeOpacity={0.7}
            >
              {isSelected && (
                <LinearGradient
                  colors={['rgba(191,95,255,0.3)', 'rgba(191,95,255,0.05)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              <Text style={[styles.dayShort, isSelected && styles.dayShortActive]}>
                {DAY_SHORT[i]}
              </Text>
              {isToday && <View style={styles.todayDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.neon} size="large" />
          <Text style={styles.loadingText}>Loading schedule…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="wifi-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchSchedule}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="calendar-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.errorText}>No anime airing on {DAYS[selectedDay]}</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.mal_id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.neon}
              colors={[COLORS.neon]}
            />
          }
          ListHeaderComponent={
            <Text style={styles.sectionLabel}>
              {entries.length} anime airing on {DAYS[selectedDay]}
            </Text>
          }
          renderItem={({ item }) => (
            <ScheduleCard entry={item} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

// ─── Schedule Card ─────────────────────────────────────────────────────────────
function ScheduleCard({ entry }: { entry: ScheduleEntry }) {
  const airTime = entry.broadcast?.time;
  const airDay = entry.broadcast?.day;

  return (
    <View style={styles.card}>
      {/* Thumbnail */}
      <Image
        source={{ uri: entry.images.jpg.image_url }}
        style={styles.cardThumb}
        resizeMode="cover"
      />

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {entry.title_english || entry.title}
        </Text>

        {/* Air time badge */}
        {airTime && (
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={12} color={COLORS.neonCyan} />
            <Text style={styles.timeText}>
              {airDay} at {airTime} JST
            </Text>
          </View>
        )}

        {/* Score + episodes */}
        <View style={styles.metaRow}>
          {entry.score ? (
            <View style={styles.scoreBadge}>
              <Ionicons name="star" size={11} color={COLORS.neonGold} />
              <Text style={styles.scoreText}>{entry.score.toFixed(1)}</Text>
            </View>
          ) : null}
          {entry.episodes ? (
            <Text style={styles.epCount}>{entry.episodes} eps</Text>
          ) : (
            <Text style={styles.epCount}>? eps</Text>
          )}
        </View>

        {/* Genres */}
        {entry.genres && entry.genres.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll}>
            {entry.genres.slice(0, 3).map((g) => (
              <View key={g.name} style={styles.genrePill}>
                <Text style={styles.genreText}>{g.name}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerLabel: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 18, color: COLORS.text, fontWeight: '800' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,45,120,0.12)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,45,120,0.4)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.neonPink,
  },
  liveText: { fontSize: 10, color: COLORS.neonPink, fontWeight: '800', letterSpacing: 1 },

  // Day selector
  dayScroll: { flexGrow: 0, marginVertical: SPACING.sm },
  dayScrollContent: { paddingHorizontal: SPACING.md, gap: 8 },
  dayChip: {
    minWidth: 52,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    position: 'relative',
  },
  dayChipActive: { borderColor: COLORS.neon },
  dayShort: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  dayShortActive: { color: COLORS.neon, fontWeight: '800' },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.neonPink,
    marginTop: 3,
  },

  // Content
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 13, color: COLORS.textMuted },
  errorText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl },
  retryBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(191,95,255,0.12)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.neon,
  },
  retryText: { color: COLORS.neon, fontWeight: '700' },

  list: { paddingHorizontal: SPACING.md, paddingBottom: 100 },
  sectionLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  separator: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  // Card
  card: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  cardThumb: {
    width: 72,
    height: 100,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
  },
  cardInfo: { flex: 1, justifyContent: 'center', gap: 6 },
  cardTitle: { fontSize: 14, color: COLORS.text, fontWeight: '700', lineHeight: 20 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 11, color: COLORS.neonCyan, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,214,0,0.1)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,214,0,0.3)',
  },
  scoreText: { fontSize: 11, color: COLORS.neonGold, fontWeight: '700' },
  epCount: { fontSize: 11, color: COLORS.textMuted },
  genreScroll: { flexGrow: 0 },
  genrePill: {
    backgroundColor: 'rgba(191,95,255,0.08)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  genreText: { fontSize: 10, color: COLORS.textSub, fontWeight: '600' },
});
