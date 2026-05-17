import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';

interface Props {
  /** Rating on a 0–10 scale (matches DB). Displayed as 0–5 stars. */
  rating: number;
  /** Icon pixel size, default 12 */
  size?: number;
  /** Show the numeric rating next to stars */
  showNumber?: boolean;
}

export default function RatingStars({ rating, size = 12, showNumber = false }: Props) {
  // DB uses 0–10, stars use 0–5
  const stars = Math.round(rating / 2);

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= stars ? 'star' : 'star-outline'}
          size={size}
          color={COLORS.neonGold}
        />
      ))}
      {showNumber && (
        <Text style={[styles.num, { fontSize: size }]}>
          {Number(rating).toFixed(1)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  num: {
    color: COLORS.neonGold,
    fontWeight: '700',
    marginLeft: 4,
  },
});
