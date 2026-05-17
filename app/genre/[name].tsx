import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../src/constants/theme';
import { animeAPI, Anime } from '../../src/lib/supabase';
import AnimeCard from '../../src/components/ui/AnimeCard';

export default function GenreBrowseScreen() {
  const { name } = useLocalSearchParams();
  const genre = name as string;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [anime, setAnime] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (genre) {
      animeAPI.getByGenre(genre, 50).then(({ data }) => {
        setAnime(data || []);
        setLoading(false);
      });
    }
  }, [genre]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
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
          <Text style={styles.emptyText}>No anime found for {genre}</Text>
        </View>
      ) : (
        <FlatList
          data={anime}
          keyExtractor={item => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <AnimeCard
              anime={item}
              size="sm"
              onPress={() => router.push(`/anime/${item.id}`)}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerSub: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 22, color: COLORS.text, fontWeight: '900' },
  count: { marginLeft: 'auto', fontSize: 12, color: COLORS.textMuted },
  grid: { padding: SPACING.sm },
  row: { gap: SPACING.sm, marginBottom: SPACING.sm },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  emptyText: { fontSize: 13, color: COLORS.textMuted },
});
