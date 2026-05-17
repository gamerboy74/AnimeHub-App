import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, RADIUS, FONTS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

export default function UniversalHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const initials = user?.username?.substring(0, 2).toUpperCase() || '??';

  return (
    <BlurView intensity={100} tint="dark" style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.glowLine} />
      <View style={styles.inner}>
        {/* Left: Menu */}
        <TouchableOpacity 
          style={styles.menuBtn} 
          onPress={() => router.push('/notifications')}
          activeOpacity={0.7}
          accessibilityLabel="Open notifications"
          accessibilityRole="button"
        >
          <Ionicons name="menu" size={24} color={COLORS.text} />
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
          <TouchableOpacity 
            style={styles.iconBtn} 
            onPress={() => router.push('/notifications')}
            activeOpacity={0.7}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={20} color={COLORS.textSub} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.settingsBtn} 
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
            accessibilityLabel="Settings"
            accessibilityRole="button"
          >
            <Ionicons name="settings-outline" size={20} color={COLORS.neon} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.avatarBtn} 
            onPress={() => router.push('/profile')}
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
  menuBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
