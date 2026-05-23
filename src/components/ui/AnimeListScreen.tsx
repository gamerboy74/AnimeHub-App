import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { animeAPI, AnimeWithStats } from '../../lib/supabase';

type ListType = 'trending' | 'top-rated' | 'new-arrivals';

const CONFIG: Record<ListType, { title: string; label: string; icon: string; fetcher: () => Promise<any> }> = {
  'trending': {
    title: 'Trending',
    label: '🔥 TRENDING NOW',
    icon: 'flame-outline',
    fetcher: async () => animeAPI.getTrending(50),
  },
  'top-rated': {
    title: 'Top Rated',
    label: '⭐ TOP RATED',
    icon: 'star-outline',
    fetcher: async () => animeAPI.getTopRated(50),
  },
  'new-arrivals': {
    title: 'New Arrivals',
    label: '🆕 NEW ARRIVALS',
    icon: 'time-outline',
    fetcher: async () => animeAPI.getRecent(50),
  },
};

interface Props { type: ListType }

export default function AnimeListScreen({ type }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cfg = CONFIG[type];

  const [data, setData] = useState<AnimeWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await cfg.fetcher();
      setData((res.data ?? []) as AnimeWithStats[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type]);

  useEffect(() => { setLoading(true); setData([]); fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>{cfg.label}</Text>
          <Text style={styles.headerTitle}>{cfg.title}</Text>
        </View>
        <Text style={styles.count}>{data.length > 0 ? `${data.length} anime` : ''}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.neon} size="large" />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.neon} />
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/anime/${item.id}` as any)}
              activeOpacity={0.75}
            >
              {/* Rank badge */}
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>

              <Image
                source={{ uri: item.poster_url ?? '' }}
                style={styles.poster}
                resizeMode="cover"
              />

              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.cardMeta}>
                  {item.user_rating_avg ? (
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={10} color={COLORS.neonGold} />
                      <Text style={styles.ratingText}>{Number(item.user_rating_avg).toFixed(1)}</Text>
                    </View>
                  ) : null}
                  {item.type ? <Text style={styles.metaText}>{item.type}</Text> : null}
                  {item.year  ? <Text style={styles.metaText}>{item.year}</Text> : null}
                </View>
                {type === 'trending' && item.total_watches ? (
                  <Text style={styles.watchCount}>
                    <Ionicons name="eye-outline" size={10} color={COLORS.textMuted} /> {item.total_watches} views
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const CARD_WIDTH = (SPACING.md * 2 + 8) / 2; // just for reference; we use flex

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

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
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerLabel: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 20, color: COLORS.text, fontWeight: '900' },
  count: { fontSize: 11, color: COLORS.textMuted },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  list: { padding: SPACING.md, paddingBottom: 100 },
  row: { gap: 10, marginBottom: 10 },

  card: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rankBadge: {
    position: 'absolute',
    top: 8, left: 8,
    zIndex: 2,
    backgroundColor: 'rgba(8,8,16,0.85)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.neon,
  },
  rankText: { fontSize: 10, color: COLORS.neon, fontWeight: '800' },
  poster: { width: '100%', aspectRatio: 3 / 4 },
  cardInfo: { padding: 8, gap: 4 },
  cardTitle: { fontSize: 12, color: COLORS.text, fontWeight: '700', lineHeight: 17 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 10, color: COLORS.neonGold, fontWeight: '700' },
  metaText: { fontSize: 10, color: COLORS.textMuted },
  watchCount: { fontSize: 10, color: COLORS.textMuted },
});
