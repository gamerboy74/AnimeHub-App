import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../src/constants/theme';
import { userAPI, Notification } from '../src/lib/supabase';
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
    case 'episode': return 'play-circle-outline';
    case 'review': return 'chatbubble-outline';
    case 'system': return 'information-circle-outline';
    default: return 'notifications-outline';
  }
};

const notifColor = (type: string) => {
  switch (type) {
    case 'episode': return COLORS.neonCyan;
    case 'review': return COLORS.neon;
    case 'system': return COLORS.neonGold;
    default: return COLORS.neonPink;
  }
};

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

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

  const markRead = useCallback(async (id: string) => {
    try {
      await userAPI.markNotificationRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
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
    try {
      await userAPI.deleteNotification(id);
      setNotifs(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (!user || notifs.filter(n => !n.read).length === 0) return;
    try {
      await userAPI.markAllNotificationsRead(user.id);
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) {
      console.error(e);
    }
  }, [user, notifs]);

  const handleClearAll = useCallback(async () => {
    if (!user || notifs.length === 0) return;
    Alert.alert(
      'Clear All',
      'Are you sure you want to delete all notifications? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
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

  const renderItem = useCallback(({ item }: { item: Notification }) => (
    <NotificationItemRow
      item={item}
      onPress={handleNotificationPress}
      onDelete={handleDelete}
    />
  ), [handleNotificationPress, handleDelete]);

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  const unreadCount = notifs.filter(n => !n.read).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={styles.headerSub}>// SYSTEM REGISTRY</Text>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>{unreadCount} NEW</Text>
          </View>
        )}
      </View>

      {/* Action Toolbar */}
      {notifs.length > 0 && (
        <View style={styles.toolbar}>
          <TouchableOpacity 
            style={[styles.toolbarBtn, unreadCount === 0 && styles.toolbarBtnDisabled]} 
            onPress={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            <Ionicons name="checkmark-done-outline" size={16} color={unreadCount === 0 ? COLORS.textMuted : COLORS.neon} />
            <Text style={[styles.toolbarText, unreadCount === 0 && styles.toolbarTextDisabled]}>MARK READ</Text>
          </TouchableOpacity>
          <View style={styles.toolbarDivider} />
          <TouchableOpacity style={styles.toolbarBtn} onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={16} color={COLORS.neonPink} />
            <Text style={[styles.toolbarText, { color: COLORS.neonPink }]}>CLEAR ALL</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.neon} size="large" />
          <Text style={styles.loadingText}>SYNCING NOTIFICATIONS...</Text>
        </View>
      ) : notifs.length === 0 ? (
        <View style={styles.empty}>
          <LinearGradient
            colors={['rgba(191,95,255,0.05)', 'transparent']}
            style={styles.emptyGlow}
          />
          <Ionicons name="notifications-off-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Inbox is Clean</Text>
          <Text style={styles.emptySub}>We will notify you here when new episodes air or updates arrive.</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={keyExtractor}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── MEMOIZED NOTIFICATION ITEM ROW ───────────────────────────────────────────
interface NotificationItemRowProps {
  item: Notification;
  onPress: (item: Notification) => void;
  onDelete: (id: string) => void;
}

const NotificationItemRow = React.memo(
  ({ item, onPress, onDelete }: NotificationItemRowProps) => {
    const tColor = notifColor(item.type);
    
    return (
      <View style={[styles.notifCard, !item.read && styles.notifCardUnread]}>
        {/* Left accent bar for unread notifications */}
        {!item.read && <View style={[styles.leftAccentBar, { backgroundColor: tColor }]} />}

        <TouchableOpacity
          style={styles.notifMainContent}
          onPress={() => onPress(item)}
          activeOpacity={0.8}
        >
          {/* Icon Wrap */}
          <View style={[styles.notifIconWrap, !item.read && { borderColor: tColor, backgroundColor: 'rgba(255,255,255,0.02)' }]}>
            <Ionicons name={notifIcon(item.type) as any} size={18} color={item.read ? COLORS.textMuted : tColor} />
          </View>

          {/* Details */}
          <View style={styles.notifDetails}>
            <View style={styles.notifHeaderRow}>
              <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.notifTime}>{formatRelativeTime(item.created_at)}</Text>
            </View>
            <Text style={styles.notifMessage} numberOfLines={2}>
              {item.message}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Delete button */}
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item.id)} activeOpacity={0.7}>
          <Ionicons name="close-circle-outline" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.read === nextProps.item.read &&
      prevProps.item.title === nextProps.item.title &&
      prevProps.item.message === nextProps.item.message &&
      prevProps.item.created_at === nextProps.item.created_at
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  titleWrap: {
    flex: 1,
  },
  headerSub: {
    fontSize: 9,
    color: COLORS.neon,
    letterSpacing: 2,
    fontWeight: '800',
  },
  headerTitle: {
    fontSize: 20,
    color: COLORS.text,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  unreadBadge: {
    backgroundColor: 'rgba(255,45,120,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,45,120,0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCount: {
    fontSize: 10,
    color: COLORS.neonPink,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  toolbarBtnDisabled: {
    opacity: 0.5,
  },
  toolbarText: {
    fontSize: 11,
    color: COLORS.neon,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  toolbarTextDisabled: {
    color: COLORS.textMuted,
  },
  toolbarDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  list: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    gap: 12,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard ?? '#0E0E1A',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    position: 'relative',
    paddingRight: SPACING.sm,
  },
  notifCardUnread: {
    borderColor: 'rgba(191,95,255,0.1)',
    backgroundColor: 'rgba(191,95,255,0.02)',
    ...SHADOWS.neon,
    shadowOpacity: 0.03,
  },
  leftAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  notifMainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingLeft: 14,
  },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  notifDetails: {
    flex: 1,
    gap: 2,
    paddingRight: 8,
  },
  notifHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  notifTitle: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: '600',
  },
  notifTitleUnread: {
    color: COLORS.text,
    fontWeight: '800',
  },
  notifTime: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  notifMessage: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  deleteBtn: {
    padding: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    color: COLORS.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
    position: 'relative',
  },
  emptyGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    top: '25%',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptySub: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
