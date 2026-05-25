import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { COLORS } from '../../constants/theme';
import type { DownloadStatus } from '../../hooks/useHlsDownloader';

// ─── Props ────────────────────────────────────────────────────────────────────

interface DownloadButtonProps {
  status: DownloadStatus;
  progress: number;       // 0.0 – 1.0
  /** True once the WebView sniffer has captured a .m3u8 URL */
  sniffedUrl: string | null;
  isPremium: boolean;
  onPress: () => void;
  onCancel: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DownloadButton({
  status,
  progress,
  sniffedUrl,
  isPremium,
  onPress,
  onCancel,
}: DownloadButtonProps) {
  // Don't show button until a URL has been sniffed, or if user isn't premium
  if (!isPremium) return null;

  const pct = Math.round(progress * 100);

  if (status === 'done') {
    return (
      <BlurView intensity={40} style={styles.pill} tint="dark">
        <Ionicons name="checkmark-circle" size={14} color={COLORS.neon} />
        <Text style={[styles.label, { color: COLORS.neon }]}>Downloaded</Text>
      </BlurView>
    );
  }

  if (status === 'downloading' || status === 'preparing') {
    return (
      <TouchableOpacity onPress={onCancel} activeOpacity={0.8}>
        <BlurView intensity={40} style={styles.pill} tint="dark">
          <ActivityIndicator size="small" color={COLORS.neonCyan} style={{ marginRight: 4 }} />
          <Text style={[styles.label, { color: COLORS.neonCyan }]}>
            {status === 'preparing' ? 'Preparing…' : `${pct}%`}
          </Text>
          <Ionicons name="close-circle" size={14} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
        </BlurView>
      </TouchableOpacity>
    );
  }

  if (status === 'error') {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <BlurView intensity={40} style={[styles.pill, styles.pillError]} tint="dark">
          <Ionicons name="alert-circle" size={14} color={COLORS.neonPink} />
          <Text style={[styles.label, { color: COLORS.neonPink }]}>Retry</Text>
        </BlurView>
      </TouchableOpacity>
    );
  }

  if (status === 'sniffing') {
    return (
      <BlurView intensity={40} style={styles.pill} tint="dark">
        <ActivityIndicator size="small" color={COLORS.textMuted} style={{ marginRight: 4 }} />
        <Text style={[styles.label, { color: COLORS.textMuted }]}>Detecting…</Text>
      </BlurView>
    );
  }

  // idle — show if URL has been detected
  if (!sniffedUrl) return null;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <BlurView intensity={40} style={styles.pill} tint="dark">
        <Ionicons name="download-outline" size={14} color={COLORS.text} />
        <Text style={styles.label}>Download</Text>
      </BlurView>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pillError: {
    borderColor: 'rgba(255,80,120,0.4)',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
});
