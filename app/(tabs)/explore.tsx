import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, Modal, Alert,
  TouchableOpacity, ActivityIndicator, ScrollView, Pressable,
  Dimensions, useWindowDimensions, RefreshControl, Platform, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useInfiniteQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { haptic } from '../../src/lib/haptics';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../src/constants/theme';
import { supabase, animeAPI, Anime, AnimeWithStats, userAPI } from '../../src/lib/supabase';
import AnimeCard, { AnimeCardSkeleton } from '../../src/components/ui/AnimeCard';
import { BlurView } from 'expo-blur';
import RequestAnimeModal from '../../src/components/settings/RequestAnimeModal';
import { usePrefetch } from '../../src/hooks/usePrefetch';
import { useAuth } from '../../src/context/AuthContext';
import { computeGenres } from '../../src/lib/userStats';
import {
  SEASONS_LIST,
  SeasonalTarget,
  fetchJikanSeasonWithFallback,
} from '../../src/lib/jikan';
import { ALL_GENRES } from '../../src/constants/genres';

const GRID_GAP = 10;

// ─── PARTITION TABS ────────────────────────────────────────────────────────────
type ExploreTab = 'browse' | 'genres' | 'simulcasts';

// ─── BENTO GENRES (Hero in Genres Tab) ─────────────────────────────────────────
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
    sub: 'Futuristic cyberpunk worlds',
    color: COLORS.neonCyan,
    img: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: 'fantasy',
    name: 'Fantasy',
    sub: 'Magic, swords & isekai realms',
    color: COLORS.neon,
    img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: 'adventure',
    name: 'Adventure',
    sub: 'Epic journeys across uncharted lands',
    color: '#FFB830',
    img: 'https://images.unsplash.com/photo-1578632738981-43306915c0e7?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: 'romance',
    name: 'Romance',
    sub: 'Heartfelt emotional stories',
    color: COLORS.neonPink,
    img: 'https://images.unsplash.com/photo-1516589174184-c6858b16ecbe?q=80&w=500&auto=format&fit=crop',
  },
];

// ─── ALL OTHER GENRES MATRIX (derived from shared constants) ──────────────────
const BENTO_NAMES = new Set(BENTO_GENRES.map(b => b.name));
const ALL_GENRES_GRID = ALL_GENRES.filter(g => !BENTO_NAMES.has(g.name));

const DEFAULT_TRENDING_QUERIES = ['Chainsaw Man', 'Spy x Family', 'Oshi no Ko', 'Jujutsu Kaisen', 'Solo Leveling'];

const truncateTitle = (title: string, maxLength = 16) => {
  if (title.length > maxLength) {
    return title.substring(0, maxLength).trim() + '...';
  }
  return title;
};

const STUDIOS = [
  { id: '1', name: 'MAPPA', initial: 'M', color: COLORS.neon, img: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=300&auto=format&fit=crop' },
  { id: '2', name: 'Ufotable', initial: 'U', color: COLORS.neonCyan, img: 'https://images.unsplash.com/photo-1528164344705-47542687000d?q=80&w=300&auto=format&fit=crop' },
  { id: '3', name: 'Madhouse', initial: 'M', color: '#FFD600', img: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=300&auto=format&fit=crop' },
  { id: '4', name: 'Wit Studio', initial: 'W', color: COLORS.text, img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=300&auto=format&fit=crop' },
  { id: '5', name: 'Trigger', initial: 'T', color: COLORS.neonPink, img: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=300&auto=format&fit=crop' },
  { id: '6', name: 'Kyoto Animation', initial: 'K', color: '#FF8833', img: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=300&auto=format&fit=crop' },
  { id: '7', name: 'A-1 Pictures', initial: 'A', color: '#3388FF', img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=300&auto=format&fit=crop' },
  { id: '8', name: 'Studio Ghibli', initial: 'G', color: '#22CC88', img: 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=300&auto=format&fit=crop' },
  { id: '9', name: 'Bones', initial: 'B', color: COLORS.neonGold, img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=300&auto=format&fit=crop' },
  { id: '10', name: 'CloverWorks', initial: 'C', color: '#00D2C4', img: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?q=80&w=300&auto=format&fit=crop' },
];

const MIN_SEARCH_CHARS = 1;

/** Renders text with the matched substring highlighted in neon. */
const HighlightText = React.memo(function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || query.trim().length < MIN_SEARCH_CHARS) {
    return <Text style={styles.highlightBase}>{text}</Text>;
  }
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <Text style={styles.highlightBase}>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <Text key={i} style={styles.highlightMatch}>{part}</Text>
          : part
      )}
    </Text>
  );
});

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prefetchAnime } = usePrefetch();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── User history for personalized chips ──────────────────────────────
  const { data: userProgress = [] } = useQuery({
    queryKey: ['user', user?.id, 'history'],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await userAPI.getProgress(user!.id);
      return data ?? [];
    },
  });

  // Build personalized chips: top-3 genres → genre-based queries + 2 static fallbacks
  const trendingChips = useMemo(() => {
    const genreStats = computeGenres(userProgress as any[]);
    const topGenres = genreStats.slice(0, 3).map((g: any) => g.genre);
    // Map genre names to representative show titles or use genre itself as search term
    const genreToQuery: Record<string, string> = {
      Action: 'Jujutsu Kaisen', Fantasy: 'Frieren', 'Sci-Fi': 'Oshi no Ko',
      Romance: 'Your Lie in April', Adventure: 'One Piece',
      Comedy: 'Spy x Family', Horror: 'Parasyte',
      'Slice of Life': 'A Silent Voice', Sports: 'Haikyuu',
    };
    const personalized = topGenres.map((g: string) => genreToQuery[g] || g);
    const extras = DEFAULT_TRENDING_QUERIES.filter(q => !personalized.includes(q)).slice(0, 5 - personalized.length);
    return [...personalized, ...extras];
  }, [userProgress]);

  const numColumns = windowWidth >= 1024 ? 6 : windowWidth >= 768 ? 5 : windowWidth >= 600 ? 4 : 3;
  const availableWidth = windowWidth - SPACING.md * 2;
  const cardWidth = Math.floor((availableWidth - GRID_GAP * (numColumns - 1)) / numColumns);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const mainScrollRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);

  // ── Search State ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['exploreBrowseAll'] });
    await queryClient.invalidateQueries({ queryKey: ['exploreSimulcast'] });
    setIsRefreshing(false);
  }, [queryClient]);

  // ── Partition Tabs State ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ExploreTab>('browse');

  // ── Browse All Filters State ──────────────────────────────────────────────
  const [browseSort, setBrowseSort] = useState<'popular' | 'top_rated' | 'newest' | 'a_z'>('popular');
  const [browseType, setBrowseType] = useState<string>('all');
  const [browseStatus, setBrowseStatus] = useState<string>('all');
  const PAGE_SIZE = 30;

  // ── Simulcasts Season State ───────────────────────────────────────────────
  const [selectedSeason, setSelectedSeason] = useState<SeasonalTarget>(SEASONS_LIST[0]);

  // ── Debounce Search Query ─────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // ── Live Search with TanStack Query (Cached & Deduplicated) ───────────────
  const trimmedSearch = debouncedQuery.trim();
  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['animeSearch', trimmedSearch],
    queryFn: async () => {
      if (trimmedSearch.length < MIN_SEARCH_CHARS) return [];
      const res = await animeAPI.search(trimmedSearch);
      return (res.data || []) as Anime[];
    },
    enabled: trimmedSearch.length >= MIN_SEARCH_CHARS,
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,
  });

  const clearSearch = useCallback(() => {
    haptic.selection();
    setQuery('');
    setDebouncedQuery('');
    Keyboard.dismiss();
    searchInputRef.current?.blur();
  }, []);

  const isSearchActive = query.trim().length > 0;

  const scrollOffsetRef = useRef<number>(0);

  // ── Data Query: Browse All Partition (infinite query, automatically cached per filter) ──
  const {
    data: browseInfiniteData,
    isLoading: browseLoading,
    isFetchingNextPage: browseFetchingMore,
    hasNextPage: browseHasMore,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['exploreBrowseAll', browseSort, browseType, browseStatus],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const res = await animeAPI.getBrowse({
        page: pageParam,
        limit: PAGE_SIZE,
        sortBy: browseSort,
        type: browseType,
        status: browseStatus,
      });
      return (res.data ?? []) as AnimeWithStats[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });

  const browseAllItems = useMemo(() => {
    if (!browseInfiniteData?.pages) return [];
    return browseInfiniteData.pages.flat();
  }, [browseInfiniteData]);

  // Background prefetch all sort tabs for instant zero-latency switching
  useEffect(() => {
    const sorts = ['popular', 'top_rated', 'newest', 'a_z'] as const;
    const timer = setTimeout(() => {
      sorts.forEach((sort) => {
        if (sort !== browseSort) {
          queryClient.prefetchInfiniteQuery({
            queryKey: ['exploreBrowseAll', sort, 'all', 'all'],
            initialPageParam: 0,
            queryFn: async () => {
              const res = await animeAPI.getBrowse({
                page: 0,
                limit: PAGE_SIZE,
                sortBy: sort,
                type: 'all',
                status: 'all',
              });
              return (res.data ?? []) as AnimeWithStats[];
            },
            getNextPageParam: (lastPage: AnimeWithStats[]) => {
              if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
              return 1;
            },
            staleTime: 5 * 60 * 1000,
          });
        }
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [queryClient]);

  // Smooth scroll to top only if user had scrolled down
  useEffect(() => {
    if (scrollOffsetRef.current > 80) {
      mainScrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [browseSort, browseType, browseStatus]);

  const loadMoreBrowse = useCallback(() => {
    if (browseFetchingMore || !browseHasMore || browseLoading) return;
    fetchNextPage();
  }, [browseFetchingMore, browseHasMore, browseLoading, fetchNextPage]);

  // ── Data Query: Simulcasts Season Partition ───────────────────────────────
  const { data: simulcastAnime = [], isLoading: simulcastsLoading } = useQuery({
    queryKey: ['exploreSimulcast', selectedSeason.year, selectedSeason.season],
    queryFn: async () => {
      return await fetchJikanSeasonWithFallback(selectedSeason.year, selectedSeason.season, 30);
    },
    staleTime: 10 * 60 * 1000,
  });

  // ── Data Query: Genre Images for Bento Grid ───────────────────────────────
  const GENRE_IDS = ['action', 'sci-fi', 'fantasy', 'adventure', 'romance'] as const;
  const GENRE_NAMES = ['Action', 'Sci-Fi', 'Fantasy', 'Adventure', 'Romance'];

  const { data: genreData } = useQuery({
    queryKey: ['explore', 'genreImages'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const results = await Promise.all(
        GENRE_NAMES.map(g =>
          supabase
            .from('anime')
            .select('id, poster_url')
            .contains('genres', [g])
            .not('poster_url', 'is', null)
            .limit(1)
        )
      );
      return results.map(r => r.data || []);
    },
  });

  const genreImages = useMemo<Record<string, string>>(() => {
    if (!genreData) return {};
    const imgs: Record<string, string> = {};
    genreData.forEach((list, i) => {
      if (list.length > 0 && list[0].poster_url) {
        imgs[GENRE_IDS[i]] = list[0].poster_url;
      }
    });
    return imgs;
  }, [genreData]);

  // ── Navigation callbacks ──────────────────────────────────────────────────
  const handleCardPress = useCallback((id: string) => {
    router.push(`/anime/${id}`);
  }, [router]);

  const onGenrePress = useCallback((genre: string) => {
    router.push(`/genre/${genre}`);
  }, [router]);

  // ──────────────────────────────────────────────────────────────────────────
  // PARTITION 1: BROWSE ALL ANIME
  // ──────────────────────────────────────────────────────────────────────────
  const renderBrowseFilterHeader = () => (
    <View>
      {/* Sort & Filter Controls Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterPillRow}
      >
        {(
          [
            { key: 'popular', label: '🔥 Popular' },
            { key: 'top_rated', label: '⭐ Top Rated' },
            { key: 'newest', label: '✨ Newest' },
            { key: 'a_z', label: '🔤 A-Z' },
          ] as const
        ).map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.filterPill, browseSort === s.key && styles.filterPillActive]}
            onPress={() => {
              if (browseSort !== s.key) {
                haptic.selection();
                setBrowseSort(s.key);
              }
            }}
          >
            <Text style={[styles.filterPillText, browseSort === s.key && styles.filterPillTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={styles.filterPillDivider} />

        {[
          { key: 'all', label: 'All Formats' },
          { key: 'tv', label: 'TV' },
          { key: 'movie', label: 'Movie' },
          { key: 'ova', label: 'OVA' },
        ].map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.filterPill, browseType === t.key && styles.filterPillActiveFormat]}
            onPress={() => {
              if (browseType !== t.key) {
                haptic.selection();
                setBrowseType(t.key);
              }
            }}
          >
            <Text style={[styles.filterPillText, browseType === t.key && styles.filterPillTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={styles.filterPillDivider} />

        {[
          { key: 'all', label: 'All Status' },
          { key: 'ongoing', label: 'Airing' },
          { key: 'completed', label: 'Finished' },
        ].map((st) => (
          <TouchableOpacity
            key={st.key}
            style={[styles.filterPill, browseStatus === st.key && styles.filterPillActiveStatus]}
            onPress={() => {
              if (browseStatus !== st.key) {
                haptic.selection();
                setBrowseStatus(st.key);
              }
            }}
          >
            <Text style={[styles.filterPillText, browseStatus === st.key && styles.filterPillTextActive]}>
              {st.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count Bar */}
      <View style={styles.catalogMetaRow}>
        <Text style={styles.catalogCountText}>
          {browseLoading && browseAllItems.length === 0 ? 'Fetching catalog...' : `Showing ${browseAllItems.length} anime`}
        </Text>
        <Text style={styles.catalogHintText}>// 3-COLUMN DIRECTORY</Text>
      </View>
    </View>
  );

  const renderBrowsePartition = () => {
    if (browseLoading && browseAllItems.length === 0) {
      return (
        <View style={styles.partitionContainer}>
          {renderBrowseFilterHeader()}
          {/* Skeleton shimmer grid while first page loads */}
          <View style={styles.threeColGrid}>
            {Array.from({ length: 12 }).map((_, i) => (
              <AnimeCardSkeleton
                key={i}
                cardWidth={cardWidth}
                size="sm"
                style={{ width: cardWidth, marginRight: 0 }}
              />
            ))}
          </View>
        </View>
      );
    }

    if (!browseLoading && browseAllItems.length === 0) {
      return (
        <View style={styles.partitionContainer}>
          {renderBrowseFilterHeader()}
          <View style={styles.emptyStateContainer}>
            <Ionicons name="filter-outline" size={42} color={COLORS.textMuted} />
            <Text style={styles.emptyStateTitle}>No anime match this filter</Text>
            <TouchableOpacity
              style={styles.resetFiltersBtn}
              onPress={() => { setBrowseSort('popular'); setBrowseType('all'); setBrowseStatus('all'); }}
            >
              <Text style={styles.resetFiltersBtnText}>Reset Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.partitionContainer}>
        {renderBrowseFilterHeader()}
        <FlatList
          data={browseAllItems}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          key={`browse-grid-${numColumns}`}
          scrollEnabled={false}
          contentContainerStyle={styles.threeColGridList}
          columnWrapperStyle={styles.threeColRow}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          renderItem={({ item }) => (
            <AnimeCard
              anime={item}
              size="sm"
              cardWidth={cardWidth}
              style={{ width: cardWidth, marginRight: 0 }}
              onPress={handleCardPress}
              showStats
            />
          )}
          ListFooterComponent={() =>
            browseFetchingMore ? (
              <View style={styles.lazyLoadFooter}>
                <ActivityIndicator color={COLORS.neonGold} size="small" />
              </View>
            ) : null
          }
        />
      </View>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // PARTITION 2: GENRES & STUDIOS
  // ──────────────────────────────────────────────────────────────────────────
  const renderGenresPartition = () => {
    return (
      <View style={styles.partitionContainer}>
        {/* Bento Genre Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Genres</Text>
            <TouchableOpacity onPress={() => router.push('/genre')}>
              <Text style={styles.seeAllText}>ALL GENRES →</Text>
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
                transition={300}
              />
              <View style={styles.bentoDim} />
              <LinearGradient colors={['transparent', 'rgba(255,115,70,0.4)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
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
                  transition={300}
                />
                <View style={styles.bentoDim} />
                <LinearGradient colors={['transparent', 'rgba(0,245,255,0.4)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
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
                  transition={300}
                />
                <View style={styles.bentoDim} />
                <LinearGradient colors={['transparent', 'rgba(255,43,60,0.4)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
                <View style={styles.bentoContentSq}>
                  <Text style={[styles.bentoGenreName, { color: BENTO_GENRES[2].color }]}>FANTASY</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.bentoRow}>
              <TouchableOpacity style={styles.bentoTileSq} onPress={() => onGenrePress('Adventure')}>
                <Image
                  source={{ uri: genreImages['adventure'] ?? BENTO_GENRES[3].img }}
                  placeholder={{ uri: BENTO_GENRES[3].img }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={300}
                />
                <View style={styles.bentoDim} />
                <LinearGradient colors={['transparent', 'rgba(255,184,48,0.4)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
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
                  transition={300}
                />
                <View style={styles.bentoDim} />
                <LinearGradient colors={['transparent', 'rgba(255,45,120,0.4)', 'rgba(8,8,16,0.95)']} style={StyleSheet.absoluteFill} />
                <View style={styles.bentoContentSq}>
                  <Text style={[styles.bentoGenreName, { color: BENTO_GENRES[4].color }]}>ROMANCE</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* All Other Genres Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore by Category</Text>
          <View style={styles.genreMatrix}>
            {ALL_GENRES_GRID.map((g) => (
              <TouchableOpacity
                key={g.name}
                style={[
                  styles.genreMatrixTile,
                  { width: Math.floor((windowWidth - SPACING.md * 2 - 16) / 3), borderColor: `${g.color}30` },
                ]}
                onPress={() => onGenrePress(g.name)}
                activeOpacity={0.8}
              >
                <Ionicons name={g.icon as any} size={20} color={g.color} />
                <Text style={styles.genreMatrixLabel}>{g.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Featured Studios */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Animation Studios</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studioRow}>
            {STUDIOS.map((studio) => (
              <TouchableOpacity
                key={studio.id}
                style={[styles.studioCard, { borderColor: studio.color }]}
                onPress={() => router.push(`/genre/${studio.name}`)}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: studio.img }}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                  transition={200}
                />
                <LinearGradient
                  colors={['rgba(8,8,16,0.1)', 'rgba(8,8,16,0.88)']}
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
      </View>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // PARTITION 3: SIMULCASTS (SEASONAL ANIME: SPRING/SUMMER 2026, ETC.)
  // ──────────────────────────────────────────────────────────────────────────
  const renderSimulcastsPartition = () => {
    return (
      <View style={styles.partitionContainer}>
        {/* Season Selector Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.seasonPickerRow}
        >
          {SEASONS_LIST.map((season) => {
            const isSelected = selectedSeason.label === season.label;
            return (
              <TouchableOpacity
                key={season.label}
                style={[styles.seasonChip, isSelected && styles.seasonChipActive]}
                onPress={() => setSelectedSeason(season)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={
                    season.season === 'summer' ? 'sunny' :
                    season.season === 'spring' ? 'flower' :
                    season.season === 'winter' ? 'snow' : 'leaf'
                  }
                  size={14}
                  color={isSelected ? '#000' : COLORS.neonCyan}
                />
                <Text style={[styles.seasonChipText, isSelected && styles.seasonChipTextActive]}>
                  {season.label}
                </Text>
                {season.year === 2026 && season.season === 'summer' && (
                  <View style={[styles.currentSeasonBadge, isSelected && { backgroundColor: '#000' }]}>
                    <Text style={[styles.currentSeasonBadgeText, isSelected && { color: COLORS.neonCyan }]}>
                      AIRING NOW
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Season Banner Header */}
        <View style={styles.simulcastBanner}>
          <LinearGradient
            colors={['rgba(0,245,255,0.18)', 'rgba(255,43,60,0.08)', 'rgba(8,8,16,0.95)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.simulcastBannerGradient}
          >
            <View style={styles.simulcastBadgePill}>
              <Ionicons name="flash" size={11} color="#000" />
              <Text style={styles.simulcastBadgePillText}>SIMULCAST SCHEDULE</Text>
            </View>
            <Text style={styles.simulcastBannerTitle}>
              {selectedSeason.label.toUpperCase()}
            </Text>
            <Text style={styles.simulcastBannerSub}>
              Direct weekly broadcast simulcasts with English Subtitles & Dubs.
            </Text>
          </LinearGradient>
        </View>

        {/* Simulcast Anime Grid */}
        {simulcastsLoading ? (
          <View style={styles.threeColGrid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <AnimeCardSkeleton
                key={i}
                cardWidth={cardWidth}
                size="sm"
                style={{ width: cardWidth, marginRight: 0 }}
              />
            ))}
          </View>
        ) : (
          <View style={styles.threeColGrid}>
            {simulcastAnime.map((item) => (
              <View key={item.id} style={{ width: cardWidth }}>
                <AnimeCard
                  anime={item}
                  size="sm"
                  style={{ width: cardWidth, marginRight: 0 }}
                  onPress={handleCardPress}
                  onLongPress={() => prefetchAnime(item.id)}
                  showStats
                />
                {/* Simulcast Tag Indicator */}
                <View style={styles.simulcastCardPill}>
                  <Text style={styles.simulcastCardPillText}>SIMULCAST</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ── Memoized Search List Components (Prevents re-renders on keystroke) ──
  const searchKeyExtractor = useCallback((item: Anime) => item.id, []);

  const renderSearchItem = useCallback(({ item }: { item: Anime }) => (
    <AnimeCard
      anime={item}
      size="sm"
      cardWidth={cardWidth}
      style={{ width: cardWidth, marginRight: 0 }}
      onPress={handleCardPress}
      onLongPress={() => prefetchAnime(item.id)}
      showStats
    />
  ), [cardWidth, handleCardPress, prefetchAnime]);

  const searchHeaderComponent = useMemo(() => (
    <View style={styles.searchResultsMeta}>
      <Text style={styles.searchResultsCountText}>
        {searchResults.length} {searchResults.length === 1 ? 'anime found' : 'anime found'} for{' '}
      </Text>
      <HighlightText text={`"${debouncedQuery.trim()}"`} query={debouncedQuery.trim()} />
    </View>
  ), [searchResults.length, debouncedQuery]);

  const searchFooterComponent = useMemo(() => (
    <View style={styles.searchFooterContainer}>
      <View style={styles.requestFooterCard}>
        <View style={styles.requestFooterIconWrap}>
          <Ionicons name="sparkles" size={18} color={COLORS.neonGold} />
        </View>
        <View style={styles.requestFooterTextWrap}>
          <Text style={styles.requestFooterTitle}>Didn't find what you wanted?</Text>
          <Text style={styles.requestFooterSub}>Request any anime and we'll import it.</Text>
        </View>
        <TouchableOpacity
          style={styles.requestFooterBtn}
          onPress={() => {
            haptic.selection();
            setShowRequest(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.requestFooterBtnText}>Request →</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), []);

  // ──────────────────────────────────────────────────────────────────────────
  // LIVE SEARCH RESULTS (When query.length > 0)
  // ──────────────────────────────────────────────────────────────────────────
  const renderSearchResults = () => {
    if (searching) {
      return (
        <View style={styles.threeColGrid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <AnimeCardSkeleton
              key={i}
              cardWidth={cardWidth}
              size="sm"
              style={{ width: cardWidth, marginRight: 0 }}
            />
          ))}
        </View>
      );
    }

    if (searchResults.length > 0) {
      return (
        <FlatList
          key={`search-grid-${numColumns}`}
          data={searchResults}
          keyExtractor={searchKeyExtractor}
          numColumns={numColumns}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.searchGridRow}
          renderItem={renderSearchItem}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={numColumns * 3}
          maxToRenderPerBatch={numColumns * 2}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ListHeaderComponent={searchHeaderComponent}
          ListFooterComponent={searchFooterComponent}
        />
      );
    }

    if (!searching && debouncedQuery.trim().length >= MIN_SEARCH_CHARS && searchResults.length === 0) {
      return (
        <View style={styles.noResultsContainer}>
          <View style={styles.noResultsIconWrap}>
            <Ionicons name="search-outline" size={38} color={COLORS.neonCyan} />
          </View>
          <Text style={styles.noResultsTitle}>No anime found</Text>
          <Text style={styles.noResultsBody}>
            We couldn't find any matches for{' '}
            <Text style={{ color: COLORS.neonCyan, fontWeight: '800' }}>"{query.trim()}"</Text>
            .{'\n'}Check your spelling or request to add it to AnimeHub.
          </Text>

          <View style={styles.noResultsActionRow}>
            <TouchableOpacity
              style={styles.requestCta}
              onPress={() => {
                haptic.selection();
                setShowRequest(true);
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[COLORS.neon, '#FF2D78']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.requestCtaGradient}
              >
                <Ionicons name="paper-plane-outline" size={16} color="#fff" />
                <Text style={styles.requestCtaText}>REQUEST THIS ANIME</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={clearSearch}
              style={styles.clearSearchBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={16} color={COLORS.textSub} />
              <Text style={styles.clearSearchBtnText}>Back to Explore</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return null;
  };

  // The main ScrollView's onScroll-based lazy load trigger for Browse tab
  const handleMainScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    scrollOffsetRef.current = contentOffset.y;
    if (activeTab !== 'browse' || !browseHasMore || browseFetchingMore || browseLoading) return;
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 400;
    if (isNearBottom) {
      loadMoreBrowse();
    }
  }, [activeTab, browseHasMore, browseFetchingMore, browseLoading, loadMoreBrowse]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Persistent Search Bar ─────────────────────────────────────────── */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBar,
            isFocused && styles.searchBarFocused,
            isFocused && { borderColor: COLORS.neonCyan }
          ]}
        >
          {isSearchActive ? (
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.searchNavButton}
              accessibilityLabel="Back to Explore"
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={20} color={COLORS.neonCyan} />
            </TouchableOpacity>
          ) : (
            <Ionicons
              name="search"
              size={20}
              color={isFocused ? COLORS.neonCyan : COLORS.textMuted}
            />
          )}
          <TextInput
            ref={searchInputRef}
            style={styles.input}
            placeholder="Search anime, movies..."
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => setDebouncedQuery(query)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          {isSearchActive ? (
            <TouchableOpacity
              onPress={() => {
                haptic.selection();
                setQuery('');
                setDebouncedQuery('');
                searchInputRef.current?.focus();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
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

      {/* ── Active Search Results OR 3-Partition Discovery ─────────────────── */}
      {isSearchActive ? (
        <View style={{ flex: 1 }}>
          {renderSearchResults()}
        </View>
      ) : (
        <ScrollView
          ref={mainScrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
          onScroll={handleMainScroll}
          scrollEventThrottle={200}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.neon}
            />
          }
        >
          {/* Quick Trending Queries */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trendingRow}
          >
            {trendingChips.map((q) => (
              <TouchableOpacity
                key={q}
                style={styles.trendingChip}
                onPress={() => setQuery(q)}
              >
                <Ionicons name="trending-up" size={12} color={COLORS.neonCyan} />
                <Text style={styles.trendingChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── The 3-Way Partition Segmented Switcher ─────────────────────── */}
          <View style={styles.segmentedContainer}>
            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'browse' && styles.segmentBtnActiveGold]}
              onPress={() => {
                if (activeTab !== 'browse') {
                  haptic.selection();
                  setActiveTab('browse');
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="list"
                size={14}
                color={activeTab === 'browse' ? '#000' : COLORS.neonGold}
              />
              <Text style={[styles.segmentLabel, activeTab === 'browse' && styles.segmentLabelActive]}>
                Browse All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'genres' && styles.segmentBtnActiveNeon]}
              onPress={() => {
                if (activeTab !== 'genres') {
                  haptic.selection();
                  setActiveTab('genres');
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="grid"
                size={14}
                color={activeTab === 'genres' ? '#000' : COLORS.neon}
              />
              <Text style={[styles.segmentLabel, activeTab === 'genres' && styles.segmentLabelActive]}>
                Genres
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentBtn, activeTab === 'simulcasts' && styles.segmentBtnActiveCyan]}
              onPress={() => {
                if (activeTab !== 'simulcasts') {
                  haptic.selection();
                  setActiveTab('simulcasts');
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="flash"
                size={14}
                color={activeTab === 'simulcasts' ? '#000' : COLORS.neonCyan}
              />
              <Text style={[styles.segmentLabel, activeTab === 'simulcasts' && styles.segmentLabelActive]}>
                Simulcasts
              </Text>
              <View style={styles.livePulseDot} />
            </TouchableOpacity>
          </View>

          {/* ── Active Partition Content (Preserved in memory for instantaneous switching) ── */}
          <View style={activeTab === 'browse' ? undefined : styles.hiddenPartition}>
            {renderBrowsePartition()}
          </View>
          <View style={activeTab === 'genres' ? undefined : styles.hiddenPartition}>
            {renderGenresPartition()}
          </View>
          <View style={activeTab === 'simulcasts' ? undefined : styles.hiddenPartition}>
            {renderSimulcastsPartition()}
          </View>
        </ScrollView>
      )}

      {/* Filter Bottom Sheet */}
      <Modal visible={showFilter} transparent animationType="slide" onRequestClose={() => setShowFilter(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilter(false)} />
        <BlurView intensity={60} tint="dark" style={styles.filterSheet}>
          <View style={styles.filterHandle} />
          <Text style={styles.filterTitle}>QUICK NAVIGATION</Text>
          <Text style={styles.filterSection}>Jump to Category</Text>
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
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { color: COLORS.textMuted, fontSize: 13, letterSpacing: 2 },

  // ── Persistent Search Bar ──────────────────────────────────────────
  searchSection: {
    marginTop: Platform.OS === 'android' ? SPACING.md : SPACING.sm,
    marginBottom: SPACING.xs,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACING.md,
    backgroundColor: '#1A1A1E',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: SPACING.md,
    height: 52,
    gap: SPACING.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20,
    elevation: 5,
  },
  searchBarFocused: {
    backgroundColor: '#141418',
    borderColor: COLORS.neonCyan,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  filterButton: {
    padding: 6,
    backgroundColor: 'rgba(0, 245, 255, 0.08)',
    borderRadius: RADIUS.sm,
  },

  // ── Trending Search Row ─────────────────────────────────────────────
  trendingRow: { paddingHorizontal: SPACING.md, gap: 8, marginTop: 4, marginBottom: SPACING.sm },
  trendingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  trendingChipText: { color: COLORS.textSub, fontSize: 11, fontWeight: '700' },

  // ── 3-Way Segment Switcher ──────────────────────────────────────────
  segmentedContainer: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.xs,
    backgroundColor: '#151518',
    borderRadius: RADIUS.md,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
  },
  segmentBtnActiveGold: {
    backgroundColor: COLORS.neonGold,
  },
  segmentBtnActiveNeon: {
    backgroundColor: COLORS.neon,
  },
  segmentBtnActiveCyan: {
    backgroundColor: COLORS.neonCyan,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSub,
  },
  segmentLabelActive: {
    color: '#000',
    fontWeight: '900',
  },
  hiddenPartition: {
    display: 'none',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF2D78',
  },

  // ── Partition General ───────────────────────────────────────────────
  partitionContainer: {
    marginTop: SPACING.sm,
  },
  partitionLoading: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  loadingSubText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },

  // ── Partition 1: Browse All Styles ─────────────────────────────────
  filterPillRow: {
    paddingHorizontal: SPACING.md,
    gap: 8,
    alignItems: 'center',
    paddingVertical: 4,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(255,214,0,0.15)',
    borderColor: COLORS.neonGold,
  },
  filterPillActiveFormat: {
    backgroundColor: 'rgba(255,43,60,0.15)',
    borderColor: COLORS.neon,
  },
  filterPillActiveStatus: {
    backgroundColor: 'rgba(0,245,255,0.15)',
    borderColor: COLORS.neonCyan,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  filterPillTextActive: {
    color: COLORS.text,
    fontWeight: '800',
  },
  filterPillDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
  },
  catalogMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  catalogCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  catalogHintText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  threeColGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: GRID_GAP,
    rowGap: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xs,
  },
  threeColGridList: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  threeColRow: {
    gap: GRID_GAP,
    marginBottom: SPACING.md,
    justifyContent: 'flex-start',
  },
  lazyLoadFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: SPACING.sm,
  },
  emptyStateTitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  resetFiltersBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,214,0,0.1)',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.neonGold,
  },
  resetFiltersBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.neonGold,
  },

  // ── Partition 2: Genres Styles ──────────────────────────────────────
  section: { paddingHorizontal: SPACING.md, marginBottom: SPACING.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: SPACING.md },
  sectionTitle: { fontSize: 20, color: COLORS.text, fontWeight: '900', letterSpacing: -0.5, marginBottom: SPACING.sm },
  seeAllText: { fontSize: 11, color: COLORS.neonCyan, fontWeight: '800', letterSpacing: 1.5 },

  bentoGrid: { gap: SPACING.md },
  bentoTile: { borderRadius: RADIUS.lg, overflow: 'hidden', position: 'relative' },
  bentoTileWide: { height: 150 },
  bentoTileSq: { flex: 1, height: 140, borderRadius: RADIUS.lg, overflow: 'hidden' },
  bentoRow: { flexDirection: 'row', gap: SPACING.md },
  bentoDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  bentoContent: { position: 'absolute', bottom: SPACING.md, left: SPACING.md },
  bentoContentSq: { position: 'absolute', bottom: SPACING.md, left: SPACING.md },
  bentoGenreName: {
    fontSize: 17, fontWeight: '900', letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  bentoSubText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2, fontWeight: '500' },

  genreMatrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreMatrixTile: {
    backgroundColor: '#18181C',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  genreMatrixLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },

  studioRow: { gap: SPACING.md, paddingVertical: SPACING.xs },
  studioCard: {
    width: 140,
    height: 85,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
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
    fontSize: 13,
    fontWeight: '900',
    backgroundColor: 'rgba(8,8,16,0.75)',
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
  },
  studioCardName: {
    fontSize: 10,
    color: COLORS.text,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // ── Partition 3: Simulcast Styles ───────────────────────────────────
  seasonPickerRow: {
    paddingHorizontal: SPACING.md,
    gap: 8,
    marginBottom: SPACING.sm,
  },
  seasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: 'rgba(0, 245, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.15)',
  },
  seasonChipActive: {
    backgroundColor: COLORS.neonCyan,
    borderColor: COLORS.neonCyan,
  },
  seasonChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  seasonChipTextActive: {
    color: '#000',
    fontWeight: '900',
  },
  currentSeasonBadge: {
    backgroundColor: 'rgba(0, 245, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentSeasonBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.neonCyan,
  },
  simulcastBanner: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.25)',
    marginBottom: SPACING.sm,
  },
  simulcastBannerGradient: {
    padding: SPACING.md,
    gap: 4,
  },
  simulcastBadgePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.neonGold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 4,
  },
  simulcastBadgePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  simulcastBannerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  simulcastBannerSub: {
    fontSize: 11,
    color: COLORS.textSub,
    lineHeight: 16,
  },
  simulcastCardPill: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderWidth: 1,
    borderColor: COLORS.neonGold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  simulcastCardPillText: {
    fontSize: 8,
    fontWeight: '900',
    color: COLORS.neonGold,
  },

  // ── Search Results List ─────────────────────────────────────────────
  grid: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 110 },
  searchGridRow: { gap: GRID_GAP, marginBottom: SPACING.md, justifyContent: 'flex-start' },
  searchNavButton: {
    paddingRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchFooterContainer: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  requestFooterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  requestFooterIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,214,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestFooterTextWrap: {
    flex: 1,
  },
  requestFooterTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  requestFooterSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  requestFooterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,43,60,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,43,60,0.3)',
  },
  requestFooterBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.neon,
  },

  // ── No Results State ────────────────────────────────────────────────
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: 60,
    gap: SPACING.md,
  },
  noResultsIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,245,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  noResultsTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  noResultsBody: {
    fontSize: 14,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  noResultsActionRow: {
    width: '100%',
    maxWidth: 300,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  requestCta: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    width: '100%',
  },
  requestCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  requestCtaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  clearSearchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  clearSearchBtnText: {
    color: COLORS.textSub,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Filter Modal ────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  filterSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 48,
    overflow: 'hidden',
    backgroundColor: 'rgba(19,19,22,0.92)',
    borderTopWidth: 1, borderColor: COLORS.borderNeutral,
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
    borderRadius: 100, borderWidth: 1, borderColor: COLORS.borderNeutral,
  },
  filterChipText: { color: COLORS.textSub, fontSize: 12, fontWeight: '700' },

  // ── Search Results Meta + Highlight ──────────────────────────────────
  searchResultsMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 2,
  },
  searchResultsCountText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  highlightBase: {
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: '600',
  },
  highlightMatch: {
    color: COLORS.neon,
    fontWeight: '900',
    backgroundColor: 'rgba(255,43,60,0.12)',
    borderRadius: 3,
  },
});
