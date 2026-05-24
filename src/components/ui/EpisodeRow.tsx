// ─── EpisodeRow Component ───────────────────────────────────────
// OPTIMIZATION: Removed useAuth() call from inside the list-item component.
// Calling a context hook in every row means any auth context update re-renders
// the whole list. Pass isPremiumUser as a prop from the parent instead.
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

export interface EpisodeItem {
  id: string;
  episode_number: number;
  title?: string | null;
  is_premium?: boolean;
  duration?: number | null;
  air_date?: string | null;
  progress_percent?: number | null;
}

export interface EpisodeRowProps {
  episode: EpisodeItem;
  /** Pass `user?.subscription_type === 'premium'` from the parent. */
  isPremiumUser?: boolean;
  onPress: () => void;
  isHistory?: boolean;
}

export const EpisodeRow = React.memo(
  ({ episode, isPremiumUser = false, onPress, isHistory = false }: EpisodeRowProps) => {
    const isPremiumLocked = episode.is_premium && !isPremiumUser;

    return (
      <TouchableOpacity style={styles.epRow} onPress={onPress}>
        <View style={styles.epLeft}>
          <View style={[styles.epNumBox, episode.is_premium && styles.epNumBoxPremium]}>
            {episode.is_premium
              ? <Ionicons name="star" size={14} color={COLORS.neonGold} />
              : <Text style={styles.epNumText}>{episode.episode_number}</Text>
            }
          </View>
        </View>
        <View style={styles.epMid}>
          <Text style={styles.epTitle} numberOfLines={1}>
            {episode.title || `Episode ${episode.episode_number}`}
          </Text>
          <View style={styles.epMetaRow}>
            {/* Convert seconds to minutes in the parent, or show raw duration here */}
            {episode.duration != null && (
              <Text style={styles.epMeta}>{episode.duration}min</Text>
            )}
            {episode.air_date && <Text style={styles.epMeta}>• {episode.air_date}</Text>}
            {episode.is_premium && (
              <Text style={[styles.epMeta, { color: COLORS.neonGold }]}>• PREMIUM</Text>
            )}
            {isHistory && episode.progress_percent != null && (
              <Text style={[styles.epMeta, { color: COLORS.neon }]}>
                {' '}• {Math.round(episode.progress_percent)}%
              </Text>
            )}
          </View>
        </View>
        {isPremiumLocked
          ? <Ionicons name="lock-closed-outline" size={18} color={COLORS.neonGold} />
          : <Ionicons name="play-circle-outline" size={24} color={COLORS.neon} />
        }
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.episode.id === nextProps.episode.id &&
      prevProps.episode.episode_number === nextProps.episode.episode_number &&
      prevProps.episode.title === nextProps.episode.title &&
      prevProps.episode.is_premium === nextProps.episode.is_premium &&
      prevProps.isHistory === nextProps.isHistory &&
      prevProps.isPremiumUser === nextProps.isPremiumUser &&
      prevProps.episode.progress_percent === nextProps.episode.progress_percent
    );
  }
);

const styles = StyleSheet.create({
  epRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  epLeft: {},
  epNumBox: {
    width: 40, height: 40, borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(191,95,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  epNumBoxPremium: {
    backgroundColor: 'rgba(255,214,0,0.1)',
    borderColor: 'rgba(255,214,0,0.3)',
  },
  epNumText: { fontSize: 14, color: COLORS.neon, fontWeight: '700' },
  epMid: { flex: 1 },
  epTitle: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  epMetaRow: { flexDirection: 'row', gap: 4, marginTop: 3 },
  epMeta: { fontSize: 11, color: COLORS.textMuted },
});
