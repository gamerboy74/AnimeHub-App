import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { userAPI } from '../../lib/supabase';
import SideDrawer from './SideDrawer';

export default function UniversalHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const fetchUnread = async () => {
      const { data } = await userAPI.getNotifications(user.id);
      if (!cancelled) {
        setUnreadCount((data ?? []).filter((n: any) => !n.read).length);
      }
    };

    fetchUnread();
    // Refresh every 60s while header is mounted
    const interval = setInterval(fetchUnread, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user?.id]);

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
            accessibilityLabel="Open menu"
            accessibilityRole="button"
          >
            <View style={styles.hamburgerLines}>
              <View style={styles.line} />
              <View style={[styles.line, styles.lineShort]} />
              <View style={styles.line} />
            </View>
          </TouchableOpacity>

          {/* Center: Branding */}
          <TouchableOpacity
            style={styles.logoRow}
            onPress={() => router.push('/')}
            activeOpacity={0.7}
          >
            <Text style={styles.logoText}>ANIMEHUB</Text>
          </TouchableOpacity>

          {/* Right: Actions */}
          <View style={styles.actions}>
            {/* Notifications with badge */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/notifications')}
              activeOpacity={0.7}
              accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              accessibilityRole="button"
            >
              <Ionicons name="notifications-outline" size={20} color={COLORS.textSub} />
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
              accessibilityLabel="Settings"
              accessibilityRole="button"
            >
              <Ionicons name="settings-outline" size={20} color={COLORS.neon} />
            </TouchableOpacity>

            {/* Avatar */}
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.7}
              accessibilityLabel="My profile"
              accessibilityRole="button"
            >
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
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
    width: 40,
    height: 40,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.neonCyan,
    letterSpacing: 2,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,245,255,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    textTransform: 'uppercase',
  },
  // Right actions
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  // Notification badge
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: COLORS.neon,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(191,95,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 10, color: COLORS.neon, fontWeight: '900' },
  avatarGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(191,95,255,0.3)',
    shadowColor: COLORS.neon,
    shadowOpacity: 1,
    shadowRadius: 5,
  },
  bottomBorder: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
