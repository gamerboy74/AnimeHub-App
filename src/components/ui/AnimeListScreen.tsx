import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { animeAPI } from '../../lib/supabase';

export type ListType = 'trending' | 'top-rated' | 'new-arrivals';

// ─── Jikan entry shape ────────────────────────────────────────────────────────
interface JikanEntry {
  mal_id: number;
  title: string;
  title_english?: string;
  images: { jpg: { large_image_url?: string; image_url: string } };
  score?: number;
  type?: string;
  year?: number;
  members?: number;
  synopsis?: string;
  genres?: { name: string }[];
  status?: string;
}

// ─── Per-type Jikan endpoint config ──────────────────────────────────────────
const CONFIG: Record<ListType, { title: string; label: string; url: string }> = {
  'trending': {
    title: 'Trending',
    label: '🔥 TRENDING NOW',
    url: 'https://api.jikan.moe/v4/top/anime?filter=airing&limit=25',
  },
  'top-rated': {
    title: 'Top Rated',
    label: '⭐ TOP RATED',
    url: 'https://api.jikan.moe/v4/top/anime?limit=25',
  },
  'new-arrivals': {
    title: 'New Arrivals',
    label: '🆕 THIS SEASON',
    url: 'https://api.jikan.moe/v4/seasons/now?limit=25',
  },
};

interface Props { type: ListType }

export default function AnimeListScreen({ type }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cfg = CONFIG[type];

  const [data, setData] = useState<JikanEntry[]>([]);
  const [idMap, setIdMap] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      // Fetch Jikan + local mal_id→uuid map in parallel
      const [res, localMap] = await Promise.all([
        fetch(cfg.url, { headers: { Accept: 'application/json' } }),
        animeAPI.getMalIdMap(),
      ]);

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();

      // Deduplicate by mal_id
      const seen = new Set<number>();
      const unique: JikanEntry[] = (json.data ?? []).filter((e: JikanEntry) => {
        if (seen.has(e.mal_id)) return false;
        seen.add(e.mal_id);
        return true;
      });

      setIdMap(localMap);
      setData(unique);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [type]);

  useEffect(() => { setLoading(true); setData([]); fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const inAppCount = data.filter(e => idMap.has(e.mal_id)).length;

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
        {data.length > 0 && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.count}>{data.length} anime</Text>
            {inAppCount > 0 && (
              <Text style={styles.countSub}>{inAppCount} watchable</Text>
            )}
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.neon} size="large" />
          <Text style={styles.loadingText}>Fetching from MyAnimeList…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="wifi-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, i) => `${item.mal_id}_${i}`}
          numColumns={2}
          contentContainerStyle={styles.list}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.neon} />
          }
          renderItem={({ item, index }) => {
            const supabaseId = idMap.get(item.mal_id);
            const inApp = !!supabaseId;
            return (
              <TouchableOpacity
                style={[styles.card, !inApp && styles.cardDimmed]}
                onPress={() => inApp ? router.push(`/anime/${supabaseId}` as any) : null}
                activeOpacity={inApp ? 0.75 : 0.95}
              >
                {/* Rank badge */}
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>

                {/* Availability badge */}
                {inApp ? (
                  <View style={styles.availBadge}>
                    <Ionicons name="play-circle" size={12} color={COLORS.neon} />
                  </View>
                ) : (
                  <View style={[styles.availBadge, styles.unavailBadge]}>
                    <Ionicons name="lock-closed" size={10} color={COLORS.textMuted} />
                  </View>
                )}

                <Image
                  source={{ uri: item.images.jpg.large_image_url ?? item.images.jpg.image_url }}
                  style={styles.poster}
                  resizeMode="cover"
                />

                {/* Gradient overlay at bottom */}
                <LinearGradient
                  colors={['transparent', 'rgba(8,8,16,0.85)']}
                  style={styles.posterGradient}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                >
                  <View />
                </LinearGradient>

                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title_english || item.title}
                  </Text>
                  <View style={styles.cardMeta}>
                    {item.score ? (
                      <View style={styles.ratingRow}>
                        <Ionicons name="star" size={10} color={COLORS.neonGold} />
                        <Text style={styles.ratingText}>{item.score.toFixed(1)}</Text>
                      </View>
                    ) : null}
                    {item.type ? <Text style={styles.metaText}>{item.type}</Text> : null}
                    {item.year  ? <Text style={styles.metaText}>{item.year}</Text> : null}
                  </View>

                  {/* Genre pills */}
                  {item.genres && item.genres.length > 0 && (
                    <View style={styles.genreRow}>
                      {item.genres.slice(0, 2).map((g) => (
                        <View key={g.name} style={styles.genrePill}>
                          <Text style={styles.genreText}>{g.name}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {!inApp && (
                    <Text style={styles.notAvail}>Not in app yet</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

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
  countSub: { fontSize: 10, color: COLORS.neon, fontWeight: '700' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 12, color: COLORS.textMuted },
  errorText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.xl },
  retryBtn: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    backgroundColor: 'rgba(191,95,255,0.12)',
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.neon,
  },
  retryText: { color: COLORS.neon, fontWeight: '700' },

  list: { padding: SPACING.sm, paddingBottom: 100 },
  row: { gap: 8, marginBottom: 8 },

  card: {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardDimmed: { opacity: 0.65 },

  rankBadge: {
    position: 'absolute', top: 8, left: 8, zIndex: 3,
    backgroundColor: 'rgba(8,8,16,0.85)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: COLORS.neon,
  },
  rankText: { fontSize: 9, color: COLORS.neon, fontWeight: '900' },

  availBadge: {
    position: 'absolute', top: 8, right: 8, zIndex: 3,
    backgroundColor: 'rgba(8,8,16,0.85)',
    borderRadius: 12, width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(191,95,255,0.4)',
  },
  unavailBadge: { borderColor: 'rgba(255,255,255,0.1)' },

  poster: { width: '100%', aspectRatio: 2 / 3 },
  posterGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 40,
  },

  cardInfo: { padding: 8, gap: 3 },
  cardTitle: { fontSize: 11, color: COLORS.text, fontWeight: '700', lineHeight: 15 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 10, color: COLORS.neonGold, fontWeight: '700' },
  metaText: { fontSize: 9, color: COLORS.textMuted },

  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 2 },
  genrePill: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  genreText: { fontSize: 8, color: COLORS.textSub, fontWeight: '600' },

  notAvail: { fontSize: 9, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 2 },
});
