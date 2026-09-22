/**
 * src/components/subscription/FeatureComparisonTable.tsx
 *
 * Senior Dev Clean Categorized Feature Comparison Table
 * Compares Free vs Premium tiers with glowing badges and high contrast.
 *
 * accentColor — synchronized with the selected plan in plans.tsx so that
 * every premium glow (border, icon, text, badge bg) stays perfectly in sync.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { PlanFeature } from '../../lib/supabase';
import { haptic } from '../../lib/haptics';

interface Props {
  features: PlanFeature[];
  /** Synchronized accent color from the parent plan selector (neonGold or neon). */
  accentColor?: string;
}

/** Converts a hex color + alpha into an rgba() string for dynamic backgrounds. */
function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('rgb')) {
    return hex.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(255,214,0,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

function FeatureValue({
  value,
  isPremium,
  accentColor,
}: {
  value: string;
  isPremium: boolean;
  accentColor: string;
}) {
  if (value === '✓') {
    return (
      <View
        style={[
          styles.checkCircle,
          isPremium && { backgroundColor: hexToRgba(accentColor, 0.14) },
        ]}
      >
        <Ionicons
          name="checkmark"
          size={12}
          color={isPremium ? accentColor : COLORS.neonCyan}
        />
      </View>
    );
  }
  if (value === '✗') {
    return (
      <View style={styles.crossCircle}>
        <Ionicons name="close" size={12} color={COLORS.textMuted} />
      </View>
    );
  }
  return (
    <Text
      style={[
        styles.textValue,
        isPremium && { color: accentColor, fontWeight: '800' },
      ]}
      numberOfLines={2}
    >
      {value}
    </Text>
  );
}

export default function FeatureComparisonTable({ features, accentColor }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  // Fallback to gold if used standalone without a parent selector
  const accent = accentColor ?? COLORS.neonGold;
  const accentBorderColor = hexToRgba(accent, 0.35);
  const accentBg = hexToRgba(accent, 0.07);

  // Group features if possible, or display chronologically with highlight accents
  return (
    <View style={[styles.container, { borderColor: accentBorderColor }]}>
      {/* Table Title Bar */}
      <TouchableOpacity
        style={styles.titleBar}
        onPress={() => {
          haptic.selection();
          setCollapsed(prev => !prev);
        }}
        activeOpacity={0.8}
      >
        <View style={styles.titleLeft}>
          <View style={[styles.titleDot, { backgroundColor: accent }]} />
          <Text style={styles.titleText}>FULL FEATURE COMPARISON</Text>
        </View>
        <View style={styles.toggleRow}>
          <Text style={[styles.toggleText, { color: accent }]}>
            {collapsed ? 'Show Details' : 'Hide Details'}
          </Text>
          <Ionicons
            name={collapsed ? 'chevron-down' : 'chevron-up'}
            size={16}
            color={accent}
          />
        </View>
      </TouchableOpacity>

      {!collapsed && (
        <View style={styles.tableBody}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={styles.colFeature}>
              <Text style={styles.colHeaderText}>FEATURE</Text>
            </View>
            <View style={styles.colData}>
              <Text style={styles.colHeaderText}>FREE</Text>
            </View>
            <View style={[styles.colData, { backgroundColor: accentBg }]}>
              <Text style={[styles.colHeaderText, { color: accent }]}>
                PREMIUM
              </Text>
            </View>
          </View>

          {/* Rows */}
          {features.map((item, index) => {
            const isLast = index === features.length - 1;
            const isAlt = index % 2 === 1;

            return (
              <View
                key={item.id}
                style={[
                  styles.dataRow,
                  isAlt && styles.dataRowAlt,
                  item.is_highlighted && { backgroundColor: hexToRgba(accent, 0.03) },
                  isLast && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.colFeature}>
                  <Text
                    style={[
                      styles.featureName,
                      item.is_highlighted && styles.featureNameBold,
                    ]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                  {item.sub_label ? (
                    <Text style={styles.featureSub} numberOfLines={1}>
                      {item.sub_label}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.colData}>
                  <FeatureValue
                    value={item.free_value}
                    isPremium={false}
                    accentColor={accent}
                  />
                </View>

                <View
                  style={[
                    styles.colData,
                    item.is_highlighted && {
                      backgroundColor: accentBg,
                      borderRadius: RADIUS.sm,
                    },
                  ]}
                >
                  <FeatureValue
                    value={item.premium_value}
                    isPremium={true}
                    accentColor={accent}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 43, 60, 0.2)',
    overflow: 'hidden',
    marginTop: SPACING.sm,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    // backgroundColor is injected dynamically via accentColor prop
  },
  titleText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: COLORS.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggleText: {
    fontSize: 11,
    // color is injected dynamically via accentColor prop
    fontWeight: '700',
  },
  tableBody: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
  },
  colHeaderText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.textSub,
    letterSpacing: 1,
    textAlign: 'center',
  },
  colFeature: {
    flex: 2.2,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    justifyContent: 'center',
  },
  colData: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  // colPremiumHeader removed — replaced by dynamic accentBg inline style
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 8,
  },
  dataRowAlt: {
    backgroundColor: 'rgba(255, 255, 255, 0.015)',
  },
  // dataRowHighlight + colPremiumHighlight removed — replaced by dynamic hexToRgba(accent, …) inline styles
  featureName: {
    fontSize: 12,
    color: COLORS.textSub,
    fontWeight: '500',
  },
  featureNameBold: {
    color: COLORS.text,
    fontWeight: '700',
  },
  featureSub: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 245, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // checkCirclePremium removed — replaced by dynamic hexToRgba(accentColor, 0.14) inline style
  crossCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textValue: {
    fontSize: 11,
    color: COLORS.textSub,
    textAlign: 'center',
  },
  // textValuePremium removed — replaced by dynamic { color: accentColor } inline style
});
