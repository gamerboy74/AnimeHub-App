/**
 * DoubleTapSeek
 *
 * Netflix-style double-tap-to-seek overlay for the video player.
 * - Left half  → double-tap to rewind  10 s
 * - Right half → double-tap to forward 10 s
 *
 * On each double-tap:
 *   1. A large semi-circle (clipped ellipse) fades in and expands from the
 *      tapped edge — exactly the Netflix "ripple" shape.
 *   2. Stacked chevron icons pulse in the centre of the ripple.
 *   3. A "10 seconds" label appears below the chevrons.
 *   4. After ~800 ms the whole overlay fades back out.
 *
 * A single-tap is forwarded to `onSingleTap` so the HUD toggle still works.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SEEK_SECONDS = 10;
const TAP_WINDOW_MS = 300;   // max gap between two taps to count as double
const HIDE_DELAY_MS = 700;   // how long the ripple stays visible

interface Props {
  onSeekRelative: (offset: number) => void;
  onSingleTap: () => void;
}

// ─── Single side component ───────────────────────────────────────────────────
function SeekSide({
  side,
  onSeekRelative,
  onSingleTap,
}: {
  side: 'left' | 'right';
  onSeekRelative: (offset: number) => void;
  onSingleTap: () => void;
}) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const offset = side === 'left' ? -SEEK_SECONDS : SEEK_SECONDS;
  const tapTimeRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // How many times we've double-tapped without lifting (accumulates)
  const tapCountRef = useRef(0);
  const [tapCount, setTapCount] = useState(0);
  const [visible, setVisible] = useState(false);

  // Animation values
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;

  // Ripple size is a circle taller than screen height for a gentler arc
  const rippleSize = screenHeight * 1.6;

  const showRipple = useCallback((count: number) => {
    // Reset and fire
    scale.stopAnimation();
    opacity.stopAnimation();
    iconOpacity.stopAnimation();

    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    setVisible(true);
    setTapCount(count);

    scale.setValue(0.4);
    opacity.setValue(0);
    iconOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.38,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.22,
          duration: 230,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(iconOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    hideTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setVisible(false);
        tapCountRef.current = 0;
        setTapCount(0);
      });
    }, HIDE_DELAY_MS);
  }, [scale, opacity, iconOpacity]);

  const handlePress = useCallback(() => {
    const now = Date.now();
    const gap = now - tapTimeRef.current;
    tapTimeRef.current = now;

    if (gap < TAP_WINDOW_MS) {
      // ── Double-tap detected ──
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      tapCountRef.current += 1;
      const count = tapCountRef.current;
      onSeekRelative(offset);
      showRipple(count);
    } else {
      // Might be single — wait to see if another tap comes
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        tapCountRef.current = 0;
        // Only fire single-tap if ripple isn't showing
        if (!visible) onSingleTap();
      }, TAP_WINDOW_MS);
    }
  }, [offset, onSeekRelative, onSingleTap, showRipple, visible]);

  const isLeft = side === 'left';
  const seekLabel = `${tapCount > 1 ? tapCount * SEEK_SECONDS : SEEK_SECONDS} seconds`;
  const chevronName = isLeft ? 'chevron-back' : 'chevron-forward';

  // Position circle to overlap the edge
  const ripplePositionStyle = isLeft
    ? { left: -(rippleSize * 0.75) }
    : { right: -(rippleSize * 0.75) };

  return (
    <Pressable
      style={[styles.side, isLeft ? styles.sideLeft : styles.sideRight]}
      onPress={handlePress}
      android_disableSound
    >
      {/* ── Ripple half-circle ── */}
      {visible && (
        <Animated.View
          style={[
            styles.ripple,
            ripplePositionStyle,
            {
              width: rippleSize,
              height: rippleSize,
              borderRadius: rippleSize / 2,
              opacity,
              transform: [{ scale }],
            },
          ]}
          pointerEvents="none"
        />
      )}

      {/* ── Icons + label ── */}
      {visible && (
        <Animated.View
          style={[
            styles.seekLabel,
            isLeft ? styles.seekLabelLeft : styles.seekLabelRight,
            { opacity: iconOpacity },
          ]}
          pointerEvents="none"
        >
          {/* Three stacked chevrons, fading in intensity */}
          <View style={styles.chevrons}>
            <Ionicons name={chevronName} size={14} color="rgba(255,255,255,0.35)" />
            <Ionicons name={chevronName} size={19} color="rgba(255,255,255,0.65)" />
            <Ionicons name={chevronName} size={24} color="rgba(255,255,255,0.95)" />
          </View>
          <Text style={styles.seekSeconds}>{seekLabel}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function DoubleTapSeek({ onSeekRelative, onSingleTap }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <SeekSide side="left"  onSeekRelative={onSeekRelative} onSingleTap={onSingleTap} />
      <SeekSide side="right" onSeekRelative={onSeekRelative} onSingleTap={onSingleTap} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  side: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '40%',        // each side covers 40% of screen width
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',  // Enforce clipping of the ripple for a curve shape
  },
  sideLeft:  { left: 0 },
  sideRight: { right: 0 },

  // Base ripple styling, dimensions and positioning set inline
  ripple: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  // Icon + text block — centred in the visible arc area
  seekLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  seekLabelLeft:  { right: '5%' },
  seekLabelRight: { left: '5%' },

  chevrons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  seekSeconds: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
