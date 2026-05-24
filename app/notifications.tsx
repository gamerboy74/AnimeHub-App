import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';
import { userAPI, Notification } from '../src/lib/supabase';
import { useAuth } from '../src/context/AuthContext';

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    userAPI.getNotifications(user.id).then(({ data }) => {
      setNotifs(data || []);
      setLoading(false);
    });
  }, [user]);

  const markRead = useCallback(async (id: string) => {
    await userAPI.markNotificationRead(id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const renderItem = useCallback(({ item }: { item: Notification }) => (
    <NotificationItemRow
      item={item}
      onPress={markRead}
    />
  ), [markRead]);

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  const ItemSeparator = useCallback(() => <View style={styles.separator} />, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerSub}>// NOTIFICATIONS</Text>
        </View>
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadCount}>{notifs.filter(n => !n.read).length}</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.neon} style={{ marginTop: SPACING.xl }} />
      ) : notifs.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={48} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>No notifications</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ItemSeparatorComponent={ItemSeparator}
        />
      )}
    </View>
  );
}

// ─── MEMOIZED NOTIFICATION ITEM ROW ───────────────────────────────────────────
interface NotificationItemRowProps {
  item: Notification;
  onPress: (id: string) => void;
}

const notifIcon = (type: string) => {
  switch (type) {
    case 'episode': return 'play-circle-outline';
    case 'review': return 'chatbubble-outline';
    case 'system': return 'information-circle-outline';
    default: return 'notifications-outline';
  }
};

const NotificationItemRow = React.memo(
  ({ item, onPress }: NotificationItemRowProps) => {
    return (
      <TouchableOpacity
        style={[styles.notifRow, !item.read && styles.notifRowUnread]}
        onPress={() => onPress(item.id)}
      >
        <View style={[styles.notifIcon, !item.read && styles.notifIconUnread]}>
          <Ionicons name={notifIcon(item.type) as any} size={18} color={item.read ? COLORS.textMuted : COLORS.neon} />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}>{item.title}</Text>
          <Text style={styles.notifMessage} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.notifTime}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.read === nextProps.item.read &&
      prevProps.item.title === nextProps.item.title &&
      prevProps.item.message === nextProps.item.message
    );
  }
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerSub: { fontSize: 10, color: COLORS.neon, letterSpacing: 2, fontWeight: '700' },
  headerTitle: { fontSize: 18, color: COLORS.text, fontWeight: '800' },
  unreadBadge: { marginLeft: 'auto', backgroundColor: COLORS.neonPink, borderRadius: 12, minWidth: 24, height: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadCount: { fontSize: 12, color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, paddingVertical: SPACING.md },
  notifRowUnread: { backgroundColor: 'rgba(191,95,255,0.04)', borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm },
  notifIcon: { width: 40, height: 40, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  notifIconUnread: { borderColor: COLORS.neon, backgroundColor: 'rgba(191,95,255,0.1)' },
  notifContent: { flex: 1, gap: 2 },
  notifTitle: { fontSize: 14, color: COLORS.textSub, fontWeight: '600' },
  notifTitleUnread: { color: COLORS.text },
  notifMessage: { fontSize: 12, color: COLORS.textMuted, lineHeight: 18 },
  notifTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.neon, marginTop: SPACING.sm },
  separator: { height: 1, backgroundColor: COLORS.border },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  emptyText: { fontSize: 14, color: COLORS.textMuted },
});
