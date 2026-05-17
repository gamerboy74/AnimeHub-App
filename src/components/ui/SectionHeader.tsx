import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../constants/theme';

interface Props {
  label?: string;        // monospace tag e.g. "// TRENDING"
  title: string;         // main section title e.g. "Continue Watching"
  onSeeAll?: () => void;
  seeAllLabel?: string;  // defaults to "SEE ALL →"
}

export default function SectionHeader({ label, title, onSeeAll, seeAllLabel = 'SEE ALL →' }: Props) {
  return (
    <View style={styles.row}>
      <View>
        {label && <Text style={styles.label}>{label}</Text>}
        <Text style={styles.title}>{title}</Text>
      </View>
      {onSeeAll && (
        <TouchableOpacity
          onPress={onSeeAll}
          accessibilityLabel={seeAllLabel}
          accessibilityRole="button"
        >
          <Text style={styles.seeAll}>{seeAllLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: 10,
    color: COLORS.neon,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontSize: 20,
    color: COLORS.text,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  seeAll: {
    fontSize: 11,
    color: COLORS.neon,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
