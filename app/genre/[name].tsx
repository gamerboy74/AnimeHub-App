import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { COLORS, SPACING, TOUCH } from '../../src/constants/theme';
import { animeAPI, Anime } from '../../src/lib/supabase';
import AnimeCard from '../../src/components/ui/AnimeCard';
import { haptic } from '../../src/lib/haptics';

export default function GenreBrowseScreen() {
  const { name } = useLocalSearchParams();
  const genre = name as string;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const numColumns = windowWidth >= 1024 ? 6 : windowWidth >= 768 ? 5 : windowWidth >= 600 ? 4 : 3;
  const availableWidth = windowWidth - SPACING.sm * 2;
  const cardWidth = Math.floor((availableWidth - SPACING.sm * (numColumns - 1)) / numColumns);

  const { data: anime = [], isLoading: loading } = useQuery({
    queryKey: ['anime', 'genre', genre],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!genre,
    queryFn: async (): Promise<Anime[]> => {
      const { data, error } = await animeAPI.getByGenre(genre, 50);
      if (error) {
        Alert.alert('Error', `Could not load ${genre} anime. Please try again.`);
        throw error;
      }
      return data || [];
    },
  });

  const handleCardPress = useCallback((id: string) => {
    haptic.selection();
    router.push(`/anime/${id}`);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: Anime }) => (
    <AnimeCard
      anime={item}
      size="sm"
      style={{ width: cardWidth, marginRight: 0 }}
      onPress={handleCardPress}
    />
  ), [handleCardPress, cardWidth]);

  const keyExtractor = useCallback((item: Anime) => item.id, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
        <View>
          <Text style={styles.headerSub}>// GENRE</Text>
          <Text style={styles.headerTitle}>{genre?.toUpperCase()}</Text>
        </View>
        {!loading && <Text style={styles.count}>{anime.length} titles</Text>}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.neon} style={{ marginTop: SPACING.xl }} />
      ) : anime.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="film-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No anime found for {genre}</Text>
          <Text style={styles.emptySub}>Check back later or browse other genres</Text>
        </View>
      ) : (
        <FlatList
          key={`genre-grid-${numColumns}`}
          data={anime}
          keyExtractor={keyExtractor}
          numColumns={numColumns}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 100 }]}
          columnWrapperStyle={styles.row}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerSub: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 22, color: COLORS.text, fontWeight: '900' },
  count: { marginLeft: 'auto', fontSize: 12, color: COLORS.textMuted },
  grid: { padding: SPACING.sm },
  row: { gap: SPACING.sm, marginBottom: SPACING.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  emptyText: { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },
  emptySub: { fontSize: 12, color: COLORS.textMuted },
});
