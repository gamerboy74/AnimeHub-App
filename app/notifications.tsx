import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeOutLeft } from 'react-native-reanimated';
import { COLORS, SPACING, RADIUS, FONTS, TOUCH } from '../src/constants/theme';
import { userAPI, Notification, supabase } from '../src/lib/supabase';
import { useUserId } from '../src/context/AuthContext';
import { haptic } from '../src/lib/haptics';
import { useQueryClient } from '@tanstack/react-query';

const PAGE_SIZE = 25;
const APP_LOGO = require('../assets/icon.png');

// Global in-memory cache for anime posters across component mounts
const posterCache = new Map<string, string>();
const inFlightPosterIds = new Set<string>();

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const dateMs = new Date(dateString).getTime();
  const diffMs = now - dateMs;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const notifIcon = (type: string) => {
  switch (type) {
    case 'episode': return 'play';
    case 'new_anime': return 'tv';
    case 'review': return 'chatbubble-ellipses';
    case 'system': return 'shield-checkmark';
    default: return 'notifications';
  }
};

const notifColor = (type: string) => {
  switch (type) {
    case 'episode': return COLORS.neonCyan;
    case 'new_anime': return COLORS.neon;
    case 'review': return COLORS.neonPink;
    case 'system': return COLORS.neonGold;
    default: return COLORS.accent;
  }
};

/**
 * Extracts target entity ID from notification data or action_url
 */
function extractNotificationEntityId(notification: any): string | null {
  if (!notification) return null;
  let dataObj = notification.data;
  if (typeof dataObj === 'string') {
    try {
      dataObj = JSON.parse(dataObj);
    } catch {
      dataObj = null;
    }
  }
  if (dataObj?.anime_id) return String(dataObj.anime_id);
  if (dataObj?.episode_id) return String(dataObj.episode_id);
  if (notification.action_url) {
    const match = notification.action_url.match(/\/(?:anime|watch)\/([a-zA-Z0-9-]+)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extracts embedded poster directly from notification payload if available
 */
function extractEmbeddedPoster(notification: any): string | null {
  if (!notification) return null;
  let dataObj = notification.data;
  if (typeof dataObj === 'string') {
    try {
      dataObj = JSON.parse(dataObj);
    } catch {
      dataObj = null;
    }
  }
  if (dataObj?.poster_url && typeof dataObj.poster_url === 'string') {
    return dataObj.poster_url;
  }
  if (dataObj?.thumbnail_url && typeof dataObj.thumbnail_url === 'string') {
    return dataObj.thumbnail_url;
  }
  return null;
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'releases', label: 'Episodes' },
  { id: 'simulcast', label: 'Simulcast' },
  { id: 'system', label: 'VIP' },
  { id: 'community', label: 'Social' },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const queryClient = useQueryClient();

  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread' | 'releases' | 'simulcast' | 'community' | 'system'>('all');

  // Incremented whenever posterCache gets new entries to trigger re-renders of cards
  const [, setPosterVersion] = useState(0);

  // Tracks IDs already processed to avoid redundant resolution
  const resolvedIdsRef = useRef(new Set<string>());

  /**
   * High-performance batch resolver for missing posters
   */
  const resolveMissingPosters = useCallback(async (newNotifs: Notification[]) => {
    const idsToResolve: string[] = [];

    newNotifs.forEach(n => {
      const entityId = extractNotificationEntityId(n);
      if (!entityId) return;

      // 1. If notification already includes poster in its payload, cache it immediately
      const embeddedPoster = extractEmbeddedPoster(n);
      if (embeddedPoster) {
        posterCache.set(entityId, embeddedPoster);
        resolvedIdsRef.current.add(entityId);
        return;
      }

      // 2. Check if already cached in memory
      if (posterCache.has(entityId) || resolvedIdsRef.current.has(entityId)) {
        return;
      }

      // 3. Mark for batch lookup
      if (!inFlightPosterIds.has(entityId)) {
        inFlightPosterIds.add(entityId);
        idsToResolve.push(entityId);
      }
    });

    if (idsToResolve.length === 0) return;

    try {
      // 1. Direct anime table lookup
      const { data: directAnime, error: directError } = await supabase
        .from('anime')
        .select('id, poster_url')
        .in('id', idsToResolve);

      const resolvedNow = new Set<string>();

      if (!directError && directAnime) {
        directAnime.forEach((a: any) => {
          if (a.poster_url) {
            posterCache.set(a.id, a.poster_url);
            resolvedIdsRef.current.add(a.id);
            resolvedNow.add(a.id);
          }
        });
      }

      // 2. Resolve remaining as possible episode IDs
      const remainingEpisodeIds = idsToResolve.filter(id => !resolvedNow.has(id));

      if (remainingEpisodeIds.length > 0) {
        const { data: epData, error: epError } = await supabase
          .from('episodes')
          .select('id, anime_id')
          .in('id', remainingEpisodeIds);

        if (!epError && epData && epData.length > 0) {
          const epToAnime: Record<string, string> = {};
          const neededAnimeIds = new Set<string>();

          epData.forEach((ep: any) => {
            if (ep.anime_id) {
              epToAnime[ep.id] = ep.anime_id;
              if (posterCache.has(ep.anime_id)) {
                posterCache.set(ep.id, posterCache.get(ep.anime_id)!);
                resolvedIdsRef.current.add(ep.id);
              } else {
                neededAnimeIds.add(ep.anime_id);
              }
            }
          });

          if (neededAnimeIds.size > 0) {
            const { data: parentAnime } = await supabase
              .from('anime')
              .select('id, poster_url')
              .in('id', Array.from(neededAnimeIds));

            if (parentAnime) {
              parentAnime.forEach((a: any) => {
                if (a.poster_url) {
                  posterCache.set(a.id, a.poster_url);
                  resolvedIdsRef.current.add(a.id);
                }
              });

              Object.entries(epToAnime).forEach(([epId, animeId]) => {
                const poster = posterCache.get(animeId);
                if (poster) {
                  posterCache.set(epId, poster);
                  resolvedIdsRef.current.add(epId);
                }
              });
            }
          }
        }
      }

      // Trigger re-render of notification cards with new posters
      setPosterVersion(v => v + 1);
    } catch (err) {
      console.error('[Notifications] Failed resolving posters:', err);
    } finally {
      idsToResolve.forEach(id => inFlightPosterIds.delete(id));
    }
  }, []);

  /**
   * Paginated fetcher for notifications
   */
  const fetchPage = useCallback(async (pageNum: number, isRefresh = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const offset = pageNum * PAGE_SIZE;
      const { data, error } = await userAPI.getNotifications(userId, PAGE_SIZE, offset);

      if (error) {
        console.error('[Notifications] Fetch error:', error);
        return;
      }

      const items = data || [];

      if (isRefresh || pageNum === 0) {
        setNotifs(items);
        setPage(0);
        setHasMore(items.length === PAGE_SIZE);
      } else {
        setNotifs(prev => {
          // Avoid duplicate keys on pagination merges
          const existingIds = new Set(prev.map(p => p.id));
          const freshItems = items.filter((item: Notification) => !existingIds.has(item.id));
          return [...prev, ...freshItems];
        });
        setPage(pageNum);
        setHasMore(items.length === PAGE_SIZE);
      }

      // Resolve posters in background for newly loaded batch
      if (items.length > 0) {
        resolveMissingPosters(items);
      }
    } catch (e) {
      console.error('[Notifications] Unexpected fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [userId, resolveMissingPosters]);

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPage(0, true);
  }, [fetchPage]);

  const handleLoadMore = useCallback(() => {
    if (loading || refreshing || loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchPage(page + 1);
  }, [loading, refreshing, loadingMore, hasMore, page, fetchPage]);

  const markRead = useCallback(async (id: string) => {
    // 1. Optimistic update
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));

    // 2. Synchronize TanStack Query unread-count badge for UniversalHeader
    if (userId) {
      queryClient.setQueryData(
        ['notifications', 'unread-count', userId],
        (old: number | undefined) => Math.max(0, (old ?? 1) - 1)
      );
    }

    try {
      await userAPI.markNotificationRead(id);
    } catch (e) {
      console.error('[Notifications] Failed to mark read:', e);
    }
  }, [userId, queryClient]);

  const handleNotificationPress = useCallback(async (item: Notification) => {
    if (!item.read) {
      await markRead(item.id);
    }
    if (item.action_url) {
      router.push(item.action_url as any);
    }
  }, [markRead, router]);

  const handleDelete = useCallback(async (id: string) => {
    const target = notifs.find(n => n.id === id);

    // 1. Optimistic removal
    setNotifs(prev => prev.filter(n => n.id !== id));

    // 2. Decrement unread count if deleted item was unread
    if (target && !target.read && userId) {
      queryClient.setQueryData(
        ['notifications', 'unread-count', userId],
        (old: number | undefined) => Math.max(0, (old ?? 1) - 1)
      );
    }

    try {
      await userAPI.deleteNotification(id);
    } catch (e) {
      console.error('[Notifications] Failed to delete notification:', e);
    }
  }, [notifs, userId, queryClient]);

  const handleMarkAllRead = useCallback(async () => {
    if (!userId || notifs.every(n => n.read)) return;

    // 1. Optimistic update
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));

    // 2. Zero-out badge in UniversalHeader immediately
    queryClient.setQueryData(['notifications', 'unread-count', userId], 0);

    try {
      await userAPI.markAllNotificationsRead(userId);
    } catch (e) {
      console.error('[Notifications] Failed to mark all read:', e);
      handleRefresh();
    }
  }, [userId, notifs, queryClient, handleRefresh]);

  const handleClearAll = useCallback(async () => {
    if (!userId || notifs.length === 0) return;

    Alert.alert(
      'Clear All',
      'Are you sure you want to clear your notifications archive?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CLEAR ALL',
          style: 'destructive',
          onPress: async () => {
            // 1. Optimistic clear
            setNotifs([]);
            queryClient.setQueryData(['notifications', 'unread-count', userId], 0);

            try {
              setLoading(true);
              await userAPI.clearAllNotifications(userId);
            } catch (e) {
              console.error('[Notifications] Failed to clear all:', e);
              handleRefresh();
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [userId, notifs, queryClient, handleRefresh]);

  const filteredNotifs = useMemo(() => {
    return notifs.filter(n => {
      if (filter === 'all') return true;
      if (filter === 'unread') return !n.read;
      if (filter === 'releases') return n.type === 'episode';
      if (filter === 'simulcast') return n.type === 'new_anime' || n.type === 'episode';
      if (filter === 'community') return n.type === 'review';
      if (filter === 'system') return n.type === 'system';
      return true;
    });
  }, [notifs, filter]);

  // High-performance chronological grouping using numeric epoch comparisons
  const flatGroupedItems = useMemo(() => {
    const items: ({ type: 'header'; title: string } | { type: 'item'; data: Notification })[] = [];
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const earlier: Notification[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;

    filteredNotifs.forEach(item => {
      const itemTime = new Date(item.created_at).getTime();

      if (itemTime >= todayStart) {
        today.push(item);
      } else if (itemTime >= yesterdayStart) {
        yesterday.push(item);
      } else {
        earlier.push(item);
      }
    });

    if (today.length > 0) {
      items.push({ type: 'header', title: 'TODAY' });
      today.forEach(n => items.push({ type: 'item', data: n }));
    }
    if (yesterday.length > 0) {
      items.push({ type: 'header', title: 'YESTERDAY' });
      yesterday.forEach(n => items.push({ type: 'item', data: n }));
    }
    if (earlier.length > 0) {
      items.push({ type: 'header', title: 'PREVIOUSLY' });
      earlier.forEach(n => items.push({ type: 'item', data: n }));
    }

    return items;
  }, [filteredNotifs]);

  const unreadCount = useMemo(() => notifs.filter(n => !n.read).length, [notifs]);

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader} key={`header-${title}`}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
      <View style={styles.sectionHeaderLine} />
    </View>
  );

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item.type === 'header') {
      return renderSectionHeader(item.title);
    }

    const entityId = extractNotificationEntityId(item.data);
    const animePoster =
      extractEmbeddedPoster(item.data) ||
      (entityId ? posterCache.get(entityId) : null) ||
      null;

    return (
      <NotificationItemRow
        item={item.data}
        onPress={handleNotificationPress}
        onDelete={handleDelete}
        animePoster={animePoster}
      />
    );
  }, [handleNotificationPress, handleDelete]);

  const keyExtractor = useCallback((item: any) => {
    if (item.type === 'header') {
      return `header-${item.title}`;
    }
    return item.data.id;
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            haptic.selection();
            router.back();
          }}
          activeOpacity={0.7}
          hitSlop={TOUCH.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0 ? `${unreadCount} unread alerts` : 'Synced and up to date'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllPill}
              onPress={() => {
                haptic.selection();
                handleMarkAllRead();
              }}
              activeOpacity={0.7}
              hitSlop={TOUCH.hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
            >
              <Ionicons name="checkmark-done" size={13} color={COLORS.neon} />
              <Text style={styles.markAllPillText}>Mark all read</Text>
            </TouchableOpacity>
          )}
          {notifs.length > 0 && (
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => {
                haptic.selection();
                handleClearAll();
              }}
              activeOpacity={0.7}
              hitSlop={TOUCH.hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Clear all notifications"
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Minimal filter capsules */}
      {notifs.length > 0 && (
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            data={FILTERS}
            keyExtractor={item => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
            renderItem={({ item }) => {
              const isActive = filter === item.id;
              return (
                <TouchableOpacity
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setFilter(item.id as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.neon} size="small" />
          <Text style={styles.loadingText}>Loading logs...</Text>
        </View>
      ) : notifs.length === 0 ? (
        <View style={styles.empty}>
          <Image
            source={APP_LOGO}
            style={styles.emptyLogo}
            contentFit="cover"
          />
          <Text style={styles.emptyTitle}>Your inbox is clean</Text>
          <Text style={styles.emptySub}>We will let you know here when new episodes air or updates arrive.</Text>
        </View>
      ) : flatGroupedItems.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="filter-outline" size={40} color="rgba(255,255,255,0.12)" />
          <Text style={styles.emptyTitle}>No matching alerts</Text>
          <Text style={styles.emptySub}>There are no notifications matching the selected filter channel.</Text>
          <TouchableOpacity style={styles.resetFilterBtn} onPress={() => setFilter('all')} activeOpacity={0.7}>
            <Text style={styles.resetFilterText}>Reset filter</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={flatGroupedItems}
          keyExtractor={keyExtractor}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={COLORS.neon} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ─── MEMOIZED NOTIFICATION ITEM ROW (NO HEAVY LAYOUT SPRINGS) ─────────────────────────
interface NotificationItemRowProps {
  item: Notification;
  onPress: (item: Notification) => void;
  onDelete: (id: string) => void;
  animePoster: string | null;
}

const notifBadgeLabel = (item: Notification) => {
  if (item.type === 'system') {
    const t = (item.title + ' ' + item.message).toLowerCase();
    if (t.includes('expire')) return 'VIP EXPIRED';
    if (t.includes('renew')) return 'VIP RENEWAL';
    return 'VIP ALERT';
  }
  switch (item.type) {
    case 'episode': return 'NEW [SUB/DUB]';
    case 'new_anime': return 'SIMULCAST';
    case 'review': return 'COMMUNITY';
    default: return 'ANIMEHUB';
  }
};

const NotificationItemRow = React.memo(
  ({ item, onPress, onDelete, animePoster }: NotificationItemRowProps) => {
    const tColor = notifColor(item.type);
    const isVip = item.type === 'system';

    return (
      <Animated.View
        entering={FadeInDown.duration(200)}
        exiting={FadeOutLeft.duration(150)}
        style={[
          styles.notifCard,
          isVip && styles.notifCardVip,
          !item.read && [
            styles.notifCardUnread,
            {
              borderColor: isVip ? 'rgba(255, 184, 0, 0.42)' : tColor + '44',
              backgroundColor: isVip ? '#14110A' : '#0E111A',
            },
          ],
        ]}
      >
        {/* Subtle VIP golden aura gradient strip for VIP cards */}
        {isVip && (
          <LinearGradient
            colors={['rgba(255, 184, 0, 0.12)', 'rgba(255, 184, 0, 0.02)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
        )}

        <TouchableOpacity
          style={styles.notifMainContent}
          onPress={() => onPress(item)}
          activeOpacity={0.75}
        >
          {/* Visual cover poster image or official AnimeHub Logo for platform/system/VIP alerts */}
          {animePoster ? (
            <Image
              source={{ uri: animePoster }}
              style={styles.notifPoster}
              contentFit="cover"
              transition={120}
              recyclingKey={item.id}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.notifPosterWrap, isVip && styles.notifPosterWrapVip]}>
              <Image
                source={APP_LOGO}
                style={styles.notifLogoPoster}
                contentFit="cover"
                transition={120}
              />
              {isVip && (
                <View style={styles.vipOverlayBadge}>
                  <Text style={styles.vipOverlayBadgeText}>VIP</Text>
                </View>
              )}
            </View>
          )}

          {/* Details */}
          <View style={styles.notifDetails}>
            <View style={styles.notifHeaderRow}>
              <View style={styles.headerLeftMeta}>
                <View
                  style={[
                    styles.badgeTag,
                    {
                      backgroundColor: isVip ? 'rgba(255, 184, 0, 0.16)' : tColor + '18',
                      borderColor: isVip ? 'rgba(255, 184, 0, 0.44)' : tColor + '44',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeTagText,
                      { color: isVip ? '#FFB800' : tColor },
                    ]}
                  >
                    {notifBadgeLabel(item)}
                  </Text>
                </View>
                <Text style={styles.notifTime}>{formatRelativeTime(item.created_at)}</Text>
              </View>
              {!item.read && (
                <View
                  style={[
                    styles.unreadDot,
                    { backgroundColor: isVip ? '#FFB800' : tColor },
                  ]}
                />
              )}
            </View>

            <Text
              style={[
                styles.notifTitle,
                !item.read && styles.notifTitleUnread,
                isVip && { color: !item.read ? '#FFF4D6' : '#E8DDBF' },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>

            <Text style={styles.notifMessage} numberOfLines={2}>
              {item.message}
            </Text>

            {/* Inline Quick Action Buttons */}
            {item.action_url && (
              <View style={styles.quickActionRow}>
                {isVip ? (
                  <TouchableOpacity
                    style={styles.quickVipBtn}
                    onPress={() => onPress(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={
                        item.title.toLowerCase().includes('expire') || item.message.toLowerCase().includes('renew')
                          ? 'card'
                          : 'sparkles'
                      }
                      size={10}
                      color="#FFB800"
                    />
                    <Text style={styles.quickVipText}>
                      {item.title.toLowerCase().includes('expire') || item.message.toLowerCase().includes('renew')
                        ? 'Renew Plan'
                        : 'Manage VIP'}
                    </Text>
                    <Ionicons name="chevron-forward" size={10} color="#FFB800" />
                  </TouchableOpacity>
                ) : (item.type === 'episode' || item.type === 'new_anime') ? (
                  <TouchableOpacity
                    style={styles.quickWatchBtn}
                    onPress={() => onPress(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="play" size={10} color={COLORS.neon} />
                    <Text style={styles.quickWatchText}>Watch Now</Text>
                  </TouchableOpacity>
                ) : item.type === 'review' ? (
                  <TouchableOpacity
                    style={styles.quickReviewBtn}
                    onPress={() => onPress(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chatbubble" size={10} color={COLORS.neonPink} />
                    <Text style={styles.quickReviewText}>View Review</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onDelete(item.id)}
          activeOpacity={0.7}
          hitSlop={TOUCH.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Delete notification"
        >
          <Ionicons name="trash-outline" size={14} color={COLORS.textMuted} />
        </TouchableOpacity>
      </Animated.View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.read === nextProps.item.read &&
      prevProps.item.title === nextProps.item.title &&
      prevProps.item.message === nextProps.item.message &&
      prevProps.item.created_at === nextProps.item.created_at &&
      prevProps.animePoster === nextProps.animePoster
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure black AMOLED base
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0E0E1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  titleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 19,
    color: COLORS.text,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontFamily: FONTS.body || 'BeVietnamPro',
    fontSize: 10.5,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  // Minimal filters capsules
  filterContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  filterScroll: {
    paddingHorizontal: SPACING.md,
    gap: 6,
  },
  filterPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterPillActive: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterLabel: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSub,
  },
  filterLabelActive: {
    color: COLORS.text,
  },

  // Chronological sections
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    marginBottom: 6,
  },
  sectionHeaderText: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 10.5,
    color: COLORS.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  // List & Cards
  list: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  markAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 245, 212, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 212, 0.28)',
  },
  markAllPillText: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.neon,
  },
  headerLeftMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  badgeTagText: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  quickActionRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  quickWatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 245, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 212, 0.3)',
  },
  quickWatchText: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.neon,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C0C16',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    position: 'relative',
  },
  notifCardVip: {
    backgroundColor: '#100E14',
    borderColor: 'rgba(255, 184, 0, 0.22)',
  },
  notifCardUnread: {
    borderColor: 'rgba(255, 43, 60, 0.35)',
    backgroundColor: '#0E111A',
  },
  notifMainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
  },
  notifIconWrap: {
    width: 38,
    height: 52,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyLogo: {
    width: 68,
    height: 68,
    borderRadius: 18,
    opacity: 0.35,
    marginBottom: 14,
  },
  notifPoster: {
    width: 38,
    height: 52,
    borderRadius: RADIUS.sm,
    backgroundColor: '#090910',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  notifPosterWrap: {
    width: 38,
    height: 52,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#090910',
  },
  notifPosterWrapVip: {
    borderColor: 'rgba(255, 184, 0, 0.45)',
  },
  notifLogoPoster: {
    width: '100%',
    height: '100%',
  },
  vipOverlayBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 184, 0, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
  },
  vipOverlayBadgeText: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 7.5,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  quickVipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 184, 0, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 0, 0.38)',
  },
  quickVipText: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 10,
    fontWeight: '700',
    color: '#FFB800',
    letterSpacing: 0.2,
  },
  quickReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 71, 87, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.3)',
  },
  quickReviewText: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.neonPink,
  },
  notifDetails: {
    flex: 1,
    gap: 2,
    paddingRight: 6,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  notifTime: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  notifTitle: {
    fontFamily: FONTS.body || 'BeVietnamPro',
    fontSize: 12,
    color: COLORS.textSub,
    fontWeight: '600',
  },
  notifTitleUnread: {
    color: COLORS.text,
    fontWeight: '700',
  },
  notifMessage: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 14.5,
  },
  deleteBtn: {
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },

  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
    paddingBottom: 40,
  },
  emptyTitle: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 6,
  },
  emptySub: {
    fontFamily: FONTS.body || 'BeVietnamPro',
    fontSize: 11.5,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  resetFilterBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  resetFilterText: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.text,
  },
});
