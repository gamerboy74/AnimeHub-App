import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeOutLeft, Layout } from 'react-native-reanimated';
import { COLORS, SPACING, RADIUS, FONTS } from '../src/constants/theme';
import { userAPI, Notification, supabase } from '../src/lib/supabase';
import { useAuth } from '../src/context/AuthContext';

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
 * Extracts the target anime/episode ID from notification data or action_url.
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

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'releases', label: 'Episodes' },
  { id: 'community', label: 'Social' },
  { id: 'system', label: 'System' },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'releases' | 'community' | 'system'>('all');
  
  // Real anime covers mapping state
  const [animePosters, setAnimePosters] = useState<Record<string, string>>({});

  const fetchNotifs = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data } = await userAPI.getNotifications(user.id);
      setNotifs(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  // Batch query anime poster images dynamically based on anime_id or episode_id keys in notification data or action_url
  useEffect(() => {
    if (notifs.length === 0) return;

    const resolvePosters = async () => {
      try {
        const candidateIds = new Set<string>();

        notifs.forEach(n => {
          const id = extractNotificationEntityId(n);
          if (id) candidateIds.add(id);
        });

        if (candidateIds.size === 0) return;

        const candidateArray = Array.from(candidateIds);

        // 1. Try querying the 'anime' table directly first (handles direct anime_ids or watch links using anime_ids)
        const { data: directAnime, error: directError } = await supabase
          .from('anime')
          .select('id, poster_url')
          .in('id', candidateArray);

        const posterMap: Record<string, string> = {};
        const resolvedAnimeIds = new Set<string>();

        if (!directError && directAnime) {
          directAnime.forEach((a: any) => {
            if (a.poster_url) {
              posterMap[a.id] = a.poster_url;
              resolvedAnimeIds.add(a.id);
            }
          });
        }

        // 2. Any candidate IDs that were NOT resolved as anime IDs could be episode IDs
        const potentialEpisodeIds = candidateArray.filter(id => !resolvedAnimeIds.has(id));

        if (potentialEpisodeIds.length > 0) {
          // Resolve episode_ids to their respective anime_ids from database
          const { data: epData, error: epError } = await supabase
            .from('episodes')
            .select('id, anime_id')
            .in('id', potentialEpisodeIds);

          if (!epError && epData && epData.length > 0) {
            const epToAnimeMap: Record<string, string> = {};
            const neededAnimeIds = new Set<string>();

            epData.forEach((ep: any) => {
              if (ep.anime_id) {
                epToAnimeMap[ep.id] = ep.anime_id;
                neededAnimeIds.add(ep.anime_id);
              }
            });

            if (neededAnimeIds.size > 0) {
              // Fetch poster URLs for these parent anime IDs
              const { data: parentAnimeData, error: parentAnimeError } = await supabase
                .from('anime')
                .select('id, poster_url')
                .in('id', Array.from(neededAnimeIds));

              if (!parentAnimeError && parentAnimeData) {
                const parentPosterMap: Record<string, string> = {};
                parentAnimeData.forEach((a: any) => {
                  if (a.poster_url) {
                    parentPosterMap[a.id] = a.poster_url;
                    // Also save under the anime_id key directly
                    posterMap[a.id] = a.poster_url;
                  }
                });

                // Now map each episode ID to its parent anime's poster URL
                Object.keys(epToAnimeMap).forEach(epId => {
                  const parentId = epToAnimeMap[epId];
                  if (parentPosterMap[parentId]) {
                    posterMap[epId] = parentPosterMap[parentId];
                  }
                });
              }
            }
          }
        }

        setAnimePosters(prev => ({ ...prev, ...posterMap }));
      } catch (err) {
        console.error('Failed resolving notifications anime posters:', err);
      }
    };

    resolvePosters();
  }, [notifs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifs();
    setRefreshing(false);
  }, [fetchNotifs]);

  const markRead = useCallback(async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await userAPI.markNotificationRead(id);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleNotificationPress = useCallback(async (item: Notification) => {
    if (!item.read) {
      await markRead(item.id);
    }
    if (item.action_url) {
      router.push(item.action_url as any);
    }
  }, [markRead, router]);

  const handleDelete = useCallback(async (id: string) => {
    setNotifs(prev => prev.filter(n => n.id !== id));
    try {
      await userAPI.deleteNotification(id);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (!user || notifs.filter(n => !n.read).length === 0) return;
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await userAPI.markAllNotificationsRead(user.id);
    } catch (e) {
      console.error(e);
      fetchNotifs();
    }
  }, [user, notifs, fetchNotifs]);

  const handleClearAll = useCallback(async () => {
    if (!user || notifs.length === 0) return;
    Alert.alert(
      'Clear All',
      'Are you sure you want to clear your notifications archive?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'CLEAR ALL',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await userAPI.clearAllNotifications(user.id);
              setNotifs([]);
            } catch (e) {
              console.error(e);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }, [user, notifs]);

  const filteredNotifs = useMemo(() => {
    return notifs.filter(n => {
      if (filter === 'all') return true;
      if (filter === 'unread') return !n.read;
      if (filter === 'releases') return n.type === 'episode' || n.type === 'new_anime';
      if (filter === 'community') return n.type === 'review';
      if (filter === 'system') return n.type === 'system';
      return true;
    });
  }, [notifs, filter]);

  const flatGroupedItems = useMemo(() => {
    const items: ( { type: 'header'; title: string } | { type: 'item'; data: Notification } )[] = [];
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const earlier: Notification[] = [];

    const now = new Date();
    const todayStr = now.toDateString();

    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toDateString();

    filteredNotifs.forEach(item => {
      const itemDate = new Date(item.created_at);
      const itemDateStr = itemDate.toDateString();

      if (itemDateStr === todayStr) {
        today.push(item);
      } else if (itemDateStr === yestStr) {
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

  const unreadCount = notifs.filter(n => !n.read).length;

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
      <View style={styles.sectionHeaderLine} />
    </View>
  );

  const renderItem = useCallback(({ item }: { item: any }) => {
    if (item.type === 'header') {
      return renderSectionHeader(item.title);
    }

    const posterKey = extractNotificationEntityId(item.data);
    const animePoster = posterKey ? animePosters[posterKey] : null;

    return (
      <NotificationItemRow
        item={item.data}
        onPress={handleNotificationPress}
        onDelete={handleDelete}
        animePoster={animePoster}
      />
    );
  }, [handleNotificationPress, handleDelete, animePosters]);

  const keyExtractor = useCallback((item: any) => {
    if (item.type === 'header') {
      return `header-${item.title}`;
    }
    return item.data.id;
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Clean Clean Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
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
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleMarkAllRead} activeOpacity={0.7}>
              <Ionicons name="checkmark-done" size={18} color={COLORS.neon} />
            </TouchableOpacity>
          )}
          {notifs.length > 0 && (
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleClearAll} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Horizontally scrollable minimalist capsules */}
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
          <Ionicons name="notifications-outline" size={48} color="rgba(255,255,255,0.15)" />
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
        />
      )}
    </View>
  );
}

// ─── MEMOIZED & ANIMATED NOTIFICATION ITEM ROW ───────────────────────────────────────────
interface NotificationItemRowProps {
  item: Notification;
  onPress: (item: Notification) => void;
  onDelete: (id: string) => void;
  animePoster: string | null;
}

const NotificationItemRow = React.memo(
  ({ item, onPress, onDelete, animePoster }: NotificationItemRowProps) => {
    const tColor = notifColor(item.type);

    return (
      <Animated.View
        entering={FadeInDown.duration(250)}
        exiting={FadeOutLeft.duration(180)}
        layout={Layout.springify().mass(0.6)}
        style={[
          styles.notifCard,
          !item.read && styles.notifCardUnread,
        ]}
      >
        <TouchableOpacity
          style={styles.notifMainContent}
          onPress={() => onPress(item)}
          activeOpacity={0.75}
        >
          {/* visual cover poster image or fallback circular icon */}
          {animePoster ? (
            <Image
              source={{ uri: animePoster }}
              style={styles.notifPoster}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.notifIconWrap, { backgroundColor: 'rgba(255,255,255,0.03)' }]}>
              <Ionicons name={notifIcon(item.type) as any} size={16} color={tColor} />
            </View>
          )}

          {/* Details */}
          <View style={styles.notifDetails}>
            <View style={styles.notifHeaderRow}>
              <Text style={styles.notifTime}>{formatRelativeTime(item.created_at)}</Text>
              {!item.read && <View style={[styles.unreadDot, { backgroundColor: tColor }]} />}
            </View>

            <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>

            <Text style={styles.notifMessage} numberOfLines={2}>
              {item.message}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Delete */}
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item.id)} activeOpacity={0.7}>
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0E0E1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
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

  // List & Cards (Frosted solid style, clean borders)
  list: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C0C16', // Solid elegant frosted container (resolves glassdrop rendering bugs)
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  notifCardUnread: {
    borderColor: 'rgba(191,95,255,0.12)',
    backgroundColor: '#0F0E1E',
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  notifPoster: {
    width: 38,
    height: 52,
    borderRadius: RADIUS.sm,
    backgroundColor: '#090910',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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

  // Minimal placeholder empty states
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
