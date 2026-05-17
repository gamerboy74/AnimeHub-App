import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';
import { userAPI } from '../src/lib/supabase';
import { useAuth } from '../src/context/AuthContext';

export default function WatchlistScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data } = await userAPI.getWatchlist(user.id);
      setWatchlist(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const removeItem = async (animeId: string) => {
    if (!user) return;
    await userAPI.removeFromWatchlist(user.id, animeId);
    setWatchlist(prev => prev.filter(w => w.anime_id !== animeId));
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="bookmark-outline" size={48} color={COLORS.textMuted} />
        <Text style={styles.guestTitle}>LOGIN TO SEE YOUR LIST</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
          <Text style={styles.loginBtnText}>SIGN IN</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerSub}>// LIBRARY</Text>
          <Text style={styles.headerTitle}>WATCHLIST</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.neon} style={{ marginTop: SPACING.xl }} />
      ) : watchlist.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>Nothing here yet</Text>
          <Text style={styles.emptySubText}>Browse anime and add to your list</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/')}>
            <Text style={styles.browseBtnText}>BROWSE ANIME →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={watchlist}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.neon} />}
          renderItem={({ item }) => {
            const anime = item.anime;
            if (!anime) return null;
            return (
              <TouchableOpacity
                style={styles.animeRow}
                onPress={() => router.push(`/anime/${anime.id}`)}
              >
                <Image
                  source={{ uri: anime.poster_url || '' }}
                  style={styles.poster}
                  resizeMode="cover"
                />
                <View style={styles.animeInfo}>
                  <Text style={styles.animeTitle} numberOfLines={2}>{anime.title}</Text>
                  {anime.title_japanese && (
                    <Text style={styles.animeTitleJp} numberOfLines={1}>{anime.title_japanese}</Text>
                  )}
                  <View style={styles.animeMeta}>
                    {anime.year && <Text style={styles.animeMetaText}>{anime.year}</Text>}
                    {anime.type && <Text style={styles.animeMetaText}>• {anime.type}</Text>}
                    {anime.status && <Text style={styles.animeMetaText}>• {anime.status}</Text>}
                  </View>
                  {anime.genres?.length > 0 && (
                    <Text style={styles.animeGenres} numberOfLines={1}>
                      {anime.genres.slice(0, 3).join(' · ')}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeItem(anime.id)}
                >
                  <Ionicons name="close" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerSub: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 22, color: COLORS.text, fontWeight: '900' },

  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  animeRow: {
    flexDirection: 'row', gap: SPACING.md,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  poster: { width: 75, height: 110, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard },
  animeInfo: { flex: 1, gap: 3 },
  animeTitle: { fontSize: 15, color: COLORS.text, fontWeight: '700', lineHeight: 20 },
  animeTitleJp: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 0.5 },
  animeMeta: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  animeMetaText: { fontSize: 11, color: COLORS.textSub },
  animeGenres: { fontSize: 11, color: COLORS.neon, marginTop: 2 },
  removeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center',
  },
  separator: { height: 1, backgroundColor: COLORS.border },

  guestTitle: { fontSize: 14, color: COLORS.textSub, fontWeight: '700', letterSpacing: 2 },
  loginBtn: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.neon, borderRadius: RADIUS.md,
  },
  loginBtnText: { color: COLORS.bg, fontWeight: '800', letterSpacing: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  emptyText: { fontSize: 14, color: COLORS.textSub, fontWeight: '700' },
  emptySubText: { fontSize: 12, color: COLORS.textMuted },
  browseBtn: {
    marginTop: SPACING.sm, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.neon, borderRadius: RADIUS.md,
  },
  browseBtnText: { color: COLORS.neon, fontWeight: '700', letterSpacing: 1, fontSize: 12 },
});
