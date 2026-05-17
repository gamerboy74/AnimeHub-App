import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

interface Props {
  /** 0–100 percentage */
  progress: number;
  /** Bar height in px, default 3 */
  height?: number;
  /** Fill colour, default COLORS.neonCyan */
  color?: string;
  /** Background track colour, default semi-transparent white */
  trackColor?: string;
  /** Show a dot thumb at the fill end point */
  showThumb?: boolean;
  /** Optional time labels on left and right */
  leftLabel?: string;
  rightLabel?: string;
}

export default function ProgressBar({
  progress,
  height = 3,
  color = COLORS.neonCyan,
  trackColor = 'rgba(255,255,255,0.15)',
  showThumb = false,
  leftLabel,
  rightLabel,
}: Props) {
  const pct = Math.min(100, Math.max(0, progress));

  return (
    <View>
      {(leftLabel || rightLabel) && (
        <View style={styles.labelRow}>
          {leftLabel  && <Text style={styles.label}>{leftLabel}</Text>}
          {rightLabel && <Text style={styles.label}>{rightLabel}</Text>}
        </View>
      )}
      <View style={[styles.track, { height, backgroundColor: trackColor }]}>
        <View style={[styles.fill, { width: `${pct}%`, height, backgroundColor: color }]} />
        {showThumb && (
          <View
            style={[
              styles.thumb,
              {
                left: `${pct}%`,
                marginLeft: -6,
                top: -(6 - height / 2),
                backgroundColor: '#fff',
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  track: {
    borderRadius: 99,
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    borderRadius: 99,
  },
  thumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
});
