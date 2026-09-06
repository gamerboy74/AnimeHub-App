import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, Modal, Alert,
  TouchableOpacity, ActivityIndicator, ScrollView, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../src/constants/theme';
import { supabase, animeAPI, Anime, AnimeWithStats } from '../../src/lib/supabase';
import AnimeCard from '../../src/components/ui/AnimeCard';
import { BlurView } from 'expo-blur';
import RequestAnimeModal from '../../src/components/settings/RequestAnimeModal';
import { usePrefetch } from '../../src/hooks/usePrefetch';

const BENTO_GENRES = [
  {
    id: 'action',
    name: 'Action',
    sub: 'Adrenaline-fueled epic battles',
    color: '#FF7346',
    img: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=500&auto=format&fit=crop',
  },
  {
    id: 'sci-fi',
    name: 'Sci-Fi',
    sub: '',
    color: COLORS.neonCyan,
    img: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: 'fantasy',
    name: 'Fantasy',
    sub: '',
    color: COLORS.neon,
    img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: 'adventure',
    name: 'Adventure',
    sub: 'Epic journeys await',
    color: '#FFB830',
    img: 'https://images.unsplash.com/photo-1578632738981-43306915c0e7?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: 'romance',
    name: 'Romance',
    sub: 'Heartfelt stories',
    color: COLORS.neonPink,
    img: 'https://images.unsplash.com/photo-1516589174184-c6858b16ecbe?q=80&w=500&auto=format&fit=crop',
  },
];

const TRENDING_QUERIES = ['Chainsaw Man', 'Spy x Family', 'Oshi no Ko', 'Jujutsu Kaisen', 'Solo Leveling'];

const truncateTitle = (title: string, maxLength = 16) => {
  if (title.length > maxLength) {
    return title.substring(0, maxLength).trim() + '...';
  }
  return title;
};

const STUDIOS = [
  {
    id: '1',
    name: 'MAPPA',
    initial: 'M',
    color: COLORS.neon,
    img: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '2',
    name: 'Ufotable',
    initial: 'U',
    color: COLORS.neonCyan,
    img: 'https://images.unsplash.com/photo-1528164344705-47542687000d?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '3',
    name: 'Madhouse',
    initial: 'M',
    color: '#FFD600',
    img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '4',
    name: 'Wit Studio',
    initial: 'W',
    color: COLORS.text,
    img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '5',
    name: 'Trigger',
    initial: 'T',
    color: COLORS.neonPink,
    img: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '6',
    name: 'Kyoto Animation',
    initial: 'K',
    color: '#FF8833',
    img: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '7',
    name: 'A-1 Pictures',
    initial: 'A',
    color: '#3388FF',
    img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '8',
    name: 'Studio Ghibli',
    initial: 'G',
    color: '#22CC88',
    img: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '9',
    name: 'Bones',
    initial: 'B',
    color: COLORS.neonGold,
    img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '10',
    name: 'CloverWorks',
    initial: 'C',
    color: '#00D2C4',
    img: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?q=80&w=300&auto=format&fit=crop',
  },
];

// Minimum characters before search fires
const MIN_SEARCH_CHARS = 1;

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [sortBy, setSortBy] = useState<'top_rated' | 'trending' | 'recent'>('top_rated');
  const [isFocused, setIsFocused] = useState(false);

  // Hoist prefetch here so AnimeCard doesn't run useQueryClient() per-card
  const { prefetchAnime } = usePrefetch();

  const GENRE_IDS = ['action', 'sci-fi', 'fantasy', 'adventure', 'romance'] as const;
  const GENRE_NAMES = ['Action', 'Sci-Fi', 'Fantasy', 'Adventure', 'Romance'];

  const { data: topRatedData } = useQuery({
    queryKey: ['explore', 'topRated', sortBy],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (sortBy === 'trending') return (await animeAPI.getTrending(8)).data || [];
      if (sortBy === 'recent') return (await animeAPI.getRecent(8)).data || [];
      return (await animeAPI.getTopRated(8)).data || [];
    },
  });

  const { data: genreData } = useQuery({
    queryKey: ['explore', 'genreImages'],
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      const results = await Promise.all(
        GENRE_NAMES.map(g =>
          supabase
            .from('anime')
            .select('id, poster_url')
            .contains('genres', [g])
            .not('poster_url', 'is', null)
            .limit(3)
        )
      );
      return results.map(r => r.data || []);
    },
  });

  const { data: trendingChipsData } = useQuery({
    queryKey: ['explore', 'trendingChips'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await animeAPI.getTrending(6);
      return (data || []).map(a => a.title);
    },
  });

  const trendingChips = useMemo(() => {
    if (trendingChipsData && trendingChipsData.length > 0) {
      return trendingChipsData.slice(0, 5);
    }
    return TRENDING_QUERIES;
  }, [trendingChipsData]);

  const genreImages = useMemo<Record<string, string>>(() => {
    if (!genreData) return {};
    const imgs: Record<string, string> = {};
    genreData.forEach((list, i) => {
      if (list.length > 0) {
        // Pick first item consistently to avoid jarring layout shifts / flickering
        imgs[GENRE_IDS[i]] = list[0].poster_url;
      }
    });
    return imgs;
  }, [genreData]);

  const recommendations: AnimeWithStats[] = topRatedData || [];

  const applySort = (sort: 'top_rated' | 'trending' | 'recent') => {
    setSortBy(sort);
    setShowFilter(false);
  };

  // Debounce: only updates debouncedQuery 450ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 450);
    return () => clearTimeout(timer);
  }, [query]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < MIN_SEARCH_CHARS) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await animeAPI.search(q);
      setResults(res.data || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Search Error', 'Could not complete search. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Search fires on debouncedQuery, not live query — user never interrupted mid-type
  useEffect(() => {
    if (debouncedQuery.trim().length >= MIN_SEARCH_CHARS) {
      doSearch(debouncedQuery);
    } else {
      setResults([]);
    }
  }, [debouncedQuery, doSearch]);

  const onChangeText = (text: string) => {
    setQuery(text);
  };

  const clearSearch = () => {
    setQuery('');
    setDebouncedQuery('');
    setResults([]);
  };

  const onGenrePress = useCallback((genre: string) => {
    router.push(`/genre/${genre}`);
  }, [router]);

  const handleCardPress = useCallback((id: string) => {
    router.push(`/anime/${id}`);
  }, [router]);

  const renderSearchResultItem = useCallback(({ item }: { item: Anime }) => (
    <AnimeCard
      anime={item}
      onPress={handleCardPress}
      showStats
    />
  ), [handleCardPress]);

  const renderRecommendationItem = useCallback(({ item }: { item: AnimeWithStats }) => (
    <AnimeCard
      anime={item}
      onPress={handleCardPress}
      showStats
    />
  ), [handleCardPress]);

  const recommendationKeyExtractor = useCallback((item: AnimeWithStats) => item.id, []);
  const searchResultKeyExtractor = useCallback((item: Anime) => item.id, []);

  const isSearchActive = query.trim().length > 0;

  // Memoized recommendation renderer so AnimeCard gets a stable onLongPress ref
  const renderRecommItem = useCallback(({ item }: { item: AnimeWithStats }) => (
    <AnimeCard
      anime={item}
      onPress={handleCardPress}
      onLongPress={() => prefetchAnime(item.id)}
      showStats
    />
  ), [handleCardPress, prefetchAnime]);

  const recommKeyExtractor = useCallback((item: AnimeWithStats) => item.id, []);

  // Wrapping renderContent in useCallback prevents it from being recreated on
  // every keystroke / isFocused toggle, which would otherwise unmount and
  // remount the entire explore tree on each character typed.
  const renderContent = useCallback(() => {
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
          keyExtractor={searchResultKeyExtractor}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={renderSearchResultItem}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <View>
              <TouchableOpacity
                style={styles.backButton}
                onPress={clearSearch}
              >
                <Ionicons name="arrow-back" size={20} color={COLORS.neon} />
                <Text style={styles.backButtonText}>BACK TO EXPLORE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.requestNudge}
                onPress={() => setShowRequest(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={16} color={COLORS.neon} />
                <Text style={styles.requestNudgeText}>
                  Don't see what you want?{'  '}
                  <Text style={{ color: COLORS.neon, fontWeight: '800' }}>Request it →</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}
        />
      );
    }

    // No results: only shown after debounced search settled with no matches
    if (!loading && debouncedQuery.trim().length >= MIN_SEARCH_CHARS && results.length === 0) {
      return (
        <View style={styles.noResultsContainer}>
          <Ionicons name="telescope-outline" size={52} color={COLORS.neon} style={{ opacity: 0.6 }} />
          <Text style={styles.noResultsTitle}>Not in AnimeHub yet</Text>
          <Text style={styles.noResultsBody}>
            We couldn't find{' '}
            <Text style={{ color: COLORS.neon, fontWeight: '800' }}>"{query}"</Text>
            {' '}in our library.{'\n'}Want us to add it?
          </Text>
          <TouchableOpacity
            style={styles.requestCta}
            onPress={() => setShowRequest(true)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[COLORS.neon, '#FF2D78']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.requestCtaGradient}
            >
              <Ionicons name="paper-plane-outline" size={18} color="#fff" />
              <Text style={styles.requestCtaText}>REQUEST THIS ANIME</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearSearch} style={styles.backToExplore}>
            <Text style={styles.backToExploreText}>← Back to Explore</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Default explore view
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Trending Chips — only shown on explore (no active query) */}
        {!isSearchActive && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingRow}
          >
            {trendingChips.length > 0 && (
              <TouchableOpacity
                style={styles.trendingChipFeatured}
                onPress={() => setQuery(trendingChips[0])}
                accessibilityLabel={`Search ${trendingChips[0]} anime`}
              >
                <Ionicons name="trending-up" size={14} color={COLORS.neon} />
                <Text style={styles.trendingChipTextFeatured}>{truncateTitle(trendingChips[0]).toUpperCase()}</Text>
              </TouchableOpacity>
            )}
            {trendingChips.slice(1).map((q) => (
              <TouchableOpacity key={q} style={styles.trendingChip} onPress={() => setQuery(q)}>
                <Text style={styles.trendingChipText}>{truncateTitle(q)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Bento Genre Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Browse by Genre</Text>
            <TouchableOpacity onPress={() => router.push('/genre')}>
              <Text style={styles.seeAllText}>SEE ALL →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bentoGrid}>
            {/* Action - Wide */}
            <TouchableOpacity
              style={[styles.bentoTile, styles.bentoTileWide]}
              onPress={() => onGenrePress('Action')}
            >
              <Image
                source={{ uri: genreImages['action'] ?? BENTO_GENRES[0].img }}
                placeholder={{ uri: BENTO_GENRES[0].img }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={400}
              />
              <View style={styles.bentoDim} />
              <LinearGradient colors={['transparent', 'rgba(255,115,70,0.5)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
              <View style={styles.bentoContent}>
                <Text style={[styles.bentoGenreName, { color: BENTO_GENRES[0].color }]}>ACTION</Text>
                <Text style={styles.bentoSubText}>{BENTO_GENRES[0].sub}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.bentoRow}>
              <TouchableOpacity style={styles.bentoTileSq} onPress={() => onGenrePress('Sci-Fi')}>
                <Image
                  source={{ uri: genreImages['sci-fi'] ?? BENTO_GENRES[1].img }}
                  placeholder={{ uri: BENTO_GENRES[1].img }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={400}
                />
                <View style={styles.bentoDim} />
                <LinearGradient colors={['transparent', 'rgba(0,245,255,0.5)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
                <View style={styles.bentoContentSq}>
                  <Text style={[styles.bentoGenreName, { color: BENTO_GENRES[1].color }]}>SCI-FI</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.bentoTileSq} onPress={() => onGenrePress('Fantasy')}>
                <Image
                  source={{ uri: genreImages['fantasy'] ?? BENTO_GENRES[2].img }}
                  placeholder={{ uri: BENTO_GENRES[2].img }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={400}
                />
                <View style={styles.bentoDim} />
                <LinearGradient colors={['transparent', 'rgba(191,95,255,0.5)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
                <View style={styles.bentoContentSq}>
                  <Text style={[styles.bentoGenreName, { color: BENTO_GENRES[2].color }]}>FANTASY</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={[styles.bentoRow, { marginTop: SPACING.md }]}>
              <TouchableOpacity style={styles.bentoTileSq} onPress={() => onGenrePress('Adventure')}>
                <Image
                  source={{ uri: genreImages['adventure'] ?? BENTO_GENRES[3].img }}
                  placeholder={{ uri: BENTO_GENRES[3].img }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={400}
                />
                <View style={styles.bentoDim} />
                <LinearGradient colors={['transparent', 'rgba(255,184,48,0.5)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
                <View style={styles.bentoContentSq}>
                  <Text style={[styles.bentoGenreName, { color: BENTO_GENRES[3].color }]}>ADVENTURE</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.bentoTileSq} onPress={() => onGenrePress('Romance')}>
                <Image
                  source={{ uri: genreImages['romance'] ?? BENTO_GENRES[4].img }}
                  placeholder={{ uri: BENTO_GENRES[4].img }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={400}
                />
                <View style={styles.bentoDim} />
                <LinearGradient colors={['transparent', 'rgba(255,45,120,0.5)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
                <View style={styles.bentoContentSq}>
                  <Text style={[styles.bentoGenreName, { color: BENTO_GENRES[4].color }]}>ROMANCE</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Popular Recommendations — FlatList for virtualization */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Recommendations</Text>
          <FlatList
            data={recommendations}
            keyExtractor={recommKeyExtractor}
            renderItem={renderRecommItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: SPACING.sm, paddingVertical: SPACING.sm }}
            removeClippedSubviews
            windowSize={3}
            maxToRenderPerBatch={4}
            initialNumToRender={4}
          />
        </View>

        {/* Top Studios */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Studios</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studioRow}>
            {STUDIOS.map((studio) => (
              <TouchableOpacity
                key={studio.id}
                style={[
                  styles.studioCard,
                  {
                    borderColor: studio.color ? `${studio.color}35` : 'rgba(255,255,255,0.06)',
                    shadowColor: studio.color || COLORS.neon,
                  }
                ]}
                onPress={() => router.push(`/studio/${studio.name}`)}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: studio.img }}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                  transition={200}
                />
                <LinearGradient
                  colors={['rgba(8,8,16,0.1)', 'rgba(8,8,16,0.85)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.studioTextWrap}>
                  <Text style={[styles.studioCardInitial, { color: studio.color }]}>{studio.initial}</Text>
                  <Text style={styles.studioCardName} numberOfLines={1}>{studio.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    );
  }, [
    loading, results, debouncedQuery, isSearchActive, trendingChips, genreImages,
    recommendations, onGenrePress, handleCardPress, renderRecommItem, recommKeyExtractor,
    clearSearch, router, setShowRequest, setQuery,
  ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Persistent search bar — always visible, never unmounts ── */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBar,
            isFocused && styles.searchBarFocused,
            isFocused && { borderColor: COLORS.neonCyan }
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color={isFocused ? COLORS.neonCyan : COLORS.textMuted}
          />
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
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          {isSearchActive ? (
            <TouchableOpacity onPress={clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={20} color={isFocused ? COLORS.neonCyan : COLORS.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setShowFilter(true)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <View style={styles.filterButton}>
                <Ionicons name="options-outline" size={18} color={COLORS.neonCyan} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── All conditional content below the search bar ── */}
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

      {/* Anime Request Modal */}
      <RequestAnimeModal
        visible={showRequest}
        onClose={() => setShowRequest(false)}
        prefillTitle={query.trim()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { color: COLORS.textMuted, fontSize: 13, letterSpacing: 2 },

  // ── Persistent search bar ──────────────────────────────────────────
  searchSection: { marginTop: SPACING.md, marginBottom: SPACING.sm },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACING.md,
    backgroundColor: '#1F1F23',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: SPACING.md,
    height: 56,
    gap: SPACING.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20,
    elevation: 5,
  },
  searchBarFocused: {
    backgroundColor: '#161619',
    shadowColor: COLORS.neonCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  filterButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: 'rgba(0, 245, 255, 0.2)',
  },

  // ── Back button (inside search results list header) ────────────────
  backButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginVertical: SPACING.md, paddingHorizontal: SPACING.md,
  },
  backButtonText: { color: COLORS.neon, fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  // ── Trending chips ─────────────────────────────────────────────────
  trendingRow: { paddingHorizontal: SPACING.md, gap: 10, marginTop: SPACING.sm, marginBottom: SPACING.md },
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
  bentoDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  bentoContent: { position: 'absolute', bottom: SPACING.md, left: SPACING.md },
  bentoContentSq: { position: 'absolute', bottom: SPACING.md, left: SPACING.md },
  bentoGenreName: {
    fontSize: 18, fontWeight: '900', letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  bentoSubText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2, fontWeight: '500' },

  studioRow: { gap: SPACING.md, paddingVertical: SPACING.sm },
  studioCard: {
    width: 140,
    height: 90,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
    ...SHADOWS.neon,
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  studioTextWrap: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  studioCardInitial: {
    fontSize: 14,
    fontWeight: '900',
    backgroundColor: 'rgba(8,8,16,0.75)',
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  studioCardName: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  grid: { padding: SPACING.sm, paddingBottom: 100 },
  gridRow: { gap: SPACING.sm, marginBottom: SPACING.sm, justifyContent: 'space-between' },

  // ── Filter modal ───────────────────────────────────────────────────
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

  // ── No-results state ───────────────────────────────────────────────
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: 80,
    gap: SPACING.md,
  },
  noResultsTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  noResultsBody: {
    fontSize: 15,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 24,
  },
  requestCta: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginTop: SPACING.sm,
    width: '100%',
  },
  requestCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  requestCtaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  backToExplore: { marginTop: SPACING.sm },
  backToExploreText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700' },

  // ── Search results nudge strip ─────────────────────────────────────
  requestNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: SPACING.sm,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: 'rgba(191,95,255,0.07)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(191,95,255,0.15)',
  },
  requestNudgeText: {
    color: COLORS.textSub,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: SPACING.md,
    marginTop: SPACING.sm,
  },
});
