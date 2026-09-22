import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
  Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, TOUCH } from '../../src/constants/theme';
import { useAuth } from '../../src/context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { userAPI } from '../../src/lib/supabase';
import { haptic } from '../../src/lib/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../src/lib/supabase';
import { useTranslation } from '../../src/context/LocalizationContext';
import { BADGE_DEFS } from '../../src/constants/badges';
import SectionHeader from '../../src/components/ui/SectionHeader';
import {
  computeGenres,
  computeStreak,
  relativeTime,
  getLocalizedRelativeTime,
  GENRE_COLORS,
} from '../../src/lib/userStats';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut, refreshUser } = useAuth();
  const userId = user?.id;
  const { t, locale } = useTranslation();

  const getLocaleTag = (loc: string) => {
    if (loc === 'ja') return 'ja-JP';
    return 'en-US';
  };

  // ── TanStack Query — shared cache with Library / History screens ────────────
  // IMPORTANT: queryFn must be identical to library.tsx so both screens share
  // the same ['user', userId, 'history'] cache entry. If they diverge, one
  // screen will always re-fetch on mount even though the data is fresh.
  const { data: allProgress = [], isLoading: loadingProgress } = useQuery({
    queryKey: ['user', userId, 'history'],
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await userAPI.getProgress(userId!);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: watchlistRaw = [], isLoading: loadingWatchlist } = useQuery({
    queryKey: ['user', userId, 'watchlist'],
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await userAPI.getWatchlist(userId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: favoritesRaw = [], isLoading: loadingFavorites } = useQuery({
    queryKey: ['user', userId, 'favorites'],
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await userAPI.getFavorites(userId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const loading = loadingProgress || loadingWatchlist || loadingFavorites;
  const watchlist = useMemo(() => watchlistRaw.map((item: any) => item.anime).filter(Boolean), [watchlistRaw]);
  const favorites = useMemo(() => favoritesRaw.map((item: any) => item.anime).filter(Boolean), [favoritesRaw]);
  const recentActivity = useMemo(() => allProgress.slice(0, 3), [allProgress]);

  // Bio: prefer Supabase profile (persisted across devices), fall back to AsyncStorage
  const [bio, setBio] = useState('');
  useEffect(() => {
    if (!userId) return;
    // Check Supabase profile first, fall back to local cache
    if (user?.bio) {
      setBio(user.bio);
    } else {
      AsyncStorage.getItem(`user_bio_${userId}`).then(cached => {
        if (cached) setBio(cached);
      });
    }
  }, [userId, user?.bio]);

  // Edit profile modal state
  const [editVisible, setEditVisible] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'checking' | 'available' | 'taken' | 'invalid' | 'current' | null>(null);

  // Debounced username availability checker
  useEffect(() => {
    let isCurrent = true;

    if (!editVisible) {
      setUsernameStatus(null);
      return;
    }

    const trimmed = editUsername.trim();
    if (!trimmed) {
      setUsernameStatus(null);
      return;
    }

    if (trimmed === user?.username) {
      setUsernameStatus('current');
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(trimmed)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');

    const delayDebounceFn = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('username')
          .eq('username', trimmed)
          .maybeSingle();

        if (error) throw error;

        if (isCurrent) {
          if (data) {
            setUsernameStatus('taken');
          } else {
            setUsernameStatus('available');
          }
        }
      } catch (err) {
        console.error('Error checking username availability:', err);
        if (isCurrent) {
          setUsernameStatus(null);
        }
      }
    }, 500);

    return () => {
      isCurrent = false;
      clearTimeout(delayDebounceFn);
    };
  }, [editUsername, editVisible, user?.username]);

  const renderUsernameStatus = () => {
    if (!usernameStatus) return null;
    
    let text = '';
    let color = COLORS.textMuted;
    let icon: keyof typeof Ionicons.glyphMap = 'information-circle-outline';
    
    switch (usernameStatus) {
      case 'checking':
        text = t('checkingAvailability');
        color = COLORS.neonGold;
        icon = 'sync-outline';
        break;
      case 'available':
        text = t('usernameAvailable');
        color = COLORS.success || '#00F5B4';
        icon = 'checkmark-circle-outline';
        break;
      case 'taken':
        text = t('usernameTaken');
        color = COLORS.danger || '#FF2D78';
        icon = 'close-circle-outline';
        break;
      case 'invalid':
        text = t('usernameInvalid');
        color = COLORS.danger || '#FF2D78';
        icon = 'alert-circle-outline';
        break;
      case 'current':
        text = t('currentUsername');
        color = COLORS.neonCyan || '#00F5FF';
        icon = 'checkmark-done-circle-outline';
        break;
    }

    return (
      <View style={styles.statusRow}>
        <Ionicons name={icon} size={14} color={color} />
        <Text style={[styles.statusText, { color }]}>
          {text}
        </Text>
      </View>
    );
  };

  // ── Derived values — only recompute when dependencies change ─────────────────
  const streak    = useMemo(() => computeStreak(allProgress), [allProgress]);
  const genreStats = useMemo(() => computeGenres(allProgress), [allProgress]);
  const badges    = useMemo(
    () => BADGE_DEFS.map(b => ({
      ...b,
      earned: b.check(allProgress, streak, watchlist),
      progress: b.progress(allProgress, streak, watchlist),
    })),
    [allProgress, streak, watchlist]
  );

  const openEdit = useCallback(() => {
    haptic.selection();
    setEditUsername(user?.username || '');
    setEditBio(bio);
    setEditVisible(true);
  }, [user, bio]);

  const saveEdit = async () => {
    if (!user || !editUsername.trim()) return;

    // 1. Frontend validation: Length & Characters check
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(editUsername.trim())) {
      Alert.alert(
        t('invalidUsernameTitle'),
        t('invalidUsernameMsg')
      );
      return;
    }

    haptic.medium();
    setEditSaving(true);

    // 1. Save bio to Supabase (bio column) + AsyncStorage in parallel
    // The Supabase save may silently fail if the bio column doesn't exist yet — that's OK.
    const [{ error }] = await Promise.all([
      userAPI.updateProfile(user.id, {
        username: editUsername.trim(),
        bio: editBio.trim() as any,
      }),
      AsyncStorage.setItem(`user_bio_${user.id}`, editBio.trim()),
    ]);

    setEditSaving(false);

    if (error) {
      const errMsg = (error as any)?.message || '';
      // 2. Intercept unique constraint violation errors from PostgreSQL
      if (
        errMsg.toLowerCase().includes('duplicate key') ||
        errMsg.toLowerCase().includes('already exists') ||
        (error as any)?.code === '23505'
      ) {
        Alert.alert(
          t('usernameTakenTitle'),
          t('usernameTakenMsg')
        );
      } else {
        Alert.alert(t('error'), t('profileUpdateError', { error: errMsg || 'Unknown error' }));
      }
    } else {
      // Success — RLS didn't block the update
      setBio(editBio.trim());
      setEditVisible(false);
      await refreshUser();
    }
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.guestIcon}>
          <Ionicons name="person-outline" size={40} color={COLORS.neon} />
        </View>
        <Text style={styles.guestTitle}>{t('notSignedIn')}</Text>
        <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/auth/login')}>
          <Text style={styles.signInText}>{t('signIn')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Removed blocking combined 'loading' gate — hero renders immediately.
  // Each section shows its own skeleton/spinner independently.

  const handleSignOut = () => {
    Alert.alert(t('signOutTitle'), t('signOutSub'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logOut'), style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 120, paddingTop: 16 }}
    >


      {/* Hero Profile Section */}
      <View style={styles.heroSection}>
        <View style={styles.avatarGlowContainer}>
          <View style={styles.avatarGlow} />
          <Image 
            source={{ uri: user.avatar_url || 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?q=80&w=200&auto=format&fit=crop' }} 
            style={styles.heroAvatar} 
          />
        </View>
        
        <View style={styles.heroInfo}>
          <Text style={styles.heroName} numberOfLines={1}>{user.username}</Text>
          <View style={[
            styles.premiumBadge,
            user.subscription_type === 'premium' && styles.premiumBadgeActive,
          ]}>
            <Ionicons
              name={user.subscription_type === 'premium' ? 'ribbon' : 'person'}
              size={10}
              color={user.subscription_type === 'premium' ? COLORS.neonGold : COLORS.textSub}
              style={{ marginRight: 4 }}
            />
            <Text style={[
              styles.premiumBadgeText,
              user.subscription_type === 'premium' && { color: COLORS.neonGold },
            ]}>
              {user.subscription_type === 'premium' ? t('premiumMember') : t('freePlan')}
            </Text>
          </View>
          <Text style={styles.heroBio}>
            {bio || `@${user.username} · ${t('animeFan')}`}
          </Text>
          
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.editBtn} onPress={openEdit} activeOpacity={0.85} accessibilityRole="button">
              <LinearGradient 
                colors={[COLORS.neon, COLORS.primaryDark]} 
                start={{x:0, y:0}} end={{x:1, y:1}} 
                style={styles.gradientBtn}
              >
                <Text style={styles.editBtnText}>{t('editProfile')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                haptic.selection();
                router.push('/settings');
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryBtnText}>{t('settings')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Inline Stats Strip — visible immediately, no blocking */}
      <View style={styles.section}>
        <View style={styles.inlineStatsRow}>
          <View style={styles.inlineStatItem}>
            <Text style={[styles.inlineStatValue, { color: COLORS.neonCyan }]}>
              {loadingProgress ? '…' : allProgress.length}
            </Text>
            <Text style={styles.inlineStatLabel}>EPISODES</Text>
          </View>
          <View style={styles.inlineStatDivider} />
          <View style={styles.inlineStatItem}>
            <Text style={[styles.inlineStatValue, { color: COLORS.neonGold }]}>
              {loadingWatchlist ? '…' : watchlist.length}
            </Text>
            <Text style={styles.inlineStatLabel}>WATCHLIST</Text>
          </View>
          <View style={styles.inlineStatDivider} />
          <View style={styles.inlineStatItem}>
            <Text style={[styles.inlineStatValue, { color: COLORS.neon }]}>
              {loadingFavorites ? '…' : favorites.length}
            </Text>
            <Text style={styles.inlineStatLabel}>FAVORITES</Text>
          </View>
          <View style={styles.inlineStatDivider} />
          <View style={styles.inlineStatItem}>
            <Text style={[styles.inlineStatValue, { color: COLORS.neonPink || COLORS.neon }]}>
              {streak > 0 ? `🔥${streak}` : '0'}
            </Text>
            <Text style={styles.inlineStatLabel}>STREAK</Text>
          </View>
        </View>
      </View>

      {/* Stats Shortcut Card */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.statsCard} onPress={() => router.push('/stats' as any)} activeOpacity={0.8}>
          <View style={styles.statsCardLeft}>
            <View style={styles.statsCardIconWrap}>
              <Ionicons name="stats-chart" size={22} color={COLORS.neon} />
            </View>
            <View>
              <Text style={styles.statsCardTitle}>{t('myStats')}</Text>
              <Text style={styles.statsCardSub}>{t('statsSubtitle')}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Watchlist Section */}
      <View style={styles.section}>
        <SectionHeader
          title={t('myWatchlist')}
          onSeeAll={() => router.push('/watchlist')}
          seeAllLabel={t('viewAll')}
        />
        {watchlist.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {watchlist.map(anime => (
              <TouchableOpacity key={anime.id} style={styles.animePosterCard} onPress={() => router.push(`/anime/${anime.id}`)}>
                <Image source={{ uri: anime.poster_url }} style={styles.animePoster} />
                <BlurView intensity={30} style={styles.posterOverlay}>
                  <Text style={styles.posterTitle} numberOfLines={1}>{anime.title}</Text>
                  <View style={styles.posterRating}>
                    <Ionicons name="star" size={10} color={COLORS.neonGold} />
                    <Text style={styles.posterRatingText}>{(anime.user_rating_avg ?? anime.rating) ? Number(anime.user_rating_avg ?? anime.rating).toFixed(1) : 'N/A'}</Text>
                  </View>
                </BlurView>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : loadingWatchlist ? (
          <ActivityIndicator color={COLORS.neon} style={{ marginVertical: 24 }} />
        ) : (
          <BlurView intensity={10} style={styles.emptyCard}>
            <Ionicons name="list" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('watchlistEmpty')}</Text>
            <TouchableOpacity
              style={styles.emptyCtaBtn}
              onPress={() => router.push('/(tabs)/explore')}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyCtaText}>BROWSE ANIME →</Text>
            </TouchableOpacity>
          </BlurView>
        )}
      </View>

      {/* Favorites Section */}
      <View style={styles.section}>
        <SectionHeader
          title={t('topFavorites')}
          onSeeAll={() => router.push('/favorites')}
          seeAllLabel={t('viewAll')}
        />
        {favorites.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {favorites.map(anime => (
              <TouchableOpacity key={anime.id} style={styles.animePosterCard} onPress={() => router.push(`/anime/${anime.id}`)}>
                <Image source={{ uri: anime.poster_url }} style={styles.animePoster} />
                <BlurView intensity={30} style={styles.posterOverlay}>
                  <Text style={styles.posterTitle} numberOfLines={1}>{anime.title}</Text>
                </BlurView>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : loadingFavorites ? (
          <ActivityIndicator color={COLORS.neon} style={{ marginVertical: 24 }} />
        ) : (
          <BlurView intensity={10} style={styles.emptyCard}>
            <Ionicons name="heart-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('favoritesEmpty')}</Text>
            <TouchableOpacity
              style={styles.emptyCtaBtn}
              onPress={() => router.push('/(tabs)/explore')}
              activeOpacity={0.8}
            >
              <Text style={styles.emptyCtaText}>DISCOVER ANIME →</Text>
            </TouchableOpacity>
          </BlurView>
        )}
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <SectionHeader
          title={t('recentActivity')}
          onSeeAll={() => router.push('/history')}
          seeAllLabel={t('viewAll')}
        />
        <View style={styles.activityList}>
          {recentActivity.length === 0 ? (
            loadingProgress ? (
              <ActivityIndicator color={COLORS.neon} style={{ marginVertical: 24 }} />
            ) : (
            <BlurView intensity={10} style={styles.emptyCard}>
              <Ionicons name="time-outline" size={32} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>{t('historyEmpty')}</Text>
              <TouchableOpacity
                style={styles.emptyCtaBtn}
                onPress={() => router.push('/(tabs)/explore')}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyCtaText}>START WATCHING →</Text>
              </TouchableOpacity>
            </BlurView>
            )
          ) : (
            recentActivity.map((activity, idx) => (
              <ActivityItem
                key={activity.progress_id || activity.episode_id || idx}
                poster={activity.poster_url || activity.anime_poster_url}
                title={activity.anime_title}
                episode={activity.episode_number}
                progress={activity.progress_percentage || activity.progress_percent || 0}
                time={activity.last_watched ? getLocalizedRelativeTime(activity.last_watched, locale) : ''}
                onPress={() => router.push(`/anime/${activity.anime_id}`)}
              />
            ))
          )}
        </View>
      </View>


      {/* Account Info Card */}
      <View style={styles.section}>
        <Text style={[styles.gridSectionTitle, { marginBottom: 14 }]}>{t('accountInfo')}</Text>
        <View style={styles.accountCard}>
          <View style={styles.accountRow}>
            <View style={styles.accountRowIcon}>
              <Ionicons name="mail-outline" size={16} color={COLORS.neonCyan} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountRowLabel}>{t('email')}</Text>
              <Text style={styles.accountRowValue} numberOfLines={1}>{user.email}</Text>
            </View>
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountRow}>
            <View style={styles.accountRowIcon}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.neonPulse} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountRowLabel}>{t('memberSince')}</Text>
              <Text style={styles.accountRowValue}>
                {user.created_at ? new Date(user.created_at).toLocaleDateString(getLocaleTag(locale), { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
              </Text>
            </View>
          </View>
          <View style={styles.accountDivider} />
          <View style={styles.accountRow}>
            <View style={styles.accountRowIcon}>
              <Ionicons name={user.subscription_type === 'premium' ? 'ribbon' : 'person-outline'} size={16} color={user.subscription_type === 'premium' ? COLORS.neonGold : COLORS.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountRowLabel}>{t('plan')}</Text>
              <Text style={[styles.accountRowValue, user.subscription_type === 'premium' && { color: COLORS.neonGold }]}>
                {user.subscription_type === 'premium' ? t('premium') : t('free')}
              </Text>
            </View>
            {user.subscription_type !== 'premium' ? (
              <TouchableOpacity style={styles.upgradePill} onPress={() => router.push('/plans')}>
                <Text style={styles.upgradePillText}>{t('upgrade')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.upgradePill, { backgroundColor: 'rgba(255,214,0,0.12)', borderColor: 'rgba(255,214,0,0.35)' }]}
                onPress={() => router.push('/manage-plan' as any)}
              >
                <Text style={[styles.upgradePillText, { color: COLORS.neonGold }]}>Manage</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
        <Text style={styles.signOutText}>{t('signOut')}</Text>
      </TouchableOpacity>

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setEditVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('editProfile')}</Text>
            <Text style={styles.modalLabel}>{t('usernameLabel')}</Text>
            <TextInput
              style={styles.modalInput}
              value={editUsername}
              onChangeText={setEditUsername}
              placeholder={t('enterUsername')}
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              maxLength={30}
            />
            {renderUsernameStatus()}
            <Text style={styles.modalLabel}>{t('bioLabel')}</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder={t('tellPeopleBio')}
              placeholderTextColor={COLORS.textMuted}
              multiline
              maxLength={150}
            />
            <TouchableOpacity
              style={[
                styles.modalSaveBtn,
                (usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking' || editSaving) && { opacity: 0.5 }
              ]}
              onPress={saveEdit}
              disabled={usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking' || editSaving}
              activeOpacity={0.88}
              accessibilityRole="button"
            >
              <LinearGradient colors={[COLORS.neon, COLORS.primaryDark]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.modalSaveGradient}>
                {editSaving
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={styles.modalSaveText}>{t('saveChanges')}</Text>
                }
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

function StatTile({ value, label, color, isStreak }: any) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statValueRow}>
        {isStreak && <Ionicons name="flash" size={18} color={color} style={{ marginRight: 4 }} />}
        <Text style={[styles.statTileValue, { color }]}>{value}</Text>
      </View>
      <Text style={styles.statTileLabel}>{label}</Text>
    </View>
  );
}

function ActivityItem({ poster, title, episode, progress, time, onPress }: any) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={styles.activityItem} onPress={onPress} activeOpacity={0.8}>
      <Image source={{ uri: poster || 'https://via.placeholder.com/100x150' }} style={styles.activityPoster} />
      <View style={styles.activityInfo}>
        <View style={styles.activityHeader}>
          <Text style={styles.activityTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.activityTime}>{time}</Text>
        </View>
        <Text style={styles.activitySub}>{t('episodeNumber', { number: episode })}</Text>
        <View style={styles.activityProgressContainer}>
          <View style={styles.activityProgressLine}>
            <View style={[styles.activityProgressFill, { width: `${Math.min(progress, 100)}%` }]} />
          </View>
          <Text style={styles.activityProgressText}>{Math.round(progress)}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function formatWatchTime(seconds: number = 0) {
  const hours = Math.floor(seconds / 3600);
  return hours.toLocaleString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },

  heroSection: {
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  avatarGlowContainer: {
    position: 'relative',
    marginBottom: SPACING.lg,
  },
  avatarGlow: {
    position: 'absolute',
    top: -10, left: -10, right: -10, bottom: -10,
    borderRadius: 100,
    backgroundColor: COLORS.neon,
    opacity: 0.15,
    transform: [{ scale: 1.1 }],
  },
  heroAvatar: {
    width: 130, height: 130,
    borderRadius: 65,
    borderWidth: 3, borderColor: COLORS.neon,
  },
  heroInfo: { alignItems: 'center', width: '100%' },
  heroName: { fontSize: 28, fontWeight: '900', color: COLORS.text, letterSpacing: -1, marginBottom: 6 },
  premiumBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: 'rgba(0,227,253,0.08)',
    borderRadius: 100,
    borderWidth: 1, borderColor: 'rgba(0,227,253,0.2)',
    marginBottom: 10,
  },
  premiumBadgeActive: {
    backgroundColor: 'rgba(255,214,0,0.08)',
    borderColor: 'rgba(255,214,0,0.3)',
  },
  premiumBadgeText: { fontSize: 8, fontWeight: '800', color: COLORS.neonCyan, letterSpacing: 2 },
  heroBio: { color: COLORS.textSub, textAlign: 'center', fontSize: 13, lineHeight: 20, paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg },
  
  heroActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  editBtn: { borderRadius: 100, overflow: 'hidden' },
  gradientBtn: { paddingHorizontal: 24, paddingVertical: 12 },
  editBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  secondaryBtn: {
    paddingHorizontal: 20, paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 100,
    borderWidth: 1, borderColor: COLORS.borderNeutral,
  },
  secondaryBtnText: { color: COLORS.text, fontWeight: '700', fontSize: 13 },

  statsCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg,
    padding: 18, borderWidth: 1, borderColor: 'rgba(0,245,255,0.15)',
  },

  // Inline stat strip
  inlineStatsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 16,
  },
  inlineStatItem: { flex: 1, alignItems: 'center', gap: 4 },
  inlineStatValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  inlineStatLabel: { fontSize: 8, color: COLORS.textMuted, fontWeight: '800', letterSpacing: 1.5 },
  inlineStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 4 },

  // Empty state CTA
  emptyCtaBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,43,60,0.12)',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,43,60,0.35)',
  },
  emptyCtaText: {
    fontSize: 10,
    color: COLORS.neon,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  statsCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  statsCardIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(0,245,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(0,245,255,0.2)',
  },
  statsCardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  statsCardSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  section: { paddingHorizontal: SPACING.md, marginBottom: SPACING.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: SPACING.md },
  sectionTitle: { fontSize: 20, color: COLORS.text, fontWeight: '900', letterSpacing: -0.5 },
  seeAllText: { fontSize: 10, color: COLORS.neonCyan, fontWeight: '800', letterSpacing: 1 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statTile: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.bgElevated,
    padding: 20, borderRadius: RADIUS.lg,
    alignItems: 'center', gap: 6,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'center' },
  statTileValue: { fontSize: 28, fontWeight: '900', fontStyle: 'italic' },
  statTileLabel: { fontSize: 9, color: COLORS.textSub, fontWeight: '800', letterSpacing: 1.5 },

  streakCard: {
    padding: 24, borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(25,25,29,0.4)',
    overflow: 'hidden',
  },
  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  streakTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  streakSub: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  streakProgressContainer: { gap: 12 },
  streakProgressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 9, fontWeight: '800', color: COLORS.neonCyan, letterSpacing: 1 },
  progressBarBg: { height: 10, backgroundColor: COLORS.bgCard, borderRadius: 10 },
  progressBarFill: { height: '100%', borderRadius: 10 },
  streakLevels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  levelLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600' },

  activityList: { gap: 12 },
  activityItem: {
    flexDirection: 'row', gap: 16, padding: 12,
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg,
  },
  activityPoster: { width: 50, height: 75, borderRadius: 8 },
  activityInfo: { flex: 1, gap: 4 },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  activityTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text, flex: 1 },
  activityTime: { fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase', flexShrink: 0 },
  activitySub: { fontSize: 13, color: COLORS.textSub },
  activityProgressContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  activityProgressLine: { flex: 1, height: 3, backgroundColor: COLORS.bgCard, borderRadius: 2 },
  activityProgressFill: { height: '100%', backgroundColor: COLORS.neon, borderRadius: 2 },
  activityProgressText: { fontSize: 9, fontWeight: '800', color: COLORS.neon },

  activityItemBadge: {
    flexDirection: 'row', gap: 16, padding: 12,
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.lg, alignItems: 'center',
  },
  badgeActivityIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,115,70,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,115,70,0.2)',
  },

  gridContainer: { paddingHorizontal: SPACING.md, flexDirection: 'column', gap: SPACING.lg, marginBottom: SPACING.xl },
  gridSectionTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text, marginBottom: 16 },
  badgeSection: { 
    padding: 20, backgroundColor: COLORS.bgElevated, 
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: 'rgba(72,71,75,0.1)' 
  },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'space-between' },
  badgeItem: { alignItems: 'center', gap: 6, width: '28%' },
  badgeIconBox: {
    width: 44, height: 44, backgroundColor: 'rgba(255,43,60,0.1)',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,43,60,0.2)',
  },
  lockedBadge: { opacity: 0.3, backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'transparent' },
  badgeName: { fontSize: 8, fontWeight: '800', color: COLORS.textSub, letterSpacing: 1 },

  genreSection: { 
    padding: 20, backgroundColor: COLORS.bgElevated, 
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: 'rgba(72,71,75,0.1)' 
  },
  genreList: { gap: 15 },
  genreItem: { gap: 8 },
  genreLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  genreNameLabel: { fontSize: 10, fontWeight: '800', color: COLORS.text, textTransform: 'uppercase' },
  genreValue: { fontSize: 10, fontWeight: '800', color: COLORS.textSub },
  genreEmpty: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic', marginTop: 4 },
  genreBarBg: { height: 4, backgroundColor: COLORS.bgCard, borderRadius: 2 },
  genreBarFill: { height: '100%', borderRadius: 2 },

  friendsContainer: {
    padding: 16, backgroundColor: COLORS.bgElevated, 
    borderRadius: RADIUS.lg, borderLeftWidth: 4, borderLeftColor: COLORS.neonCyan,
  },
  friendStack: { flexDirection: 'row' },
  friendAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: COLORS.bgElevated },
  friendPlus: { backgroundColor: '#25252A', alignItems: 'center', justifyContent: 'center' },
  friendPlusText: { fontSize: 9, fontWeight: '800', color: COLORS.textSub },

  // Account Info Card
  accountCard: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  accountRowIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  accountRowLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  accountRowValue: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  accountDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginHorizontal: 16 },
  upgradePill: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: COLORS.neon,
    borderRadius: 100,
  },
  upgradePillText: { fontSize: 9, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginHorizontal: SPACING.md, marginTop: 8, paddingVertical: 16,
    borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,45,120,0.25)',
    backgroundColor: 'rgba(255,45,120,0.05)',
  },
  signOutText: { color: COLORS.danger, fontWeight: '900', fontSize: 13, letterSpacing: 2 },

  guestIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,43,60,0.1)', alignItems: 'center', justifyContent: 'center' },
  guestTitle: { color: COLORS.text, fontWeight: '900', letterSpacing: 2, marginTop: 10 },
  signInBtn: { paddingHorizontal: 32, paddingVertical: 12, backgroundColor: COLORS.neon, borderRadius: 100, marginTop: 20 },
  signInText: { color: '#FFFFFF', fontWeight: '900' },

  // Edit modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: COLORS.bgElevated,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingBottom: 48,
    borderTopWidth: 1, borderColor: COLORS.border,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginBottom: 24 },
  modalLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  modalInput: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, paddingVertical: 14,
    color: COLORS.text, fontSize: 16, fontWeight: '600',
    marginBottom: 24,
  },
  modalSaveBtn: { borderRadius: 100, overflow: 'hidden' },
  modalSaveGradient: { paddingVertical: 16, alignItems: 'center' },
  modalSaveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -16, marginBottom: 20, marginLeft: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  horizontalList: { gap: 16, paddingRight: SPACING.md },
  animePosterCard: {
    width: 130, height: 180,
    borderRadius: RADIUS.md, overflow: 'hidden',
    backgroundColor: COLORS.bgCard,
    borderWidth: 1, borderColor: COLORS.borderNeutral,
  },
  animePoster: { width: '100%', height: '100%' },
  posterOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 8, gap: 2,
  },
  posterTitle: { fontSize: 11, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  posterRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  posterRatingText: { fontSize: 9, fontWeight: '800', color: COLORS.neonGold },

  emptyCard: {
    padding: 30, borderRadius: RADIUS.md, alignItems: 'center', gap: 10,
    borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.borderNeutral,
  },
  emptyText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
});
