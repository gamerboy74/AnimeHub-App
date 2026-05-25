import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Dimensions, ActivityIndicator, Alert, Modal, TouchableWithoutFeedback,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import YoutubePlayer from 'react-native-youtube-iframe';
import * as ScreenOrientation from 'expo-screen-orientation';
import { COLORS, SPACING, RADIUS } from '../../src/constants/theme';
import { supabase, userAPI, AnimeWithStats, Episode, Review, Character, RelatedAnime } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useAnimeDetails, useEpisodes, useAnimeCharacters, useAnimeRelations } from '../../src/hooks/useQueries';
import { useToggleFavorite, useToggleWatchlist } from '../../src/hooks/useOptimisticMutations';
import { getAllDownloads } from '../../src/hooks/useHlsDownloader';

const { width, height } = Dimensions.get('window');

export default function AnimeDetailScreen() {
  const params = useLocalSearchParams();
  const animeId = useMemo(() => {
    const raw = params.id;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) return raw[0] ?? '';
    return '';
  }, [params.id]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // ── Cached data via TanStack Query (survives tab switches within staleTime) ──
  const { data: anime = null, isLoading: loadingAnime } = useAnimeDetails(animeId);
  const { data: allEpisodes = [], isLoading: loadingEpisodes } = useEpisodes(animeId);
  const episodes = useMemo(
    () => allEpisodes.filter(ep => !!ep.video_url?.trim()),
    [allEpisodes],
  );
  const { data: characters = [] } = useAnimeCharacters(animeId);
  const { data: relations = [] } = useAnimeRelations(animeId);

  // ── User-specific state (not cached globally — per-user) ──────────────────
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFav, setIsFav] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [activeTab, setActiveTab] = useState<'episodes' | 'reviews' | 'info'>('episodes');
  const [resumeEpisodeId, setResumeEpisodeId] = useState<string | null>(null);
  const [resumeProgress, setResumeProgress] = useState<{ epNum: number; seconds: number } | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [trailerVisible, setTrailerVisible] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  const loading = loadingAnime || loadingEpisodes;

  const checkDownloads = useCallback(async () => {
    try {
      const list = await getAllDownloads();
      setDownloadedIds(new Set(list.map(d => d.episodeId)));
    } catch (e) {
      console.error('[AnimeDetail] checkDownloads error:', e);
    }
  }, []);

  const navigation = useNavigation();

  useEffect(() => {
    checkDownloads();
    const unsubscribe = navigation.addListener('focus', () => {
      checkDownloads();
    });
    return unsubscribe;
  }, [navigation, checkDownloads]);

  // Fetch user-specific data (reviews + fav/watchlist/progress) separately
  useEffect(() => {
    if (!animeId) return;
    let cancelled = false;

    const loadUserData = async () => {
      setLoadingUser(true);
      try {
        const { data: revData } = await supabase
          .from('reviews')
          .select('*, users(username, avatar_url)')
          .eq('anime_id', animeId)
          .order('created_at', { ascending: false });
        if (!cancelled && revData) setReviews(revData as any);

        if (user) {
          const [favRes, wlRes, progressRes] = await Promise.all([
            supabase.from('user_favorites').select('id').eq('user_id', user.id).eq('anime_id', animeId).maybeSingle(),
            supabase.from('user_watchlist').select('id').eq('user_id', user.id).eq('anime_id', animeId).maybeSingle(),
            userAPI.getAnimeProgress(user.id, animeId),
          ]);
          if (cancelled) return;
          setIsFav(!!favRes.data);
          setInWatchlist(!!wlRes.data);
          if (progressRes.data) {
            const prog = progressRes.data as any;
            setResumeEpisodeId(prog.episode_id);
            setResumeProgress({ epNum: prog.episodes?.episode_number ?? 0, seconds: prog.progress_seconds ?? 0 });
          } else {
            setResumeEpisodeId(null);
            setResumeProgress(null);
          }
        }
      } catch (e) {
        console.error('[AnimeDetail] loadUserData error:', e);
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    };

    loadUserData();
    return () => { cancelled = true; };
  }, [animeId, user?.id]);

  // ── Optimistic toggle mutations (UI updates instantly, DB writes in background) ──
  const favMutation = useToggleFavorite({
    userId: user?.id ?? '',
    animeId,
  });
  const wlMutation = useToggleWatchlist({
    userId: user?.id ?? '',
    animeId,
  });

  const toggleFav = () => {
    if (!user) { router.push('/auth/login'); return; }
    const next = !isFav;
    setIsFav(next);
    favMutation.mutate(next);
  };

  const toggleWatchlist = () => {
    if (!user) { router.push('/auth/login'); return; }
    const next = !inWatchlist;
    setInWatchlist(next);
    wlMutation.mutate(next);
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
            contentFit="cover"
            transition={200}
          />
          <View style={styles.bannerOverlay} />

          {/* Back button */}
          <TouchableOpacity
            style={[styles.backBtn, { top: insets.top + SPACING.sm }]}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>

          {/* Trailer Button */}
          {anime.trailer_url ? (
            <TouchableOpacity
              style={[styles.trailerOverlayBtn, { top: insets.top + SPACING.sm }]}
              onPress={() => setTrailerVisible(true)}
            >
              <Ionicons name="play" size={14} color={COLORS.neon} />
              <Text style={styles.trailerOverlayText}>TRAILER</Text>
            </TouchableOpacity>
          ) : null}

          {/* Poster + basic info */}
          <View style={styles.posterRow}>
            <Image
              source={{ uri: anime.poster_url || '' }}
              style={styles.poster}
              contentFit="cover"
              transition={200}
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
                  {[1, 2, 3, 4, 5].map(i => (
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
              if (resumeEpisodeId) {
                // User has watch history — jump straight back in
                router.push(`/watch/${resumeEpisodeId}`);
              } else if (episodes.length > 0) {
                router.push(`/watch/${episodes[0].id}`);
              } else {
                router.push(`/anime/episodes/${animeId}?animeTitle=${encodeURIComponent(anime.title)}`);
              }
            }}
          >
            <Ionicons name={resumeEpisodeId ? 'play-skip-forward' : 'play'} size={18} color={COLORS.bg} />
            <View>
              <Text style={styles.playBigText}>
                {resumeEpisodeId ? 'CONTINUE WATCHING' : 'START WATCHING'}
              </Text>
              {resumeProgress && (
                <Text style={styles.playBigSub}>
                  EP {resumeProgress.epNum} • {Math.floor(resumeProgress.seconds / 60)}m watched
                </Text>
              )}
            </View>
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

        {/* Relations chronology */}
        {relations && relations.length > 0 ? (
          <RelationsShelf relations={relations} />
        ) : null}

        {/* Characters carousel */}
        {characters && characters.length > 0 ? (
          <CharactersShelf
            characters={characters}
            onCharacterPress={(char) => setSelectedCharacter(char)}
          />
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
          <EpisodesTab episodes={episodes} anime={anime} router={router} user={user} downloadedIds={downloadedIds} />
        )}
        {activeTab === 'reviews' && (
          <ReviewsTab reviews={reviews} anime={anime} router={router} user={user} />
        )}
        {activeTab === 'info' && (
          <InfoTab anime={anime} />
        )}
      </ScrollView>

      {trailerVisible && anime.trailer_url ? (
        <TrailerModal
          onClose={() => setTrailerVisible(false)}
          url={anime.trailer_url}
        />
      ) : null}

      {selectedCharacter ? (
        <CharacterModal
          visible={selectedCharacter !== null}
          onClose={() => setSelectedCharacter(null)}
          character={selectedCharacter}
        />
      ) : null}
    </View>
  );
}

const MetaBadge = React.memo(function MetaBadge({ label, color }: { label: string; color?: string }) {
  return (
    <View style={styles.metaBadge}>
      <Text style={[styles.metaBadgeText, color ? { color } : {}]}>{label}</Text>
    </View>
  );
});

const StatItem = React.memo(function StatItem({ icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={16} color={COLORS.neon} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

const EpisodesTab = React.memo(function EpisodesTab({ episodes, anime, router, user, downloadedIds }: any) {
  const isPremiumUser = user?.subscription_type === 'premium';
  return (
    <View style={styles.tabContent}>
      {episodes.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No episodes yet</Text>
        </View>
      ) : (
        <>
          {episodes.slice(0, 5).map((ep: Episode) => {
            const isDownloaded = downloadedIds?.has(ep.id);
            return (
              <View key={ep.id} style={styles.epRow}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}
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
                      {ep.duration ? `${Math.round(ep.duration / 60)}m` : ''}{ep.air_date ? ` • ${ep.air_date}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Right Actions: Download & Play */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  {isDownloaded ? (
                    <View style={styles.downloadedBadge}>
                      <Ionicons name="cloud-done" size={18} color={COLORS.neonCyan} />
                    </View>
                  ) : (
                    user?.subscription_type === 'premium' && (
                      <TouchableOpacity
                        onPress={() => {
                          router.push(`/watch/${ep.id}?animeTitle=${encodeURIComponent(anime.title)}&autoDownload=true`);
                        }}
                        style={styles.epDownloadBtn}
                      >
                        <Ionicons name="cloud-download-outline" size={18} color={COLORS.textSub} />
                      </TouchableOpacity>
                    )
                  )}

                  {ep.is_premium && user?.subscription_type !== 'premium' ? (
                    <Ionicons name="lock-closed" size={16} color={COLORS.neonGold} />
                  ) : (
                    <TouchableOpacity
                      onPress={() => {
                        router.push(`/watch/${ep.id}?animeTitle=${encodeURIComponent(anime.title)}`);
                      }}
                    >
                      <Ionicons name="play-circle-outline" size={22} color={COLORS.neon} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
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
});

const ReviewsTab = React.memo(function ReviewsTab({ reviews, anime, router, user }: any) {
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
});

const InfoTab = React.memo(function InfoTab({ anime }: { anime: AnimeWithStats }) {
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
});

function TrailerModal({ onClose, url }: { onClose: () => void; url: string }) {
  const onFullScreenChange = useCallback((isFullScreen: boolean) => {
    if (isFullScreen) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  }, []);

  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const videoId = useMemo(() => {
    if (!url) return '';
    let base = url.replace('youtube-nocookie.com', 'youtube.com');
    if (base.includes('youtube.com/watch')) {
      return base.split('v=')[1]?.split('&')[0] || '';
    } else if (base.includes('youtu.be/')) {
      return base.split('youtu.be/')[1]?.split('?')[0] || '';
    } else if (base.includes('youtube.com/embed/')) {
      return base.split('youtube.com/embed/')[1]?.split('?')[0] || '';
    }
    return '';
  }, [url]);

  const cardWidth = useMemo(() => width * 0.92, []);
  const videoHeight = useMemo(() => cardWidth * (9 / 16), [cardWidth]);

  return (
    <TouchableOpacity
      style={styles.trailerModalContainer}
      activeOpacity={1}
      onPress={onClose}
    >
      <TouchableWithoutFeedback>
        <View style={[styles.trailerVideoCard, { width: cardWidth }]}>
          <View style={styles.trailerHeader}>
            <Text style={styles.trailerHeaderTitle}>TRAILER PREVIEW</Text>
            <TouchableOpacity style={styles.closeTrailerBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {videoId ? (
            <YoutubePlayer
              height={videoHeight}
              play={true}
              videoId={videoId}
              webViewStyle={styles.trailerPlayer}
              webViewProps={{
                androidLayerType: 'hardware',
              }}
              onFullScreenChange={onFullScreenChange}
            />
          ) : (
            <View style={[styles.trailerPlayer, { height: videoHeight, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: '#fff' }}>Invalid Trailer URL</Text>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </TouchableOpacity>
  );
}

function CharacterModal({ visible, onClose, character }: { visible: boolean; onClose: () => void; character: Character | null }) {
  if (!character) return null;

  const isMain = character.role?.toLowerCase() === 'main';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.charModalContainer}>
        {/* Header Row */}
        <View style={styles.charModalHeader}>
          <TouchableOpacity style={styles.charModalBackBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.charModalTitle} numberOfLines={1}>
            {character.name}
          </Text>
          {character.role ? (
            <View style={[styles.charRoleBadge, isMain ? styles.charRoleBadgeMain : styles.charRoleBadgeSub]}>
              {isMain && (
                <Ionicons name="star" size={12} color={COLORS.bg} style={{ marginRight: 2 }} />
              )}
              <Text style={[styles.charRoleBadgeText, isMain ? { color: COLORS.bg } : { color: COLORS.textSub }]}>
                {character.role.toLowerCase()}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Content Scroll View */}
        <ScrollView contentContainerStyle={styles.charModalContent} showsVerticalScrollIndicator={false}>
          {/* Large Image */}
          {character.image_url ? (
            <View style={styles.charModalImageWrap}>
              <Image
                source={{ uri: character.image_url }}
                style={styles.charModalImage}
                contentFit="cover"
              />
            </View>
          ) : null}

          {/* Names Info */}
          <View style={styles.charModalSection}>
            <View style={styles.charModalSectionHeader}>
              <Ionicons name="person-outline" size={16} color={COLORS.neon} />
              <Text style={styles.charModalSectionTitle}>Names</Text>
            </View>
            <View style={styles.charInfoBox}>
              {character.name_japanese ? (
                <View style={styles.charInfoRow}>
                  <View style={styles.charJpBadge}>
                    <Text style={styles.charJpBadgeText}>JP</Text>
                  </View>
                  <Text style={styles.charInfoRowLabel}>Japanese:</Text>
                  <Text style={styles.charInfoRowValue}>{character.name_japanese}</Text>
                </View>
              ) : null}
              {character.name_romaji ? (
                <View style={styles.charInfoRow}>
                  <View style={styles.charAbcBadge}>
                    <Text style={styles.charAbcBadgeText}>abc</Text>
                  </View>
                  <Text style={styles.charInfoRowLabel}>Romaji:</Text>
                  <Text style={styles.charInfoRowValue}>{character.name_romaji}</Text>
                </View>
              ) : null}
              {character.voice_actor ? (
                <View style={styles.charInfoRow}>
                  <Ionicons name="mic-outline" size={14} color={COLORS.neonGold} style={{ marginRight: 4 }} />
                  <Text style={styles.charInfoRowLabel}>Voice Actor:</Text>
                  <Text style={styles.charInfoRowValue}>{character.voice_actor}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Description Section */}
          {character.description ? (
            <View style={styles.charModalSection}>
              <View style={styles.charModalSectionHeader}>
                <Ionicons name="chatbubble-outline" size={16} color={COLORS.neon} />
                <Text style={styles.charModalSectionTitle}>Description</Text>
              </View>
              <View style={styles.charDescBox}>
                <Text style={styles.charDescText}>{character.description}</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* Close Button at Bottom */}
        <View style={styles.charModalFooter}>
          <TouchableOpacity style={styles.charModalCloseBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close-circle" size={18} color={COLORS.bg} />
            <Text style={styles.charModalCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const RelationsShelf = React.memo(function RelationsShelf({ relations }: { relations: RelatedAnime[] }) {
  const router = useRouter();
  return (
    <View style={styles.shelfContainer}>
      <Text style={styles.shelfTitle}>// SERIES CHRONOLOGY</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfScroll}>
        {relations.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.relationCard}
            onPress={() => router.push(`/anime/${item.id}`)}
          >
            <Image
              source={{ uri: item.poster_url || '' }}
              style={styles.relationPoster}
              contentFit="cover"
              transition={150}
            />
            <View style={styles.relationBadge}>
              <Text style={styles.relationBadgeText}>
                {item.relation_type.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.relationText} numberOfLines={1}>
              {item.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});

const CharactersShelf = React.memo(function CharactersShelf({
  characters,
  onCharacterPress,
}: {
  characters: Character[];
  onCharacterPress: (char: Character) => void;
}) {
  return (
    <View style={styles.shelfContainer}>
      <Text style={styles.shelfTitle}>// CHARACTERS & VOICE ACTORS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelfScroll}>
        {characters.map((char) => (
          <TouchableOpacity
            key={char.id}
            style={styles.charCard}
            onPress={() => onCharacterPress(char)}
            activeOpacity={0.7}
          >
            <View style={styles.charAvatarWrap}>
              <Image
                source={{ uri: char.image_url || '' }}
                style={styles.charAvatar}
                contentFit="cover"
              />
            </View>
            <Text style={styles.charName} numberOfLines={1}>{char.name}</Text>
            <Text style={styles.charRole}>{char.role}</Text>
            {char.voice_actor ? (
              <Text style={styles.vaName} numberOfLines={1}>{char.voice_actor}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
});

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
  playBigSub: { color: COLORS.bg, fontWeight: '500', fontSize: 10, opacity: 0.75, marginTop: 1 },
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
  downloadedBadge: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  epDownloadBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Trailer styles
  trailerOverlayBtn: {
    position: 'absolute',
    right: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.bgGlass,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    height: 38,
    justifyContent: 'center',
  },
  trailerOverlayText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  trailerModalContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  trailerVideoCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: COLORS.neonCyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  trailerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  trailerHeaderTitle: {
    fontSize: 11,
    color: COLORS.neonCyan,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  closeTrailerBtn: {
    padding: SPACING.xs,
  },
  trailerPlayer: {
    backgroundColor: '#000',
    width: '100%',
  },

  // Shelves styles
  shelfContainer: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  shelfTitle: {
    fontSize: 11,
    color: COLORS.neon,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  shelfScroll: {
    gap: SPACING.sm,
    paddingBottom: SPACING.xs,
  },

  // Relation Card
  relationCard: {
    width: 90,
    position: 'relative',
    gap: SPACING.xs,
  },
  relationPoster: {
    width: 90,
    height: 130,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  relationBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(8, 8, 16, 0.85)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  relationBadgeText: {
    fontSize: 8,
    color: COLORS.neonCyan,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  relationText: {
    fontSize: 11,
    color: COLORS.textSub,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Character Card
  charCard: {
    width: 80,
    alignItems: 'center',
    gap: 2,
  },
  charAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 4,
  },
  charAvatar: {
    width: '100%',
    height: '100%',
  },
  charName: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  charRole: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  vaName: {
    fontSize: 9,
    color: COLORS.neonCyan,
    textAlign: 'center',
    opacity: 0.8,
  },

  // Character Modal styles
  charModalContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  charModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: 50,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  charModalBackBtn: {
    padding: SPACING.xs,
  },
  charModalTitle: {
    fontSize: 20,
    color: COLORS.neonCyan,
    fontWeight: '800',
    flex: 1,
    marginLeft: SPACING.md,
  },
  charRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  charRoleBadgeMain: {
    backgroundColor: COLORS.neonGold,
  },
  charRoleBadgeSub: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  charRoleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  charModalContent: {
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.lg,
    paddingBottom: 40,
  },
  charModalImageWrap: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.border,
    marginTop: SPACING.sm,
  },
  charModalImage: {
    width: '100%',
    height: '100%',
  },
  charModalSection: {
    width: '100%',
    gap: SPACING.sm,
  },
  charModalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  charModalSectionTitle: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '800',
    letterSpacing: 1,
  },
  charInfoBox: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  charInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  charInfoRowLabel: {
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: '700',
    marginRight: 6,
  },
  charJpBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  charJpBadgeText: {
    fontSize: 9,
    color: COLORS.success,
    fontWeight: '800',
  },
  charAbcBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: COLORS.neonCyan,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  charAbcBadgeText: {
    fontSize: 9,
    color: COLORS.neonCyan,
    fontWeight: '800',
  },
  charInfoRowValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
  },
  charDescBox: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  charDescText: {
    fontSize: 13,
    color: COLORS.textSub,
    lineHeight: 20,
  },
  charModalFooter: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  charModalCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.neonCyan,
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
  },
  charModalCloseBtnText: {
    fontSize: 14,
    color: COLORS.bg,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
