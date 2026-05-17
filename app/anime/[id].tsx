import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet,
  TouchableOpacity, Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { supabase, animeAPI, episodeAPI, reviewAPI, userAPI, AnimeWithStats, Episode, Review } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';

const { width, height } = Dimensions.get('window');

export default function AnimeDetailScreen() {
  const params = useLocalSearchParams();
  const animeId = typeof params.id === 'string' ? params.id : (Array.isArray(params.id) ? params.id[0] : '');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, session } = useAuth();

  const [anime, setAnime] = useState<AnimeWithStats | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [activeTab, setActiveTab] = useState<'episodes' | 'reviews' | 'info'>('episodes');

  useFocusEffect(
    useCallback(() => {
      if (animeId) {
        loadData();
      }
    }, [animeId])
  );

  async function loadData() {
    setLoading(true);
    try {
      const [animeRes, epRes, revRes] = await Promise.all([
        animeAPI.getById(animeId),
        episodeAPI.getByAnime(animeId),
        reviewAPI.getByAnime(animeId),
      ]);
      if (animeRes.data) setAnime(animeRes.data);
      if (epRes.data) setEpisodes(epRes.data);
      if (revRes.data) setReviews(revRes.data as any);

      // Check user state with targeted queries (no full-table scan)
      if (user) {
        const [favRes, wlRes] = await Promise.all([
          supabase
            .from('user_favorites')
            .select('id')
            .eq('user_id', user.id)
            .eq('anime_id', animeId)
            .maybeSingle(),
          supabase
            .from('user_watchlist')
            .select('id')
            .eq('user_id', user.id)
            .eq('anime_id', animeId)
            .maybeSingle(),
        ]);
        setIsFav(!!favRes.data);
        setInWatchlist(!!wlRes.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const toggleFav = async () => {
    if (!user) { router.push('/auth/login'); return; }
    if (isFav) {
      await userAPI.removeFavorite(user.id, animeId);
      setIsFav(false);
    } else {
      await userAPI.addFavorite(user.id, animeId);
      setIsFav(true);
    }
  };

  const toggleWatchlist = async () => {
    if (!user) { router.push('/auth/login'); return; }
    if (inWatchlist) {
      await userAPI.removeFromWatchlist(user.id, animeId);
      setInWatchlist(false);
    } else {
      await userAPI.addToWatchlist(user.id, animeId);
      setInWatchlist(true);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.neon} size="large" />
      </View>
    );
  }

  if (!anime) return null;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner Hero */}
        <View style={styles.bannerWrap}>
          <Image
            source={{ uri: anime.banner_url || anime.poster_url || '' }}
            style={styles.banner}
            resizeMode="cover"
          />
          <View style={styles.bannerOverlay} />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + SPACING.sm }]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>

          {/* Poster + basic info */}
          <View style={styles.posterRow}>
            <Image
              source={{ uri: anime.poster_url || '' }}
              style={styles.poster}
              resizeMode="cover"
            />
            <View style={styles.posterInfo}>
              <Text style={styles.title}>{anime.title}</Text>
              {anime.title_japanese && (
                <Text style={styles.titleJp}>{anime.title_japanese}</Text>
              )}
              <View style={styles.metaRow}>
                {anime.year && <MetaBadge label={String(anime.year)} />}
                {anime.type && <MetaBadge label={anime.type} />}
                {anime.status && <MetaBadge label={anime.status} color={anime.status === 'Ongoing' ? COLORS.success : COLORS.textSub} />}
              </View>
              {anime.user_rating_avg && (
                <View style={styles.ratingRow}>
                  {[1,2,3,4,5].map(i => (
                    <Ionicons
                      key={i}
                      name={i <= Math.round(Number(anime.user_rating_avg) / 2) ? 'star' : 'star-outline'}
                      size={14}
                      color={COLORS.neonGold}
                    />
                  ))}
                  <Text style={styles.ratingNum}>{Number(anime.user_rating_avg).toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.playBigBtn}
            onPress={() => {
              if (episodes.length > 0) {
                router.push(`/watch/${episodes[0].id}`);
              } else {
                router.push(`/anime/episodes/${animeId}?animeTitle=${encodeURIComponent(anime.title)}`);
              }
            }}
          >
            <Ionicons name="play" size={18} color={COLORS.bg} />
            <Text style={styles.playBigText}>START WATCHING</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconActionBtn, inWatchlist && styles.iconActionBtnActive]} onPress={toggleWatchlist}>
            <Ionicons name={inWatchlist ? 'bookmark' : 'bookmark-outline'} size={20} color={inWatchlist ? COLORS.neon : COLORS.textSub} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconActionBtn, isFav && styles.iconActionBtnPink]} onPress={toggleFav}>
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={20} color={isFav ? COLORS.neonPink : COLORS.textSub} />
          </TouchableOpacity>
        </View>

        {/* Stats strip */}
        <View style={styles.statsStrip}>
          <StatItem icon="film-outline" value={String(anime.actual_episode_count || anime.total_episodes || '?')} label="Episodes" />
          <View style={styles.statDivider} />
          <StatItem icon="eye-outline" value={String(anime.total_watches || 0)} label="Watches" />
          <View style={styles.statDivider} />
          <StatItem icon="heart-outline" value={String(anime.favorite_count || 0)} label="Favorites" />
          <View style={styles.statDivider} />
          <StatItem icon="chatbubble-outline" value={String(anime.review_count || 0)} label="Reviews" />
        </View>

        {/* Genre tags */}
        {anime.genres?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreRow}>
            {anime.genres.map((g) => (
              <TouchableOpacity
                key={g}
                style={styles.genreTag}
                onPress={() => router.push(`/genre/${g}`)}
              >
                <Text style={styles.genreTagText}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {(['episodes', 'reviews', 'info'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'episodes' && (
          <EpisodesTab episodes={episodes} anime={anime} router={router} user={user} />
        )}
        {activeTab === 'reviews' && (
          <ReviewsTab reviews={reviews} anime={anime} router={router} user={user} />
        )}
        {activeTab === 'info' && (
          <InfoTab anime={anime} />
        )}
      </ScrollView>
    </View>
  );
}

function MetaBadge({ label, color }: { label: string; color?: string }) {
  return (
    <View style={styles.metaBadge}>
      <Text style={[styles.metaBadgeText, color ? { color } : {}]}>{label}</Text>
    </View>
  );
}

function StatItem({ icon, value, label }: any) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={16} color={COLORS.neon} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EpisodesTab({ episodes, anime, router, user }: any) {
  return (
    <View style={styles.tabContent}>
      {episodes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No episodes yet</Text>
        </View>
      ) : (
        <>
          {episodes.slice(0, 5).map((ep: Episode) => (
            <TouchableOpacity
              key={ep.id}
              style={styles.epRow}
              onPress={() => {
                if (ep.is_premium && user?.subscription_type !== 'premium') {
                  Alert.alert('Premium Required', 'Upgrade to watch premium episodes.');
                  return;
                }
                router.push(`/watch/${ep.id}?animeTitle=${encodeURIComponent(anime.title)}`);
              }}
            >
              <View style={styles.epNumWrap}>
                {ep.is_premium ? (
                  <Ionicons name="star" size={14} color={COLORS.neonGold} />
                ) : (
                  <Text style={styles.epNum}>{ep.episode_number}</Text>
                )}
              </View>
              <View style={styles.epInfo}>
                <Text style={styles.epTitle} numberOfLines={1}>
                  {ep.title || `Episode ${ep.episode_number}`}
                </Text>
                <Text style={styles.epMeta}>
                  {ep.duration ? `${ep.duration}m` : ''}{ep.air_date ? ` • ${ep.air_date}` : ''}
                </Text>
              </View>
              {ep.is_premium && user?.subscription_type !== 'premium' ? (
                <Ionicons name="lock-closed" size={16} color={COLORS.neonGold} />
              ) : (
                <Ionicons name="play-circle-outline" size={22} color={COLORS.neon} />
              )}
            </TouchableOpacity>
          ))}
          {episodes.length > 5 && (
            <TouchableOpacity
              style={styles.seeAllEps}
              onPress={() => router.push(`/anime/episodes/${anime.id}?animeTitle=${encodeURIComponent(anime.title)}`)}
            >
              <Text style={styles.seeAllEpsText}>SEE ALL {episodes.length} EPISODES →</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

function ReviewsTab({ reviews, anime, router, user }: any) {
  return (
    <View style={styles.tabContent}>
      {reviews.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No reviews yet. Be the first!</Text>
          <TouchableOpacity
            style={[styles.writeReviewBtn, { marginTop: SPACING.md, alignSelf: 'center' }]}
            onPress={() => router.push(`/anime/reviews/${anime.id}?animeTitle=${encodeURIComponent(anime.title)}`)}
          >
            <Ionicons name="create-outline" size={16} color={COLORS.neon} />
            <Text style={styles.writeReviewText}>WRITE A REVIEW</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.reviewSummary}>
            <View style={styles.ratingBox}>
              <Text style={styles.ratingAvg}>{Number(anime.user_rating_avg || 0).toFixed(1)}</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Ionicons
                    key={i}
                    name={i <= Math.round(Number(anime.user_rating_avg || 0) / 2) ? 'star' : 'star-outline'}
                    size={14}
                    color={COLORS.neonGold}
                  />
                ))}
              </View>
              <Text style={styles.reviewCountLabel}>{anime.review_count || 0} Reviews</Text>
            </View>
            <TouchableOpacity
              style={styles.seeAllReviewsBtn}
              onPress={() => router.push(`/anime/reviews/${anime.id}?animeTitle=${encodeURIComponent(anime.title)}`)}
            >
              <Text style={styles.seeAllReviewsText}>SEE ALL & WRITE REVIEW →</Text>
            </TouchableOpacity>
          </View>

          {reviews.slice(0, 3).map((r: any) => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewAvatar}>
                  <Text style={styles.reviewAvatarText}>
                    {r.users?.username?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.reviewUsername}>{r.users?.username || 'Anonymous'}</Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <Ionicons key={i} name={i <= (r.rating || 0) ? 'star' : 'star-outline'} size={11} color={COLORS.neonGold} />
                    ))}
                  </View>
                </View>
                {r.is_spoiler && (
                  <View style={styles.spoilerBadge}>
                    <Text style={styles.spoilerText}>SPOILER</Text>
                  </View>
                )}
              </View>
              <Text style={styles.reviewText} numberOfLines={3}>{r.review_text}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function InfoTab({ anime }: { anime: AnimeWithStats }) {
  return (
    <View style={styles.tabContent}>
      {anime.description && (
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>// SYNOPSIS</Text>
          <Text style={styles.infoText}>{anime.description}</Text>
        </View>
      )}
      <View style={styles.infoGrid}>
        {[
          { label: 'Type', value: anime.type },
          { label: 'Status', value: anime.status },
          { label: 'Year', value: anime.year },
          { label: 'Episodes', value: anime.total_episodes },
          { label: 'Duration', value: anime.duration ? `${anime.duration} min` : null },
          { label: 'Age Rating', value: anime.age_rating },
          { label: 'MAL ID', value: anime.mal_id },
        ].filter(i => i.value).map((item) => (
          <View key={item.label} style={styles.infoRow}>
            <Text style={styles.infoRowLabel}>{item.label}</Text>
            <Text style={styles.infoRowValue}>{String(item.value)}</Text>
          </View>
        ))}
      </View>
      {anime.studios?.length ? (
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>// STUDIOS</Text>
          <Text style={styles.infoText}>{anime.studios.join(', ')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },

  bannerWrap: { height: 300, position: 'relative' },
  banner: { ...StyleSheet.absoluteFillObject },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,16,0.5)',
  },
  backBtn: {
    position: 'absolute', left: SPACING.md,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(8,8,16,0.7)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  posterRow: {
    position: 'absolute', bottom: -SPACING.xl,
    left: SPACING.md, right: SPACING.md,
    flexDirection: 'row', gap: SPACING.md,
  },
  poster: {
    width: 110, height: 160,
    borderRadius: RADIUS.md,
    borderWidth: 2, borderColor: COLORS.border,
  },
  posterInfo: { flex: 1, paddingTop: SPACING.lg, justifyContent: 'flex-end', paddingBottom: SPACING.sm },
  title: { fontSize: 18, color: COLORS.text, fontWeight: '900', letterSpacing: -0.3, lineHeight: 22 },
  titleJp: { fontSize: 12, color: COLORS.textSub, marginTop: 3, letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', gap: 4, marginTop: SPACING.xs, flexWrap: 'wrap' },
  metaBadge: {
    paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: 'rgba(191,95,255,0.12)',
    borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  metaBadgeText: { fontSize: 10, color: COLORS.textSub, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: SPACING.xs },
  ratingNum: { fontSize: 12, color: COLORS.neonGold, fontWeight: '700', marginLeft: 4 },

  actionRow: {
    flexDirection: 'row', gap: SPACING.sm,
    marginTop: SPACING.xxl + SPACING.sm,
    marginHorizontal: SPACING.md,
  },
  playBigBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, backgroundColor: COLORS.neon,
    paddingVertical: 13, borderRadius: RADIUS.md,
  },
  playBigText: { color: COLORS.bg, fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  iconActionBtn: {
    width: 48, height: 48,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  iconActionBtnActive: { borderColor: COLORS.neon, backgroundColor: 'rgba(191,95,255,0.1)' },
  iconActionBtnPink: { borderColor: COLORS.neonPink, backgroundColor: 'rgba(255,45,120,0.1)' },

  statsStrip: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: SPACING.md,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  statValue: { fontSize: 14, color: COLORS.text, fontWeight: '700' },
  statLabel: { fontSize: 10, color: COLORS.textMuted, letterSpacing: 0.5 },

  genreRow: { paddingHorizontal: SPACING.md, gap: SPACING.xs, marginTop: SPACING.md },
  genreTag: {
    paddingVertical: 5, paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.xl,
    backgroundColor: 'rgba(191,95,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(191,95,255,0.3)',
  },
  genreTagText: { fontSize: 11, color: COLORS.neon, fontWeight: '600' },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md, marginTop: SPACING.lg,
    borderBottomWidth: 1, borderColor: COLORS.border,
  },
  tab: { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderColor: COLORS.neon },
  tabText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 1 },
  tabTextActive: { color: COLORS.neon },
  tabContent: { padding: SPACING.md },

  epRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderColor: COLORS.border,
  },
  epNumWrap: {
    width: 36, height: 36,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  epNum: { fontSize: 13, color: COLORS.neon, fontWeight: '700' },
  epInfo: { flex: 1 },
  epTitle: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  epMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  seeAllEps: {
    marginTop: SPACING.md, alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
  },
  seeAllEpsText: { fontSize: 12, color: COLORS.neon, fontWeight: '700', letterSpacing: 1 },

  writeReviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    borderWidth: 1, borderColor: COLORS.neon,
    borderRadius: RADIUS.md, paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.md,
    backgroundColor: 'rgba(191,95,255,0.08)',
    alignSelf: 'flex-start',
  },
  writeReviewText: { fontSize: 12, color: COLORS.neon, fontWeight: '700', letterSpacing: 1 },

  reviewSummary: {
    backgroundColor: COLORS.bgCard,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  ratingBox: { alignItems: 'center', gap: 2 },
  ratingAvg: { fontSize: 24, color: COLORS.neonGold, fontWeight: '900' },
  starsRow: { flexDirection: 'row', gap: 1 },
  reviewCountLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },
  seeAllReviewsBtn: {
    flex: 1, height: 44,
    backgroundColor: 'rgba(191,95,255,0.08)',
    borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.neon,
  },
  seeAllReviewsText: { fontSize: 11, color: COLORS.neon, fontWeight: '800', letterSpacing: 1 },

  reviewCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.xs },
  reviewAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(191,95,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.neon,
  },
  reviewAvatarText: { fontSize: 14, color: COLORS.neon, fontWeight: '700' },
  reviewUsername: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  reviewStars: { flexDirection: 'row', gap: 1, marginTop: 2 },
  spoilerBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,45,120,0.15)',
    borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: COLORS.neonPink,
  },
  spoilerText: { fontSize: 9, color: COLORS.neonPink, fontWeight: '700', letterSpacing: 1 },
  reviewText: { fontSize: 13, color: COLORS.textSub, lineHeight: 20 },

  infoBlock: { marginBottom: SPACING.lg },
  infoLabel: { fontSize: 11, color: COLORS.neon, fontWeight: '800', letterSpacing: 2, marginBottom: SPACING.xs },
  infoText: { fontSize: 14, color: COLORS.textSub, lineHeight: 22 },
  infoGrid: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', marginBottom: SPACING.lg,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderColor: COLORS.border,
  },
  infoRowLabel: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  infoRowValue: { fontSize: 13, color: COLORS.text, fontWeight: '600' },

  emptyState: { alignItems: 'center', padding: SPACING.xl },
  emptyText: { fontSize: 13, color: COLORS.textMuted },
});
