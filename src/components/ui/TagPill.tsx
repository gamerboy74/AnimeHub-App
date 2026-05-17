import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

type Variant = 'default' | 'neon' | 'gold' | 'danger' | 'success';

interface Props {
  label: string;
  variant?: Variant;
  onPress?: () => void;
}

const VARIANT_STYLES: Record<Variant, { bg: string; border: string; color: string }> = {
  default:  { bg: 'rgba(255,255,255,0.06)', border: COLORS.border,              color: COLORS.textSub  },
  neon:     { bg: 'rgba(191,95,255,0.12)',  border: 'rgba(191,95,255,0.4)',     color: COLORS.neon     },
  gold:     { bg: 'rgba(255,214,0,0.12)',   border: 'rgba(255,214,0,0.4)',      color: COLORS.neonGold },
  danger:   { bg: 'rgba(255,45,120,0.12)', border: 'rgba(255,45,120,0.4)',      color: COLORS.neonPink },
  success:  { bg: 'rgba(0,245,180,0.12)',  border: 'rgba(0,245,180,0.4)',       color: COLORS.success  },
};

export default function TagPill({ label, variant = 'default', onPress }: Props) {
  const v = VARIANT_STYLES[variant];

  const pill = (
    <View style={[styles.pill, { backgroundColor: v.bg, borderColor: v.border }]}>
      <Text style={[styles.text, { color: v.color }]}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        {pill}
      </TouchableOpacity>
    );
  }

  return pill;
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
