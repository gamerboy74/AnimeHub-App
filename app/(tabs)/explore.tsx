import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, Modal,
  TouchableOpacity, ActivityIndicator, ScrollView, Image, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { animeAPI, Anime, AnimeWithStats } from '../../src/lib/supabase';
import AnimeCard from '../../src/components/ui/AnimeCard';
import { BlurView } from 'expo-blur';

const BENTO_GENRES = [
  { 
    id: 'action', 
    name: 'Action', 
    sub: 'Adrenaline-fueled epic battles', 
    color: '#FF7346', 
    img: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=500&auto=format&fit=crop' 
  },
  { 
    id: 'sci-fi', 
    name: 'Sci-Fi', 
    sub: '', 
    color: COLORS.neonCyan, 
    img: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?q=80&w=300&auto=format&fit=crop' 
  },
  { 
    id: 'fantasy', 
    name: 'Fantasy', 
    sub: '', 
    color: COLORS.neon, 
    img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=300&auto=format&fit=crop' 
  },
  { 
    id: 'adventure', 
    name: 'Adventure', 
    sub: 'Epic journeys await', 
    color: '#FFB830', 
    img: 'https://images.unsplash.com/photo-1578632738981-43306915c0e7?q=80&w=300&auto=format&fit=crop' 
  },
  { 
    id: 'romance', 
    name: 'Romance', 
    sub: 'Heartfelt stories', 
    color: COLORS.neonPink, 
    img: 'https://images.unsplash.com/photo-1516589174184-c6858b16ecbe?q=80&w=500&auto=format&fit=crop' 
  },
];

const TRENDING_QUERIES = ['Chainsaw Man', 'Spy x Family', 'Oshi no Ko', 'Jujutsu Kaisen', 'Solo Leveling'];

const STUDIOS = [
  { id: '1', name: 'MAPPA', initial: 'M', color: COLORS.neon },
  { id: '2', name: 'Ufotable', initial: 'U', color: COLORS.neonCyan },
  { id: '3', name: 'Trigger', initial: 'T', color: COLORS.neonPink },
  { id: '4', name: 'Wit Studio', initial: 'W', color: COLORS.text },
  { id: '5', name: 'Bones', initial: 'B', color: COLORS.neonGold },
];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AnimeWithStats[]>([]);
  const [genreImages, setGenreImages] = useState<Record<string, string>>({});
  const [showFilter, setShowFilter] = useState(false);
  const [sortBy, setSortBy] = useState<'top_rated' | 'trending' | 'recent'>('top_rated');
  const debounceRef = useRef<any>(null);

  const fetchExploreData = useCallback(async () => {
    try {
      const [topRatedRes, ...genreResults] = await Promise.all([
        animeAPI.getTopRated(8),
        animeAPI.getByGenre('Action', 15),
        animeAPI.getByGenre('Sci-Fi', 15),
        animeAPI.getByGenre('Fantasy', 15),
        animeAPI.getByGenre('Adventure', 15),
        animeAPI.getByGenre('Romance', 15),
      ]);
      setRecommendations(topRatedRes.data || []);

      // Build genre → random poster map
      const genreIds = ['action', 'sci-fi', 'fantasy', 'adventure', 'romance'];
      const imgs: Record<string, string> = {};
      genreResults.forEach((res, i) => {
        const list = (res.data || []).filter((a: Anime) => a.poster_url);
        if (list.length > 0) {
          const pick = list[Math.floor(Math.random() * list.length)];
          imgs[genreIds[i]] = pick.poster_url;
        }
      });
      setGenreImages(imgs);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchExploreData();
    // Clean up debounce timer on unmount to prevent state updates on unmounted component
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchExploreData]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await animeAPI.search(q);
      setResults(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const onChangeText = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 400);
  };

  const onGenrePress = (genre: string) => {
    router.push(`/genre/${genre}`);
  };

  const applySort = async (sort: 'top_rated' | 'trending' | 'recent') => {
    setSortBy(sort);
    setShowFilter(false);
    try {
      let res;
      if (sort === 'trending') res = await animeAPI.getTrending(8);
      else if (sort === 'recent') res = await animeAPI.getRecent(8);
      else res = await animeAPI.getTopRated(8);
      setRecommendations(res.data || []);
    } catch (e) { console.error(e); }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.neon} size="large" />
          <Text style={styles.loadingText}>SEARCHING THE MATRIX...</Text>
        </View>
      );
    }

    if (results.length > 0) {
      return (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <AnimeCard
              anime={item}
              onPress={() => router.push(`/anime/${item.id}`)}
              showStats
            />
          )}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <TouchableOpacity 
              onPress={() => { setResults([]); setQuery(''); }}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={20} color={COLORS.neon} />
              <Text style={styles.backButtonText}>BACK TO EXPLORE</Text>
            </TouchableOpacity>
          )}
        />
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Search Bar Section */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Search titles, studios, or genres..."
              placeholderTextColor={COLORS.textMuted}
              value={query}
              onChangeText={onChangeText}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => doSearch(query)}
            />
            <TouchableOpacity onPress={() => setShowFilter(true)}>
              <View style={styles.filterButton}>
                <Ionicons name="options-outline" size={18} color={COLORS.neonCyan} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Trending Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
            <TouchableOpacity
              style={styles.trendingChipFeatured}
              onPress={() => router.push('/genre/action')}
              accessibilityLabel="Browse Action anime"
            >
              <Ionicons name="trending-up" size={14} color={COLORS.neon} />
              <Text style={styles.trendingChipTextFeatured}>CHAINSAW MAN</Text>
            </TouchableOpacity>
            {TRENDING_QUERIES.map((q) => (
              <TouchableOpacity key={q} style={styles.trendingChip} onPress={() => { setQuery(q); doSearch(q); }}>
                <Text style={styles.trendingChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Bento Genre Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse by Genre</Text>
            <TouchableOpacity onPress={() => router.push('/genre')}><Text style={styles.seeAllText}>SEE ALL →</Text></TouchableOpacity>
          </View>
          
          <View style={styles.bentoGrid}>
            {/* Action - Wide */}
            <TouchableOpacity 
              style={[styles.bentoTile, styles.bentoTileWide]} 
              onPress={() => onGenrePress('Action')}
            >
              <Image source={{ uri: genreImages['action'] ?? BENTO_GENRES[0].img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={styles.bentoDim} />
              <LinearGradient colors={['transparent', 'rgba(255,115,70,0.5)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
              <View style={styles.bentoContent}>
                <Text style={[styles.bentoGenreName, { color: BENTO_GENRES[0].color }]}>ACTION</Text>
                <Text style={styles.bentoSubText}>{BENTO_GENRES[0].sub}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.bentoRow}>
              {/* Sci-Fi - Square */}
              <TouchableOpacity style={styles.bentoTileSq} onPress={() => onGenrePress('Sci-Fi')}>
                <Image source={{ uri: genreImages['sci-fi'] ?? BENTO_GENRES[1].img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={styles.bentoDim} />
                <LinearGradient colors={['transparent', 'rgba(0,245,255,0.5)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
                <View style={styles.bentoContentSq}>
                  <Text style={[styles.bentoGenreName, { color: BENTO_GENRES[1].color }]}>SCI-FI</Text>
                </View>
              </TouchableOpacity>

              {/* Fantasy - Square */}
              <TouchableOpacity style={styles.bentoTileSq} onPress={() => onGenrePress('Fantasy')}>
                <Image source={{ uri: genreImages['fantasy'] ?? BENTO_GENRES[2].img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={styles.bentoDim} />
                <LinearGradient colors={['transparent', 'rgba(191,95,255,0.5)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
                <View style={styles.bentoContentSq}>
                  <Text style={[styles.bentoGenreName, { color: BENTO_GENRES[2].color }]}>FANTASY</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.bentoRow, { marginTop: SPACING.md }]}>
              {/* Adventure - Square */}
              <TouchableOpacity style={styles.bentoTileSq} onPress={() => onGenrePress('Adventure')}>
                <Image source={{ uri: genreImages['adventure'] ?? BENTO_GENRES[3].img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={styles.bentoDim} />
                <LinearGradient colors={['transparent', 'rgba(255,184,48,0.5)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
                <View style={styles.bentoContentSq}>
                  <Text style={[styles.bentoGenreName, { color: BENTO_GENRES[3].color }]}>ADVENTURE</Text>
                </View>
              </TouchableOpacity>

              {/* Romance - Square */}
              <TouchableOpacity style={styles.bentoTileSq} onPress={() => onGenrePress('Romance')}>
                <Image source={{ uri: genreImages['romance'] ?? BENTO_GENRES[4].img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                <View style={styles.bentoDim} />
                <LinearGradient colors={['transparent', 'rgba(255,45,120,0.5)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
                <View style={styles.bentoContentSq}>
                  <Text style={[styles.bentoGenreName, { color: BENTO_GENRES[4].color }]}>ROMANCE</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Popular Recommendations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Recommendations</Text>
          <View style={styles.recommendationsGrid}>
            {recommendations.map((item) => (
              <AnimeCard
                key={item.id}
                anime={item}
                onPress={() => router.push(`/anime/${item.id}`)}
                showStats
              />
            ))}
          </View>
        </View>

        {/* Top Studios */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Studios</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studioRow}>
            {STUDIOS.map((studio) => (
              <TouchableOpacity key={studio.id} style={styles.studioCard}>
                <View style={styles.studioLogoWrap}>
                  <Text style={[styles.studioInitial, { color: studio.color }]}>{studio.initial}</Text>
                </View>
                <Text style={styles.studioName}>{studio.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderContent()}

      {/* Filter Bottom Sheet */}
      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilter(false)} />
        <BlurView intensity={60} tint="dark" style={styles.filterSheet}>
          <View style={styles.filterHandle} />

          <Text style={styles.filterTitle}>SORT & FILTER</Text>

          <Text style={styles.filterSection}>Sort By</Text>
          <View style={styles.filterOptions}>
            {(['top_rated', 'trending', 'recent'] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.filterChip, sortBy === opt && styles.filterChipActive]}
                onPress={() => applySort(opt)}
              >
                <Ionicons
                  name={opt === 'top_rated' ? 'star' : opt === 'trending' ? 'trending-up' : 'time'}
                  size={14}
                  color={sortBy === opt ? '#000' : COLORS.textSub}
                />
                <Text style={[styles.filterChipText, sortBy === opt && styles.filterChipTextActive]}>
                  {opt === 'top_rated' ? 'Top Rated' : opt === 'trending' ? 'Trending' : 'Recent'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterSection}>Browse Genre</Text>
          <View style={styles.filterOptions}>
            {['Action', 'Sci-Fi', 'Fantasy', 'Adventure', 'Romance', 'Thriller', 'Comedy', 'Drama'].map((g) => (
              <TouchableOpacity
                key={g}
                style={styles.filterChip}
                onPress={() => { setShowFilter(false); router.push(`/genre/${g}`); }}
              >
                <Text style={styles.filterChipText}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { color: COLORS.textMuted, fontSize: 13, letterSpacing: 2 },

  searchSection: { marginTop: SPACING.md, marginBottom: SPACING.lg },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACING.md,
    backgroundColor: '#1F1F23',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 18,
    gap: SPACING.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20,
    elevation: 5,
  },
  input: { flex: 1, color: COLORS.text, fontSize: 15, fontWeight: '500' },
  filterButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: 'rgba(0, 245, 255, 0.2)',
  },

  backButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginVertical: SPACING.md, paddingHorizontal: SPACING.md,
  },
  backButtonText: { color: COLORS.neon, fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  trendingRow: { paddingHorizontal: SPACING.md, gap: 10, marginTop: SPACING.md },
  trendingChipFeatured: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(191,95,255,0.1)',
    borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(191,95,255,0.3)',
  },
  trendingChipTextFeatured: { color: COLORS.neon, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  trendingChip: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#25252A',
    borderRadius: 100,
  },
  trendingChipText: { color: COLORS.textSub, fontSize: 11, fontWeight: '700' },

  section: { paddingHorizontal: SPACING.md, marginBottom: SPACING.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: SPACING.md },
  sectionTitle: { fontSize: 22, color: COLORS.text, fontWeight: '900', letterSpacing: -0.5 },
  seeAllText: { fontSize: 11, color: COLORS.neonCyan, fontWeight: '800', letterSpacing: 1.5 },

  bentoGrid: { gap: SPACING.md },
  bentoTile: { borderRadius: RADIUS.lg, overflow: 'hidden', position: 'relative' },
  bentoTileWide: { height: 160 },
  bentoTileSq: { flex: 1, height: 160, borderRadius: RADIUS.lg, overflow: 'hidden' },
  bentoRow: { flexDirection: 'row', gap: SPACING.md },
  bentoDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  bentoContent: { position: 'absolute', bottom: SPACING.md, left: SPACING.md },
  bentoContentSq: { position: 'absolute', bottom: SPACING.md, left: SPACING.md },
  bentoGenreName: {
    fontSize: 18, fontWeight: '900', letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  bentoSubText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2, fontWeight: '500' },

  recommendationsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, justifyContent: 'space-between' },
  
  studioRow: { gap: SPACING.md, paddingVertical: SPACING.sm },
  studioCard: {
    width: 140, height: 140,
    backgroundColor: 'rgba(25, 25, 29, 0.6)',
    borderRadius: RADIUS.lg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(72, 71, 75, 0.2)',
  },
  studioLogoWrap: {
    width: 60, height: 60,
    borderRadius: 30,
    backgroundColor: '#25252A',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  studioInitial: { fontSize: 24, fontWeight: '900' },
  studioName: { fontSize: 11, color: COLORS.text, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },

  grid: { padding: SPACING.sm, paddingBottom: 100 },
  gridRow: { gap: SPACING.sm, marginBottom: SPACING.sm, justifyContent: 'space-between' },

  // Filter modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  filterSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 48,
    overflow: 'hidden',
    backgroundColor: 'rgba(19,19,22,0.92)',
    borderTopWidth: 1, borderColor: 'rgba(189,157,255,0.1)',
  },
  filterHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 20,
  },
  filterTitle: { fontSize: 11, fontWeight: '900', color: COLORS.neonCyan, letterSpacing: 3, marginBottom: 20 },
  filterSection: { fontSize: 12, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 100, borderWidth: 1, borderColor: 'rgba(189,157,255,0.1)',
  },
  filterChipActive: { backgroundColor: COLORS.neon, borderColor: COLORS.neon },
  filterChipText: { color: COLORS.textSub, fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#000' },
});
