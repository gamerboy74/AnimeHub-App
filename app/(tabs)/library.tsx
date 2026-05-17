import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image,
  Dimensions, RefreshControl, ActivityIndicator, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { userAPI } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import AnimeCard from '../../src/components/ui/AnimeCard';

const { width } = Dimensions.get('window');

type LibraryTab = 'watchlist' | 'completed' | 'dropped';

export default function LibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<LibraryTab>('watchlist');
  const [continueWatching, setContinueWatching] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [completed, setCompleted] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);

  const cardWidth = width * 0.75 + SPACING.md;

  const fetchData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const [progRes, wlRes] = await Promise.all([
        userAPI.getProgress(user.id),
        userAPI.getWatchlist(user.id),
      ]);
      
      const allProgress = progRes.data || [];
      // Continue Watching: not completed
      setContinueWatching(allProgress.filter(p => !p.is_completed).slice(0, 10));
      // Completed: is completed
      setCompleted(allProgress.filter(p => p.is_completed));
      // Watchlist
      setWatchlist(wlRes.data || []);
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const getTabData = () => {
    switch (activeTab) {
      case 'watchlist': return watchlist.map(item => item.anime);
      case 'completed': return completed.map(item => item); // In progressDetailed, 'anime' is nested too
      case 'dropped': return [];
      default: return [];
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="library-outline" size={64} color={COLORS.textMuted} />
        <Text style={styles.guestTitle}>YOUR DIGITAL ARCHIVE</Text>
        <Text style={styles.guestSub}>Sign in to access your curated library of neon dreams.</Text>
        <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/auth/login')}>
          <Text style={styles.loginBtnText}>ACCESS ARCHIVE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.neon} />}
      >
        {/* Hero Header */}
        <View style={styles.hero}>
          <View style={styles.heroBlob} />
          <Text style={styles.heroTitle}>
            My <Text style={styles.heroTitleItalic}>Library</Text>
          </Text>
          <Text style={styles.heroSub}>Your curated digital archive of parallel worlds and neon dreams.</Text>
        </View>

        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionLabel}>IN PROGRESS</Text>
                <Text style={styles.sectionTitle}>Continue Watching</Text>
              </View>
              <View style={styles.scrollBtns}>
                <TouchableOpacity 
                  style={styles.scrollBtn}
                  onPress={() => {
                    const newOffset = Math.max(0, scrollOffset.current - cardWidth);
                    scrollRef.current?.scrollTo({ x: newOffset, animated: true });
                  }}
                >
                  <Ionicons name="chevron-back" size={16} color={COLORS.text} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.scrollBtn}
                  onPress={() => {
                    const newOffset = scrollOffset.current + cardWidth;
                    scrollRef.current?.scrollTo({ x: newOffset, animated: true });
                  }}
                >
                  <Ionicons name="chevron-forward" size={16} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView 
              ref={scrollRef}
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.continueScroll}
              snapToInterval={cardWidth}
              decelerationRate="fast"
              onScroll={(e) => {
                scrollOffset.current = e.nativeEvent.contentOffset.x;
              }}
              scrollEventThrottle={16}
            >
              {continueWatching.map((item) => {
                const progress = item.episode_duration > 0
                  ? (item.progress_seconds / (item.episode_duration * 60)) * 100
                  : item.progress_percentage || 0;
                
                return (
                  <TouchableOpacity 
                    key={item.id} 
                    style={styles.continueCard}
                    onPress={() => router.push(`/anime/${item.anime_id}`)}
                  >
                    <View style={styles.continueThumbBox}>
                      <Image 
                        source={{ uri: item.thumbnail_url || item.poster_url }} 
                        style={styles.continueThumb}
                        resizeMode="cover"
                      />
                      <View style={styles.continueOverlay} />
                      <View style={styles.continueProgressBox}>
                        <View style={styles.progressBg}>
                          <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
                        </View>
                        <View style={styles.progressLabels}>
                          <Text style={styles.progressLabel}>EP {item.episode_number.toString().padStart(2, '0')} / {item.total_episodes || '??'}</Text>
                          <Text style={styles.progressLabel}>{item.episode_duration ? `${Math.max(0, item.episode_duration - Math.floor(item.progress_seconds / 60))}M LEFT` : 'IN PROGRESS'}</Text>
                        </View>
                      </View>
                      <View style={styles.playIconBox}>
                        <Ionicons name="play" size={24} color={COLORS.bg} style={{ marginLeft: 3 }} />
                      </View>
                    </View>
                    <Text style={styles.continueCardTitle} numberOfLines={1}>{item.anime_title}</Text>
                    <Text style={styles.continueCardSub}>{item.genres?.[0] || 'Anime'} • Episode {item.episode_number}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Library Tabs & Filtering */}
        <View style={styles.librarySection}>
          <View style={styles.tabBarRow}>
            <View style={styles.tabInner}>
              {(['watchlist', 'completed', 'dropped'] as LibraryTab[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.tabItem, activeTab === t && styles.tabItemActive]}
                  onPress={() => setActiveTab(t)}
                >
                  <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <View style={styles.filterBar}>
            <TouchableOpacity style={styles.filterBtn}>
              <Ionicons name="filter-outline" size={16} color={COLORS.textSub} />
              <Text style={styles.filterText}>SORT: RECENT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.gridBtn}>
              <Ionicons name="grid" size={16} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={COLORS.neon} style={{ marginTop: SPACING.xl }} />
          ) : getTabData().length === 0 ? (
            <View style={styles.emptyGrid}>
              <Ionicons name="cube-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyGridText}>NO DATA IN {activeTab.toUpperCase()}</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {getTabData().map((anime, idx) => (
                <TouchableOpacity 
                  key={anime?.id || idx} 
                  style={styles.gridItem}
                  onPress={() => router.push(`/anime/${anime.id}`)}
                >
                  <View style={styles.posterBox}>
                    <Image 
                      source={{ uri: anime.poster_url }} 
                      style={styles.gridPoster} 
                      resizeMode="cover"
                    />
                    {anime.type && (
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{anime.type.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.gridTitle} numberOfLines={1}>{anime.title}</Text>
                  <View style={styles.gridMeta}>
                    <Ionicons name="star" size={10} color={COLORS.neonCyan} />
                    <Text style={styles.gridRating}>{Number(anime.rating || 0).toFixed(1)}</Text>
                    <Text style={styles.gridSeparator}>•</Text>
                    <Text style={styles.gridType}>{anime.type || 'Series'}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  guestTitle: { fontSize: 20, color: COLORS.text, fontWeight: '900', marginTop: SPACING.md, letterSpacing: 2 },
  guestSub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 20 },
  loginBtn: { marginTop: SPACING.xl, backgroundColor: COLORS.neon, paddingVertical: 12, paddingHorizontal: 32, borderRadius: RADIUS.md },
  loginBtnText: { color: COLORS.bg, fontWeight: '900', letterSpacing: 1 },

  hero: { padding: SPACING.md, marginTop: SPACING.md, position: 'relative' },
  heroBlob: { position: 'absolute', left: -40, top: -20, width: 120, height: 120, backgroundColor: 'rgba(191,95,255,0.05)', borderRadius: 60, filter: 'blur(40px)' } as any,
  heroTitle: { fontSize: 42, fontWeight: '800', color: COLORS.text, letterSpacing: -1 },
  heroTitleItalic: { color: COLORS.neon, fontStyle: 'italic' },
  heroSub: { fontSize: 13, color: COLORS.textSub, marginTop: 4, maxWidth: '80%' },

  section: { marginTop: SPACING.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  sectionLabel: { fontSize: 10, color: COLORS.neonPulse || COLORS.neonCyan, fontWeight: '800', letterSpacing: 2, marginBottom: 2 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  scrollBtns: { flexDirection: 'row', gap: 8 },
  scrollBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },

  continueScroll: { paddingHorizontal: SPACING.md, gap: SPACING.md, paddingBottom: SPACING.md },
  continueCard: { width: width * 0.75 },
  continueThumbBox: { aspectRatio: 16/9, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: COLORS.bgCard, elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10 },
  continueThumb: { ...StyleSheet.absoluteFillObject },
  continueOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,8,16,0.3)' },
  continueProgressBox: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  progressBg: { height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.neonCyan, shadowColor: COLORS.neonCyan, shadowOpacity: 0.8, shadowRadius: 5 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '800', letterSpacing: 1 },
  playIconBox: { position: 'absolute', top: '50%', left: '50%', transform: [{translateX: -20}, {translateY: -20}], width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.neon, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.neon, shadowOpacity: 0.4, shadowRadius: 8 },

  continueCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 10 },
  continueCardSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  librarySection: { marginTop: SPACING.xl, paddingBottom: 100 },
  tabBarRow: { paddingHorizontal: SPACING.md, marginBottom: SPACING.lg },
  tabInner: { 
    flexDirection: 'row',
    backgroundColor: 'rgba(18,18,24,0.8)', 
    borderRadius: RADIUS.md, 
    padding: 6,
    gap: 4,
  },
  tabItem: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center' },
  tabItemActive: { 
    backgroundColor: '#BD9DFF',
    shadowColor: '#BD9DFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.textSub, letterSpacing: 0.3 },
  tabTextActive: { color: '#2B1A5C' },

  filterBar: { flexDirection: 'row', paddingHorizontal: SPACING.md, marginBottom: SPACING.lg, gap: 10 },
  filterBtn: { 
    flex: 1,
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    backgroundColor: '#1C1C24', 
    borderRadius: RADIUS.md,
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.03)' 
  },
  gridBtn: {
    width: 50,
    height: 50,
    backgroundColor: '#1C1C24',
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)'
  },
  filterText: { fontSize: 10, fontWeight: '900', color: COLORS.textSub, letterSpacing: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.sm },
  gridItem: { width: '50%', padding: SPACING.sm, marginBottom: SPACING.md },
  posterBox: { 
    aspectRatio: 2/3, 
    borderRadius: RADIUS.md, 
    overflow: 'hidden', 
    backgroundColor: COLORS.bgCard,
    marginBottom: 10
  },
  gridPoster: { ...StyleSheet.absoluteFillObject },
  typeBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: COLORS.neonCyan, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeBadgeText: { fontSize: 8, fontWeight: '900', color: COLORS.bg },
  
  gridTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  gridMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gridRating: { fontSize: 11, fontWeight: '700', color: COLORS.textSub },
  gridSeparator: { fontSize: 11, color: COLORS.textMuted },
  gridType: { fontSize: 11, color: COLORS.textMuted },

  emptyGrid: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: SPACING.md },
  emptyGridText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '800', letterSpacing: 2 },
});
