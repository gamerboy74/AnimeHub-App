import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';
import { userAPI } from '../src/lib/supabase';
import { useAuth } from '../src/context/AuthContext';

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data } = await userAPI.getFavorites(user.id);
      setFavorites(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const removeItem = useCallback(async (animeId: string) => {
    if (!user) return;
    await userAPI.removeFavorite(user.id, animeId);
    setFavorites(prev => prev.filter(f => f.anime_id !== animeId));
  }, [user]);

  const handleCardPress = useCallback((id: string) => {
    router.push(`/anime/${id}`);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: any }) => (
    <FavoriteItemRow
      item={item}
      onPress={handleCardPress}
      onRemove={removeItem}
    />
  ), [handleCardPress, removeItem]);

  const keyExtractor = useCallback((item: any) => item.id, []);

  const ItemSeparator = useCallback(() => <View style={styles.separator} />, []);

  if (!user) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="heart-outline" size={48} color={COLORS.textMuted} />
        <Text style={styles.guestTitle}>LOGIN TO SEE YOUR FAVORITES</Text>
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
          <Text style={styles.headerSub}>// PROFILE</Text>
          <Text style={styles.headerTitle}>FAVORITES</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.neon} style={{ marginTop: SPACING.xl }} />
      ) : favorites.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="heart-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No favorites yet</Text>
          <Text style={styles.emptySubText}>Add anime to your favorites to see them here</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/')}>
            <Text style={styles.browseBtnText}>BROWSE ANIME →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.neon} />}
          renderItem={renderItem}
          ItemSeparatorComponent={ItemSeparator}
        />
      )}
    </View>
  );
}

// ─── MEMOIZED FAVORITE ITEM ROW ───────────────────────────────────────────────
interface FavoriteItemRowProps {
  item: any;
  onPress: (id: string) => void;
  onRemove: (id: string) => void;
}

const FavoriteItemRow = React.memo(
  ({ item, onPress, onRemove }: FavoriteItemRowProps) => {
    const anime = item.anime;
    if (!anime) return null;
    return (
      <TouchableOpacity
        style={styles.animeRow}
        onPress={() => onPress(anime.id)}
      >
        <Image
          source={{ uri: anime.poster_url || '' }}
          style={styles.poster}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.animeInfo}>
          <Text style={styles.animeTitle} numberOfLines={2}>{anime.title}</Text>
          <Text style={styles.animeGenres} numberOfLines={1}>
            {anime.genres?.slice(0, 3).join(' · ')}
          </Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={12} color={COLORS.neonGold} />
            <Text style={styles.ratingText}>{Number(anime.rating || 0).toFixed(1)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => onRemove(anime.id)}
        >
          <Ionicons name="heart" size={18} color={COLORS.neonPink} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.anime_id === nextProps.item.anime_id &&
      prevProps.item.anime?.id === nextProps.item.anime?.id &&
      prevProps.item.anime?.poster_url === nextProps.item.anime?.poster_url &&
      prevProps.item.anime?.title === nextProps.item.anime?.title &&
      prevProps.item.anime?.rating === nextProps.item.anime?.rating
    );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerSub: { fontSize: 10, color: COLORS.neonPulse || COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 22, color: COLORS.text, fontWeight: '900' },

  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  animeRow: {
    flexDirection: 'row', gap: SPACING.md,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  poster: { width: 75, height: 110, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard },
  animeInfo: { flex: 1, gap: 4 },
  animeTitle: { fontSize: 15, color: COLORS.text, fontWeight: '700' },
  animeGenres: { fontSize: 11, color: COLORS.textSub },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 11, color: COLORS.neonGold, fontWeight: '700' },
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
