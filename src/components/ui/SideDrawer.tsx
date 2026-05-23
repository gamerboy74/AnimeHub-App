import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Pressable,
  Image,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.8, 320);

interface SideDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { label: 'Home',          icon: 'home-outline',            route: '/'            },
  { label: 'Explore',       icon: 'search-outline',          route: '/explore'     },
  { label: 'Library',       icon: 'bookmark-outline',        route: '/library'     },
  { label: 'Favorites',     icon: 'heart-outline',           route: '/favorites'   },
  { label: 'Watch History', icon: 'time-outline',            route: '/history'     },
  { label: 'Downloads',     icon: 'download-outline',        route: '/downloads',  badge: 'SOON' },
  { label: 'Notifications', icon: 'notifications-outline',   route: '/notifications' },
  { label: 'Settings',      icon: 'settings-outline',        route: '/settings'    },
] as const;

export default function SideDrawer({ visible, onClose }: SideDrawerProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible && mounted) {
      // Unmount after exit animation completes
      const t = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(t);
    }
  }, [visible, mounted]);

  useEffect(() => {
    if (visible) {
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
      ]).start();
    }
  }, [visible]);

  const navigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 220);
  };

  const handleSignOut = async () => {
    onClose();
    setTimeout(async () => {
      await signOut();
      router.replace('/auth/login' as any);
    }, 220);
  };

  const initials = user?.username?.substring(0, 2).toUpperCase() ?? '??';

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Dimmed overlay */}
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Left neon accent bar */}
        <View style={styles.accentBar} />

        <View style={[styles.drawerInner, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>

          {/* Header: avatar + name */}
          <View style={styles.profileSection}>
            <View style={styles.avatarWrap}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
              <View style={styles.avatarRing} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.username} numberOfLines={1}>
                {user?.username ?? 'Guest'}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {user?.email ?? ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Nav items */}
          <View style={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.route}
                style={styles.navItem}
                onPress={() => navigate(item.route)}
                activeOpacity={0.7}
              >
                <View style={styles.navIconWrap}>
                  <Ionicons name={item.icon as any} size={20} color={COLORS.neon} />
                </View>
                <Text style={styles.navLabel}>{item.label}</Text>
                {'badge' in item && item.badge ? (
                  <View style={styles.soonBadge}>
                    <Text style={styles.soonText}>{item.badge}</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Footer: version + sign out */}
          <View style={styles.footer}>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.neonPink} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
            <Text style={styles.versionText}>AnimeHub v1.0.0</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

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
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(191,95,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.neon,
  },
  avatarInitials: {
    fontSize: 16,
    color: COLORS.neon,
    fontWeight: '900',
  },
  avatarRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: COLORS.neon,
    opacity: 0.5,
  },
  username: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '700',
  },
  email: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  navList: {
    flex: 1,
    gap: 2,
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
    backgroundColor: 'rgba(191,95,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  navLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  soonBadge: {
    backgroundColor: 'rgba(255,214,0,0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,214,0,0.4)',
  },
  soonText: {
    fontSize: 9,
    color: COLORS.neonGold,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    gap: 4,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 12,
    paddingHorizontal: SPACING.sm,
  },
  signOutText: {
    fontSize: 14,
    color: COLORS.neonPink,
    fontWeight: '700',
  },
  versionText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
    letterSpacing: 1,
  },
});
