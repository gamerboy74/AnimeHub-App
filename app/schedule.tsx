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
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.42;

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ScheduleEntry {
  mal_id: number;
  title: string;
  title_english?: string;
  images: { jpg: { image_url: string } };
  broadcast?: { day?: string; time?: string; timezone?: string };
  episodes?: number;
  score?: number;
  genres?: { name: string }[];
  synopsis?: string;
}

// ─── Day helpers ───────────────────────────────────────────────────────────────
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as const;
const DAY_SHORT = ['MON','TUE','WED','THU','FRI','SAT','SUN'] as const;

function getTodayIndex() {
  const d = new Date().getDay(); // 0=Sun
  return d === 0 ? 6 : d - 1;   // 0=Mon
}

/** Returns the date for each day of the current week (Mon=0 … Sun=6) */
function getWeekDates() {
  const today = new Date();
  const todayIdx = getTodayIndex();
  return DAYS.map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + (i - todayIdx));
    return d.getDate();
  });
}

// ─── Screen ────────────────────────────────────────────────────────────────────
export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedDay, setSelectedDay] = useState(getTodayIndex());
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weekDates = getWeekDates();

  const fetchSchedule = useCallback(async () => {
    setError(null);
    try {
      const day = DAYS[selectedDay].toLowerCase();
      const res = await fetch(
        `https://api.jikan.moe/v4/schedules?filter=${day}&limit=25`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      // Sort by broadcast time
      const sorted = (json.data ?? []).sort((a: ScheduleEntry, b: ScheduleEntry) => {
        const ta = a.broadcast?.time ?? '99:99';
        const tb = b.broadcast?.time ?? '99:99';
        return ta.localeCompare(tb);
      });
      setEntries(sorted);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDay]);

  useEffect(() => {
    setLoading(true);
    setEntries([]);
    fetchSchedule();
  }, [fetchSchedule]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSchedule();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Gradient header bg ── */}
      <LinearGradient
        colors={['rgba(191,95,255,0.18)', 'transparent']}
        style={styles.headerGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <View />
      </LinearGradient>

      {/* ── Back button ── */}
      <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={20} color={COLORS.text} />
      </TouchableOpacity>

      {/* ── Title ── */}
      <View style={styles.titleSection}>
        <Text style={styles.titleMain}>Weekly Schedule</Text>
        <Text style={styles.titleSub}>Keep track of your favorite anime airing times</Text>
      </View>

      {/* ── Day selector ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayRow}
        style={styles.dayScroll}
      >
        {DAYS.map((day, i) => {
          const isSelected = i === selectedDay;
          const isToday = i === getTodayIndex();
          return (
            <TouchableOpacity
              key={day}
              style={[styles.dayChip, isSelected && styles.dayChipActive]}
              onPress={() => setSelectedDay(i)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayShort, isSelected && styles.dayShortActive]}>
                {DAY_SHORT[i]}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>
                {weekDates[i]}
              </Text>
              {isToday && !isSelected && <View style={styles.todayDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Content ── */}
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
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.mal_id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.neon} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="calendar-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.errorText}>No anime airing on {DAYS[selectedDay]}</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <TimelineRow entry={item} index={index} />
          )}
        />
      )}
    </View>
  );
}

// ─── Timeline row — left / right alternating ────────────────────────────────────
function TimelineRow({ entry, index }: { entry: ScheduleEntry; index: number }) {
  const isLeft = index % 2 === 0;
  const airTime = formatTime(entry.broadcast?.time);
  const epNum = entry.episodes;

  return (
    <View style={styles.row}>
      {/* Left side */}
      <View style={styles.rowSide}>
        {isLeft ? (
          <AnimeCard entry={entry} align="right" />
        ) : (
          <TimeLabel time={airTime} episode={epNum} align="right" />
        )}
      </View>

      {/* Center timeline */}
      <View style={styles.timelineCenter}>
        <View style={styles.timelineLine} />
        <View style={styles.timelineDot} />
        <View style={styles.timelineLine} />
      </View>

      {/* Right side */}
      <View style={styles.rowSide}>
        {isLeft ? (
          <TimeLabel time={airTime} episode={epNum} align="left" />
        ) : (
          <AnimeCard entry={entry} align="left" />
        )}
      </View>
    </View>
  );
}

// ─── Anime card ────────────────────────────────────────────────────────────────
function AnimeCard({ entry, align }: { entry: ScheduleEntry; align: 'left' | 'right' }) {
  return (
    <View style={[styles.card, align === 'right' ? styles.cardRight : styles.cardLeft]}>
      <Image
        source={{ uri: entry.images.jpg.image_url }}
        style={styles.cardThumb}
        resizeMode="cover"
      />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {entry.title_english || entry.title}
        </Text>
        {entry.synopsis ? (
          <Text style={styles.cardSynopsis} numberOfLines={3}>
            {entry.synopsis}
          </Text>
        ) : null}
        {/* Genres */}
        {entry.genres && entry.genres.length > 0 && (
          <View style={styles.genreRow}>
            {entry.genres.slice(0, 2).map((g) => (
              <View key={g.name} style={styles.genrePill}>
                <Text style={styles.genreText}>{g.name}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Time label ────────────────────────────────────────────────────────────────
function TimeLabel({ time, episode, align }: { time: string; episode?: number; align: 'left' | 'right' }) {
  return (
    <View style={[styles.timeLabel, align === 'right' ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
      <Text style={styles.timeLabelTime}>{time}</Text>
      {episode ? (
        <Text style={styles.timeLabelEp}>EPISODE {episode}</Text>
      ) : null}
    </View>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(t?: string): string {
  if (!t) return '??:??';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a12' },

  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 0,
  },

  backBtn: {
    position: 'absolute',
    left: SPACING.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  titleSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    zIndex: 1,
  },
  titleMain: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  titleSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },

  // Day selector
  dayScroll: { flexGrow: 0, zIndex: 1 },
  dayRow: {
    paddingHorizontal: SPACING.md,
    gap: 8,
    paddingBottom: SPACING.lg,
  },
  dayChip: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 52,
  },
  dayChipActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  dayShort: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 1 },
  dayShortActive: { color: '#0a0a12' },
  dayNum: { fontSize: 20, color: COLORS.text, fontWeight: '800', marginTop: 2 },
  dayNumActive: { color: '#0a0a12' },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.neon,
    marginTop: 4,
  },

  // Content
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingTop: 80,
  },
  loadingText: { fontSize: 13, color: COLORS.textMuted },
  errorText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
  retryBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(191,95,255,0.12)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.neon,
  },
  retryText: { color: COLORS.neon, fontWeight: '700' },

  list: { paddingBottom: 120, paddingTop: SPACING.sm },

  // Timeline row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 140,
    paddingVertical: 0,
  },
  rowSide: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },

  // Center timeline
  timelineCenter: {
    width: 24,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  timelineLine: {
    flex: 1,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    marginVertical: 2,
  },

  // Anime card
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginVertical: 8,
  },
  cardLeft: { flexDirection: 'row' },
  cardRight: { flexDirection: 'row' },
  cardThumb: {
    width: 60,
    height: 85,
    backgroundColor: COLORS.bgCard,
  },
  cardBody: {
    flex: 1,
    padding: 8,
    gap: 4,
  },
  cardTitle: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
    lineHeight: 17,
  },
  cardSynopsis: {
    fontSize: 10,
    color: COLORS.textMuted,
    lineHeight: 14,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  genrePill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  genreText: { fontSize: 9, color: COLORS.textSub, fontWeight: '600' },

  // Time label
  timeLabel: {
    paddingHorizontal: 4,
  },
  timeLabelTime: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '800',
  },
  timeLabelEp: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
});
