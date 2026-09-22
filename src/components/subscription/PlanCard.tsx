/**
 * src/components/subscription/PlanCard.tsx
 *
 * Senior Dev Modular Subscription Plan Card
 * Featuring glowing cyberpunk accents, clear pricing psychology (savings %,
 * monthly equivalent), badges, and crisp responsive layout.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { SubscriptionPlan } from '../../lib/supabase';
import { formatPrice, formatPeriod } from '../../hooks/usePlans';

interface PlanCardProps {
  plan: SubscriptionPlan;
  isSelected: boolean;
  isCurrent: boolean;
  onSelect: () => void;
  monthlyReferencePricePaise?: number;
  highlightedPerks?: string[];
}

export default function PlanCard({
  plan,
  isSelected,
  isCurrent,
  onSelect,
  monthlyReferencePricePaise = 9900,
  highlightedPerks,
}: PlanCardProps) {
  const isYearly = plan.billing_cycle === 'yearly';
  const isFree = plan.tier === 'free';

  // Savings & price calculation
  const currentPrice = formatPrice(plan);
  const period = formatPeriod(plan);

  // Compute monthly equivalent & strike-through for yearly
  const monthlyEquivalent = isYearly ? Math.round((plan.price_paise / 100) / 12) : null;
  const annualizedMonthly = Math.round((monthlyReferencePricePaise * 12) / 100);
  const currentYearlyTotal = Math.round(plan.price_paise / 100);
  const savingsAmount = isYearly && annualizedMonthly > currentYearlyTotal ? annualizedMonthly - currentYearlyTotal : null;

  // Default perks if not provided
  const perks = highlightedPerks || (
    isFree
      ? ['720p HD Streaming', 'With Ads', '1 Device at a time', 'Free Episode Catalog']
      : isYearly
      ? ['1080p Full HD Streaming', '100% Ad-Free Anime', '2 Devices Simultaneous', 'Offline Downloads', 'Save ₹' + (savingsAmount || 389) + '/year']
      : ['1080p Full HD Streaming', '100% Ad-Free Anime', '2 Devices Simultaneous', 'Offline Downloads', 'Cancel Anytime']
  );

  // Badge logic
  const badgeText = isCurrent ? 'CURRENT' : plan.badge || (isYearly ? 'BEST VALUE' : null);

  const getBorderColor = () => {
    if (isSelected) return isYearly ? COLORS.neonGold : COLORS.neon;
    if (isCurrent)  return COLORS.neonCyan;
    return 'rgba(255,255,255,0.1)';
  };

  const getCardBg = () => {
    if (isSelected) return isYearly ? 'rgba(255,184,0,0.12)' : 'rgba(255,43,60,0.12)';
    return COLORS.bgCard;
  };

  return (
    <TouchableOpacity
      style={styles.wrapper}
      onPress={onSelect}
      activeOpacity={0.85}
      accessible={true}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${plan.display_name} plan, ${currentPrice} ${period}`}
    >
      <View
        style={[
          styles.cardContainer,
          { borderColor: getBorderColor(), borderWidth: isSelected || isCurrent ? 2 : 1, backgroundColor: getCardBg() },
        ]}
      >
        {/* Top Header Row */}
        <View style={styles.topRow}>
          <View style={styles.nameSection}>
            <View style={styles.titleRow}>
              <Text style={[styles.planTitle, isSelected && { color: isYearly ? COLORS.neonGold : COLORS.neon }]}>
                {plan.display_name.toUpperCase()}
              </Text>
              {isSelected && (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={isYearly ? COLORS.neonGold : COLORS.neon}
                />
              )}
            </View>

            {isYearly ? (
              <Text style={styles.planSubtitle}>Full year of unrestricted anime</Text>
            ) : isFree ? (
              <Text style={styles.planSubtitle}>Standard access with ads</Text>
            ) : (
              <Text style={styles.planSubtitle}>Flexible month-to-month billing</Text>
            )}
          </View>

          {/* Badge Pill */}
          {badgeText && (
            <View
              style={[
                styles.badgePill,
                badgeText === 'CURRENT'
                  ? styles.badgeCurrent
                  : isYearly
                  ? styles.badgeBestValue
                  : styles.badgeDefault,
              ]}
            >
              <Text
                style={[
                  styles.badgePillText,
                  badgeText === 'CURRENT'
                    ? { color: COLORS.neonCyan }
                    : isYearly
                    ? { color: '#000' }
                    : { color: COLORS.neon },
                ]}
              >
                {badgeText}
              </Text>
            </View>
          )}
        </View>

        {/* Pricing Block */}
        <View style={styles.priceBlock}>
          <View style={styles.priceMainRow}>
            {/* Strike-through annualized cost for yearly */}
            {isYearly && annualizedMonthly > 0 && (
              <Text style={styles.strikethroughPrice}>₹{annualizedMonthly}</Text>
            )}
            <Text style={styles.priceAmount}>{currentPrice}</Text>
            <Text style={styles.pricePeriod}>{period}</Text>
          </View>

          {/* Monthly equivalent callout for yearly plan */}
          {isYearly && monthlyEquivalent !== null && (
            <View style={styles.breakdownRow}>
              <View style={styles.rateTag}>
                <Ionicons name="flash" size={11} color={COLORS.neonGold} />
                <Text style={styles.rateTagText}>
                  Only ₹{monthlyEquivalent}/mo
                </Text>
              </View>
              {savingsAmount && (
                <Text style={styles.savingsNote}>
                  Save ₹{savingsAmount} (33% OFF)
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Highlights / Perks */}
        <View style={styles.perksList}>
          {perks.map((perk, idx) => (
            <View key={idx} style={styles.perkRow}>
              <Ionicons
                name={isFree ? (idx < 2 ? 'checkmark-circle-outline' : 'close-circle-outline') : 'checkmark-circle'}
                size={15}
                color={
                  isFree
                    ? (idx < 2 ? COLORS.neonCyan : COLORS.textMuted)
                    : isYearly
                    ? COLORS.neonGold
                    : COLORS.neon
                }
              />
              <Text
                style={[
                  styles.perkText,
                  isFree && idx >= 2 && styles.perkTextMuted,
                  !isFree && idx === 0 && styles.perkTextHighlight,
                ]}
                numberOfLines={1}
              >
                {perk}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: RADIUS.lg,
    marginVertical: SPACING.xs,
  },
  cardContainer: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  nameSection: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    color: COLORS.text,
  },
  planSubtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeBestValue: {
    backgroundColor: COLORS.neonGold,
  },
  badgeDefault: {
    backgroundColor: 'rgba(255, 43, 60, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 43, 60, 0.4)',
  },
  badgeCurrent: {
    backgroundColor: 'rgba(0, 245, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 255, 0.4)',
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  priceBlock: {
    marginTop: SPACING.sm,
  },
  priceMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  strikethroughPrice: {
    fontSize: 14,
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
  priceAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
  },
  pricePeriod: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 4,
  },
  rateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 214, 0, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 0, 0.25)',
  },
  rateTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.neonGold,
  },
  savingsNote: {
    fontSize: 11,
    color: COLORS.neonGold,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: SPACING.sm,
  },
  perksList: {
    gap: 6,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  perkText: {
    fontSize: 12,
    color: COLORS.textSub,
    flex: 1,
  },
  perkTextMuted: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  perkTextHighlight: {
    color: COLORS.text,
    fontWeight: '700',
  },
});
