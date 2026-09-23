import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SPACING, TOUCH } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import RequestAnimeModal from '../settings/RequestAnimeModal';
import { useTranslation } from '../../context/LocalizationContext';
import { haptic } from '../../lib/haptics';
import { useQuery } from '@tanstack/react-query';
import { userAPI } from '../../lib/supabase';

import { useUIStore } from '../../store/uiStore';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.8, 320);

interface SideDrawerProps {
  visible?: boolean;
  onClose?: () => void;
}

const NAV_ITEMS = [
  // ── Discover (not in bottom nav) ───────────────────────────
  { key: 'airingSchedule', label: 'Airing Schedule', icon: 'calendar-outline', route: '/schedule' },
  { key: 'trending', label: 'Trending', icon: 'flame-outline', route: '/trending' },
  { key: 'newArrivals', label: 'New Arrivals', icon: 'sparkles-outline', route: '/new-arrivals' },
  // ── My Stuff ───────────────────────────────────────────────
  { key: 'favoritesLabel', label: 'Favorites', icon: 'heart-outline', route: '/favorites' },
  { key: 'downloadsLabel', label: 'Downloads', icon: 'download-outline', route: '/downloads' },
  { key: 'myStats', label: 'My Stats', icon: 'stats-chart-outline', route: '/stats' },
  // ── App ────────────────────────────────────────────────────
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline', route: '/notifications' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline', route: '/settings' },
] as const;

export default function SideDrawer({ visible, onClose }: SideDrawerProps = {}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t } = useTranslation();

  const storeOpen = useUIStore((s) => s.drawerOpen);
  const storeSetOpen = useUIStore((s) => s.setDrawerOpen);
  const isVisible = visible !== undefined ? visible : storeOpen;
  const handleClose = onClose ?? useCallback(() => storeSetOpen(false), [storeSetOpen]);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await userAPI.getUnreadNotificationCount(user!.id);
      return count ?? 0;
    },
  });

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = React.useState(false);
  const [showRequest, setShowRequest] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setModalVisible(true);
      // Wait one frame so Modal is mounted before animating
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }),
          Animated.timing(overlayOpacity, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setModalVisible(false));
    }
  }, [isVisible]);

  const navigate = useCallback((route: string) => {
    haptic.selection();
    handleClose();
    setTimeout(() => router.push(route as any), 220);
  }, [handleClose, router]);

  const handleSignOut = useCallback(async () => {
    haptic.medium();
    handleClose();
    setTimeout(async () => {
      await signOut();
      router.replace('/auth/login' as any);
    }, 220);
  }, [handleClose, signOut, router]);

  const handleSignIn = useCallback(() => {
    haptic.medium();
    handleClose();
    setTimeout(() => {
      router.push('/auth/login' as any);
    }, 220);
  }, [handleClose, router]);

  const initials = user?.username?.substring(0, 2).toUpperCase() ?? '??';
  const hasValidAvatar = !!(user?.avatar_url &&
    user.avatar_url !== 'https://ieopfdxgjlmdsidikgbj.supabase.co' &&
    user.avatar_url !== 'https://ieopfdxgjlmdsidikgbj.supabase.co/');

  return (
    <>
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleClose}
      >
        {/* Dimmed overlay — tapping closes drawer */}
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        </Animated.View>

        {/* Drawer panel */}
        <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

          {/* Right neon accent bar */}
          <View style={styles.accentBar} />

          <View style={[styles.drawerInner, { paddingTop: insets.top + 16 }]}>

            {/* Profile header */}
            <View style={styles.profileSection}>
              <View style={styles.avatarWrap}>
                {user ? (
                  hasValidAvatar ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} contentFit="cover" transition={200} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitials}>{initials}</Text>
                    </View>
                  )
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: COLORS.border }]}>
                    <Ionicons name="person-outline" size={20} color={COLORS.textMuted} />
                  </View>
                )}
                <View style={[styles.avatarRing, !user && { borderColor: COLORS.border }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.username} numberOfLines={1}>
                  {user?.username ?? t('guestUser')}
                </Text>
                <Text style={styles.email} numberOfLines={1}>
                  {user?.email ?? t('signInSync')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  haptic.light();
                  handleClose();
                }}
                style={styles.closeBtn}
                hitSlop={TOUCH.hitSlop}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
              >
                <Ionicons name="close" size={18} color={COLORS.textSub} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            {/* Scrollable nav items — fills remaining space */}
            <ScrollView
              style={styles.navScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.navScrollContent}
            >
              <Text style={styles.navSection}>{t('discover')}</Text>
              {NAV_ITEMS.filter(i => ['Airing Schedule', 'Trending', 'New Arrivals'].includes(i.label)).map((item) => (
                <NavRow key={item.key} item={item} label={t(item.key as any)} onPress={() => navigate(item.route)} />
              ))}

              {/* ── Request an Anime ─────────────────────────────── */}
              <TouchableOpacity
                style={styles.requestRow}
                onPress={() => {
                  haptic.selection();
                  handleClose();
                  setTimeout(() => setShowRequest(true), 250);
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <View style={styles.requestIconWrap}>
                  <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                </View>
                <Text style={styles.requestLabel}>{t('requestAnime')}</Text>
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.navSection}>{t('myStuff')}</Text>
              {NAV_ITEMS.filter(i => ['Favorites', 'Downloads', 'My Stats'].includes(i.label)).map((item) => (
                <NavRow key={item.key} item={item} label={t(item.key as any)} onPress={() => navigate(item.route)} />
              ))}
              <Text style={styles.navSection}>{t('appLabel')}</Text>
              {NAV_ITEMS.filter(i => ['Notifications', 'Settings'].includes(i.label)).map((item) => (
                <NavRow
                  key={item.key}
                  item={item}
                  label={t(item.key as any)}
                  onPress={() => navigate(item.route)}
                  badgeCount={item.key === 'notifications' ? unreadCount : undefined}
                />
              ))}
            </ScrollView>

            {/* Footer — pinned below nav, above safe area */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
              <View style={styles.divider} />
              {user ? (
                <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7} accessibilityRole="button">
                  <Ionicons name="log-out-outline" size={20} color={COLORS.neonPink} />
                  <Text style={styles.signOutText}>{t('signOut')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.signInBtn} onPress={handleSignIn} activeOpacity={0.7} accessibilityRole="button">
                  <Ionicons name="log-in-outline" size={20} color={COLORS.neon} />
                  <Text style={styles.signInText}>{t('signIn')}</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.versionText}>AnimeHub v1.0.2</Text>
            </View>
          </View>
        </Animated.View>
      </Modal>

      {/* Request modal lives outside the drawer Modal so it renders on top */}
      <RequestAnimeModal
        visible={showRequest}
        onClose={() => setShowRequest(false)}
      />
    </>
  );
}

// ─── Reusable nav row ─────────────────────────────────────────────────────────
const NavRow = React.memo(
  ({ item, label, onPress, badgeCount }: { item: any; label: string; onPress: () => void; badgeCount?: number }) => {
    return (
      <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.navIconWrap}>
          <Ionicons name={item.icon as any} size={20} color={COLORS.neon} />
        </View>
        <Text style={styles.navLabel}>{label}</Text>
        {typeof badgeCount === 'number' && badgeCount > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
          </View>
        ) : item.badge ? (
          <View style={styles.soonBadge}>
            <Text style={styles.soonText}>{item.badge}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
        )}
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.key === nextProps.item.key &&
      prevProps.item.icon === nextProps.item.icon &&
      prevProps.item.badge === nextProps.item.badge &&
      prevProps.badgeCount === nextProps.badgeCount &&
      prevProps.label === nextProps.label
    );
  }
);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,16,0.72)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: 'rgba(14,14,26,0.96)',
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 2,
    bottom: 0,
    backgroundColor: COLORS.neon,
    opacity: 0.5,
    shadowColor: COLORS.neon,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  drawerInner: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    position: 'relative',
  },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,43,60,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.neon,
  },
  avatarInitials: { fontSize: 16, color: COLORS.neon, fontWeight: '900' },
  avatarRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.neon,
    opacity: 0.5,
  },
  username: { fontSize: 15, color: COLORS.text, fontWeight: '700' },
  email: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  navScroll: { flex: 1 },
  navScrollContent: { paddingBottom: 8 },
  navSection: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '800',
    letterSpacing: 2,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  navIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,43,60,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navLabel: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '600' },
  soonBadge: {
    backgroundColor: 'rgba(255,184,0,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.4)',
  },
  soonText: { fontSize: 9, color: COLORS.neonGold, fontWeight: '800', letterSpacing: 1 },
  countBadge: {
    backgroundColor: COLORS.neon,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
  },
  countBadgeText: { fontSize: 10, color: '#fff', fontWeight: '800' },
  footer: {},
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
  },
  signOutText: { fontSize: 14, color: COLORS.neonPink, fontWeight: '700' },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
  },
  signInText: { fontSize: 14, color: COLORS.neon, fontWeight: '700' },
  versionText: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 8, letterSpacing: 1 },

  // ── Request an Anime row ──────────────────────────────────────────
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: 2,
    backgroundColor: 'rgba(255,43,60,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,43,60,0.2)',
  },
  requestIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.neon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestLabel: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '700' },
  newBadge: {
    backgroundColor: 'rgba(255,43,60,0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.neon,
  },
  newBadgeText: { fontSize: 9, color: COLORS.neon, fontWeight: '900', letterSpacing: 1 },
});
