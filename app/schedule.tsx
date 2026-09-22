import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { COLORS, SPACING, RADIUS, TOUCH } from '../src/constants/theme';
import { animeAPI } from '../src/lib/supabase';
import { haptic } from '../src/lib/haptics';
import {
  fetchAiringSchedule,
  getScheduleDates,
  ScheduleEntry,
} from '../src/lib/schedule';



// ─── Screen ────────────────────────────────────────────────────────────────────
export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const scheduleDates = useMemo(() => getScheduleDates(), []);
  const todayIndex = useMemo(() => {
    const idx = scheduleDates.findIndex(d => d.isToday);
    return idx >= 0 ? idx : 2;
  }, [scheduleDates]);

  const [selectedIndex, setSelectedIndex] = useState(todayIndex);
  const [filterTab, setFilterTab] = useState<'in_app' | 'all'>('in_app');

  const selectedDate = scheduleDates[selectedIndex] || scheduleDates[todayIndex];

  const {
    data: scheduleData,
    isLoading: loading,
    isRefetching: refreshing,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['airing-schedule', selectedDate?.date],
    enabled: !!selectedDate,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const [scheduleItems, malIdMap] = await Promise.all([
        fetchAiringSchedule(selectedDate),
        animeAPI.getMalIdMap(),
      ]);
      return {
        entries: scheduleItems,
        idMap: malIdMap,
      };
    },
  });

  const entries = useMemo(() => scheduleData?.entries ?? [], [scheduleData]);
  const idMap = useMemo(() => scheduleData?.idMap ?? new Map<number, string>(), [scheduleData]);
  const error = queryError ? 'Could not load airing schedule. Please try again.' : null;

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const watchableCount = useMemo(() => {
    return entries.filter(e => idMap.has(e.mal_id)).length;
  }, [entries, idMap]);

  const displayedEntries = useMemo(() => {
    if (filterTab === 'in_app') {
      return entries.filter(e => idMap.has(e.mal_id));
    }
    // Show all airing anime, sorting watchable in-app anime to the top
    return [...entries].sort((a, b) => {
      const aInApp = idMap.has(a.mal_id);
      const bInApp = idMap.has(b.mal_id);
      if (aInApp && !bInApp) return -1;
      if (!aInApp && bInApp) return 1;
      const ta = a.broadcast?.time ?? '99:99';
      const tb = b.broadcast?.time ?? '99:99';
      return ta.localeCompare(tb);
    });
  }, [entries, filterTab, idMap]);

  const renderItem = useCallback(({ item, index }: { item: ScheduleEntry; index: number }) => (
    <TimelineRow entry={item} index={index} idMap={idMap} />
  ), [idMap]);

  const keyExtractor = useCallback((item: ScheduleEntry, index: number) => `${item.mal_id}_${index}`, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Gradient header bg ── */}
      <LinearGradient
        colors={['rgba(255,43,60,0.18)', 'transparent']}
        style={styles.headerGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        <View />
      </LinearGradient>

      {/* ── Back button ── */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 8 }]}
        onPress={() => {
          haptic.selection();
          router.back();
        }}
        hitSlop={TOUCH.hitSlop}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={20} color={COLORS.text} />
      </TouchableOpacity>

      {/* ── Header block — never shrinks ── */}
      <View style={styles.headerBlock}>
        {/* ── Title ── */}
        <View style={styles.titleSection}>
          <Text style={styles.titleMain}>Airing Schedule</Text>
          <Text style={styles.titleSub}>Keep track of your favorite anime airing times</Text>
        </View>

        {/* ── 5 Dates at a glance (no scroll) ── */}
        <View style={styles.datesRow}>
          {scheduleDates.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <TouchableOpacity
                key={item.dateKey}
                style={[
                  styles.dayChip,
                  isSelected && styles.dayChipActive,
                  item.isToday && !isSelected && styles.dayChipToday,
                ]}
                onPress={() => setSelectedIndex(index)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayShort, isSelected && styles.dayShortActive]}>
                  {item.dayShort}
                </Text>
                <Text style={[styles.dayNum, isSelected && styles.dayNumActive]}>
                  {item.dayNum}
                </Text>
                {item.isToday ? (
                  <View style={[styles.todayBadge, isSelected && styles.todayBadgeActive]}>
                    <Text style={[styles.todayBadgeText, isSelected && styles.todayBadgeTextActive]}>
                      TODAY
                    </Text>
                  </View>
                ) : (
                  <View style={styles.todayPlaceholder} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

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
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Filter Pills: Watchable first & active by default */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterPill, filterTab === 'in_app' && styles.filterPillActive]}
              onPress={() => setFilterTab('in_app')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="play-circle"
                size={14}
                color={filterTab === 'in_app' ? COLORS.neon : COLORS.textMuted}
              />
              <Text style={[styles.filterPillText, filterTab === 'in_app' && styles.filterPillTextActive]}>
                Watchable in App ({watchableCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, filterTab === 'all' && styles.filterPillActive]}
              onPress={() => setFilterTab('all')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="globe-outline"
                size={14}
                color={filterTab === 'all' ? COLORS.neon : COLORS.textMuted}
              />
              <Text style={[styles.filterPillText, filterTab === 'all' && styles.filterPillTextActive]}>
                All Airing ({entries.length})
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={displayedEntries}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.neon} />
            }
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons
                  name={filterTab === 'in_app' ? 'play-outline' : 'calendar-outline'}
                  size={48}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emptyTitle}>
                  {filterTab === 'in_app' ? 'No Watchable Anime Airing' : 'No Airing Anime Found'}
                </Text>
                <Text style={styles.emptySubText}>
                  {filterTab === 'in_app'
                    ? `None of the ${entries.length} anime airing on ${selectedDate?.dayFull ?? 'this day'} are in your catalog yet.`
                    : `No broadcast schedules reported for ${selectedDate?.dayFull ?? 'this day'}.`}
                </Text>
                {filterTab === 'in_app' && entries.length > 0 && (
                  <TouchableOpacity style={styles.showAllBtn} onPress={() => setFilterTab('all')}>
                    <Text style={styles.showAllBtnText}>Show All Airing ({entries.length})</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            renderItem={renderItem}
          />
        </>
      )}
    </View>
  );
}

// ─── Timeline row — left / right alternating ────────────────────────────────────
const TimelineRow = React.memo(
  ({
    entry,
    index,
    idMap,
  }: {
    entry: ScheduleEntry;
    index: number;
    idMap: Map<number, string>;
  }) => {
    const isLeft = index % 2 === 0;
    const airTime = formatTime(entry.broadcast?.time);
    const epNum = entry.episodes;

    return (
      <View style={styles.row}>
        {/* Left side */}
        <View style={styles.rowSide}>
          {isLeft ? (
            <AnimeCard entry={entry} align="right" idMap={idMap} />
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
            <AnimeCard entry={entry} align="left" idMap={idMap} />
          )}
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.entry.mal_id === nextProps.entry.mal_id &&
      prevProps.index === nextProps.index &&
      prevProps.idMap === nextProps.idMap
    );
  }
);

// ─── Anime card ────────────────────────────────────────────────────────────────
const AnimeCard = React.memo(
  ({
    entry,
    align,
    idMap,
  }: {
    entry: ScheduleEntry;
    align: 'left' | 'right';
    idMap: Map<number, string>;
  }) => {
    const router = useRouter();
    const supabaseId = idMap.get(entry.mal_id);

    const handlePress = () => {
      if (supabaseId) router.push(`/anime/${supabaseId}` as any);
    };

    return (
      <TouchableOpacity
        style={[styles.card, align === 'right' ? styles.cardRight : styles.cardLeft]}
        onPress={handlePress}
        activeOpacity={supabaseId ? 0.7 : 1}
        disabled={!supabaseId}
      >
        <Image
          source={{ uri: entry.images.jpg.image_url }}
          style={styles.cardThumb}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {entry.title_english || entry.title}
          </Text>
          {supabaseId ? (
            <View style={styles.watchNowBadge}>
              <Ionicons name="play" size={9} color="#000" />
              <Text style={styles.watchNowText}>WATCH NOW</Text>
            </View>
          ) : (
            <View style={styles.airingBadge}>
              <Text style={styles.airingBadgeText}>AIRING</Text>
            </View>
          )}
          {entry.synopsis ? (
            <Text style={styles.cardSynopsis} numberOfLines={3}>
              {entry.synopsis}
            </Text>
          ) : null}
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
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.entry.mal_id === nextProps.entry.mal_id &&
      prevProps.align === nextProps.align &&
      prevProps.idMap === nextProps.idMap
    );
  }
);

// ─── Time label ────────────────────────────────────────────────────────────────
const TimeLabel = React.memo(
  ({ time, episode, align }: { time: string; episode?: number; align: 'left' | 'right' }) => {
    return (
      <View style={[styles.timeLabel, align === 'right' ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
        <Text style={styles.timeLabelTime}>{time}</Text>
        {episode ? (
          <Text style={styles.timeLabelEp}>EPISODE {episode}</Text>
        ) : null}
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.time === nextProps.time &&
      prevProps.episode === nextProps.episode &&
      prevProps.align === nextProps.align
    );
  }
);

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

  // Header block — flexShrink:0 prevents FlatList from squeezing it
  headerBlock: { flexShrink: 0 },


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
    width: 40,
    height: 40,
    borderRadius: 20,
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

  // Day selector — 5 fixed chips in a single row with zero scrolling
  datesRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: 6,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dayChipActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  dayChipToday: {
    borderColor: 'rgba(255,43,60,0.45)',
    backgroundColor: 'rgba(255,43,60,0.08)',
  },
  dayShort: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  dayShortActive: { color: '#0a0a12' },
  dayNum: { fontSize: 19, color: COLORS.text, fontWeight: '800', marginTop: 2 },
  dayNumActive: { color: '#0a0a12' },
  todayBadge: {
    marginTop: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(255,43,60,0.25)',
  },
  todayBadgeActive: {
    backgroundColor: 'rgba(10,10,18,0.15)',
  },
  todayBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.neon,
    letterSpacing: 0.5,
  },
  todayBadgeTextActive: {
    color: '#0a0a12',
  },
  todayPlaceholder: {
    height: 15,
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
    backgroundColor: 'rgba(255,43,60,0.12)',
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

  // In-app & airing badges
  watchNowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.neonGold,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  watchNowText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  airingBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  airingBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },

  // Filter bar
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: 8,
    marginVertical: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(255,43,60,0.18)',
    borderColor: COLORS.neon,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  // Empty state
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 8,
  },
  emptySubText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
  showAllBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,43,60,0.15)',
    borderWidth: 1,
    borderColor: COLORS.neon,
  },
  showAllBtnText: {
    color: COLORS.neon,
    fontWeight: '700',
    fontSize: 12,
  },
});
