import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../lib/supabase';
import SideDrawer from './SideDrawer';
import { useQuery } from '@tanstack/react-query';

export default function UniversalHeader({ title }: { title?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);

  // useQuery with refetchInterval replaces the manual setInterval pattern.
  // Benefits: deduplication across mounts, auto-refetch on app-focus,
  // proper cleanup — no need for a cancelled flag.
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await userAPI.getNotifications(user!.id);
      return (data ?? []).filter((n: any) => !n.read).length;
    },
  });

  const initials = user?.username?.substring(0, 2).toUpperCase() ?? '??';

  return (
    <>
      <BlurView intensity={100} tint="dark" style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.glowLine} />
        <View style={styles.inner}>

          {/* Left: Hamburger menu */}
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setDrawerOpen(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Open menu"
            accessibilityRole="button"
          >
            <View style={styles.hamburgerLines}>
              <View style={styles.line} />
              <View style={[styles.line, styles.lineShort]} />
              <View style={styles.line} />
            </View>
          </TouchableOpacity>

          {/* Center: Branding + optional tab title */}
          <TouchableOpacity
            style={styles.logoRow}
            onPress={() => router.push('/')}
            activeOpacity={0.7}
            accessible={true}
            accessibilityRole="header"
            accessibilityLabel="AnimeHub Home"
          >
            <Text style={styles.logoText}>
              <Text style={styles.logoTextWhite}>ANIME</Text>
              <Text style={styles.logoTextRed}>HUB</Text>
            </Text>
          </TouchableOpacity>

          {/* Right: Actions */}
          <View style={styles.actions}>
            {/* Notifications with badge */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              accessibilityRole="button"
            >
              <Ionicons name="notifications-outline" size={22} color={COLORS.textSub} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Settings */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/settings')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Settings"
              accessibilityRole="button"
            >
              <Ionicons name="settings-outline" size={22} color={COLORS.neon} />
            </TouchableOpacity>

            {/* Avatar */}
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="My profile"
              accessibilityRole="button"
            >
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} contentFit="cover" transition={200} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}
              <View style={styles.avatarGlow} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.bottomBorder} />
      </BlurView>

      {/* Slide-out drawer — renders above everything */}
      <SideDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(8,8,16,0.95)',
    zIndex: 100,
  },
  glowLine: {
    height: 1,
    backgroundColor: COLORS.neon,
    opacity: 0.3,
    shadowColor: COLORS.neon,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  inner: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
  // Hamburger
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerLines: {
    width: 22,
    gap: 5,
  },
  line: {
    height: 2,
    backgroundColor: COLORS.text,
    borderRadius: 2,
  },
  lineShort: {
    width: '65%',
  },
  // Logo
  logoRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    fontStyle: 'italic',
    textTransform: 'uppercase',
  },
  logoTextWhite: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  logoTextRed: {
    color: COLORS.primary,
    textShadowColor: 'rgba(255,43,60,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  tabTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    fontStyle: 'normal',
  },
  // Right actions
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Notification badge
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.neonPink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(8,8,16,1)',
  },
  badgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '900',
    lineHeight: 11,
  },
  // Avatar
  avatarBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,43,60,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 10, color: COLORS.neon, fontWeight: '900' },
  avatarGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,43,60,0.3)',
    shadowColor: COLORS.neon,
    shadowOpacity: 1,
    shadowRadius: 5,
  },
  bottomBorder: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
