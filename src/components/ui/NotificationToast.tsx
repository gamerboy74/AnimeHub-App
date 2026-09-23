import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useUIStore } from '../../store/uiStore';
import { COLORS, FONTS, RADIUS } from '../../constants/theme';
import { haptic } from '../../lib/haptics';

const APP_LOGO = require('../../../assets/icon.png');

export default function NotificationToast() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useUIStore((s) => s.activeToastNotification);
  const hideToast = useUIStore((s) => s.hideNotificationToast);

  const translateY = useSharedValue(-120);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toast) {
      translateY.value = withSpring(0, { damping: 14, stiffness: 120 });
      haptic.light();

      // Auto dismiss after 4.5 seconds
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        dismiss();
      }, 4500);
    } else {
      translateY.value = -120;
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toast]);

  const dismiss = () => {
    translateY.value = withTiming(-140, { duration: 200 }, () => {
      runOnJS(hideToast)();
    });
  };

  const handlePress = () => {
    if (!toast) return;
    haptic.selection();
    const actionUrl = toast.actionUrl;
    dismiss();
    if (actionUrl) {
      router.push(actionUrl as any);
    }
  };

  // Swipe up to dismiss gesture
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY < 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY < -20 || e.velocityY < -300) {
        runOnJS(dismiss)();
      } else {
        translateY.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!toast) return null;

  const isVip =
    toast?.type === 'system' ||
    Boolean(toast?.actionUrl?.includes('plan')) ||
    Boolean(toast?.title?.toLowerCase().includes('premium')) ||
    Boolean(toast?.title?.toLowerCase().includes('vip')) ||
    Boolean(toast?.title?.toLowerCase().includes('subscri')) ||
    Boolean(toast?.title?.toLowerCase().includes('renew'));

  const badgeText = isVip
    ? (toast?.title?.toLowerCase().includes('expire') ? 'VIP EXPIRED' : toast?.title?.toLowerCase().includes('renew') ? 'VIP RENEWAL' : 'VIP ALERT')
    : toast?.type === 'review'
    ? 'COMMUNITY'
    : toast?.type === 'new_anime'
    ? 'SIMULCAST'
    : 'NEW [SUB/DUB]';

  const actionText = isVip
    ? (toast?.title?.toLowerCase().includes('expire') || toast?.message?.toLowerCase().includes('renew') ? 'Renew' : 'View VIP')
    : toast?.type === 'review'
    ? 'View'
    : 'Watch';

  const actionIcon = isVip
    ? (toast?.title?.toLowerCase().includes('expire') ? 'card' : 'sparkles')
    : toast?.type === 'review'
    ? 'chatbubble'
    : 'play';

  const accentColor = isVip
    ? COLORS.neonGold
    : toast?.type === 'review'
    ? COLORS.neonPink
    : COLORS.neon;

  return (
    <View style={[styles.wrapper, { top: insets.top + 8 }]} pointerEvents="box-none">
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.container,
            { shadowColor: isVip ? '#FFB800' : '#FF2B3C' },
            animatedStyle,
          ]}
        >
          <Pressable onPress={handlePress} style={styles.pressable} android_ripple={{ color: 'rgba(255,255,255,0.08)' }}>
            <BlurView
              intensity={90}
              tint="dark"
              style={[
                styles.blurCard,
                {
                  borderColor: isVip ? 'rgba(255, 184, 0, 0.45)' : 'rgba(255, 43, 60, 0.35)',
                  backgroundColor: isVip ? 'rgba(18, 15, 10, 0.94)' : 'rgba(14, 14, 24, 0.88)',
                },
              ]}
            >
              {/* Left visual: Anime poster or official AnimeHub Logo */}
              {toast.posterUrl ? (
                <Image
                  source={{ uri: toast.posterUrl }}
                  style={styles.poster}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <View style={[styles.toastPosterWrap, isVip && styles.toastPosterWrapVip]}>
                  <Image
                    source={APP_LOGO}
                    style={styles.toastLogoPoster}
                    contentFit="cover"
                    transition={150}
                  />
                  {isVip && (
                    <View style={styles.toastVipOverlay}>
                      <Text style={styles.toastVipOverlayText}>VIP</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Center Content */}
              <View style={styles.contentWrap}>
                <View style={styles.topRow}>
                  <View
                    style={[
                      styles.badgePill,
                      {
                        backgroundColor: isVip ? 'rgba(255, 184, 0, 0.18)' : accentColor + '18',
                        borderColor: isVip ? 'rgba(255, 184, 0, 0.45)' : accentColor + '44',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgePillText,
                        { color: isVip ? '#FFB800' : accentColor },
                      ]}
                    >
                      {badgeText}
                    </Text>
                  </View>
                  <Text style={styles.timeTag}>Just now</Text>
                </View>
                <Text style={styles.title} numberOfLines={1}>
                  {toast.title}
                </Text>
                <Text style={styles.message} numberOfLines={1}>
                  {toast.message}
                </Text>
              </View>

              {/* Right Action */}
              <TouchableOpacity
                style={[
                  styles.watchBtn,
                  { backgroundColor: accentColor },
                ]}
                onPress={handlePress}
                activeOpacity={0.8}
              >
                <Ionicons name={actionIcon as any} size={11} color="#000" />
                <Text style={styles.watchBtnText}>{actionText}</Text>
              </TouchableOpacity>
            </BlurView>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 9999,
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 480,
    shadowColor: '#FF2B3C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  pressable: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  blurCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(14, 14, 24, 0.88)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 43, 60, 0.35)',
    gap: 10,
  },
  poster: {
    width: 36,
    height: 48,
    borderRadius: RADIUS.sm,
    backgroundColor: '#090910',
  },
  toastPosterWrap: {
    width: 36,
    height: 48,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: '#090910',
  },
  toastPosterWrapVip: {
    borderColor: 'rgba(255, 184, 0, 0.5)',
  },
  toastLogoPoster: {
    width: '100%',
    height: '100%',
  },
  toastVipOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFB800',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
  },
  toastVipOverlayText: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 7,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  contentWrap: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgePill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  badgePillText: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  timeTag: {
    fontSize: 9,
    color: COLORS.textMuted,
  },
  title: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  message: {
    fontSize: 10.5,
    color: COLORS.textSub,
  },
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
  },
  watchBtnText: {
    fontFamily: FONTS.display || 'SpaceGrotesk',
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
  },
});
