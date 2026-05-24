/**
 * app/plans.tsx — Dynamic plan comparison screen.
 * All pricing, features, and badges come from the DB via usePlans().
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { supabase, userAPI, SubscriptionPlan, PlanFeature } from '../src/lib/supabase';
import { usePlans, formatPrice, formatPeriod } from '../src/hooks/usePlans';

const { width } = Dimensions.get('window');

// ─── Feature cell ─────────────────────────────────────────────────────────────
function FeatureCell({ value, isPremium }: { value: string; isPremium: boolean }) {
  if (value === '✓') {
    return (
      <View style={[styles.cellIcon, isPremium && styles.cellIconPremium]}>
        <Ionicons name="checkmark" size={13} color={isPremium ? COLORS.neonGold : COLORS.neonCyan} />
      </View>
    );
  }
  if (value === '✗') {
    return (
      <View style={styles.cellIcon}>
        <Ionicons name="close" size={13} color={COLORS.textMuted} />
      </View>
    );
  }
  return (
    <Text
      style={[styles.cellText, isPremium && { color: COLORS.neonGold, fontWeight: '700' }]}
      numberOfLines={2}
    >
      {value}
    </Text>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────
// Extracted so both Free and Premium use the same container height logic
function PlanCard({
  name,
  price,
  period,
  savingsText,
  cycleName,
  badge,
  badgeStyle,
  isCurrent,
  isSelected,
  onPress,
  gradient,
  borderColor,
}: {
  name: string;
  price: string;
  period: string;
  savingsText?: string | null;
  cycleName?: string;
  badge?: string | null;
  badgeStyle?: 'gold' | 'cyan' | 'outline';
  isCurrent?: boolean;
  isSelected?: boolean;
  onPress?: () => void;
  gradient?: string[];
  borderColor: string;
}) {
  const badgeLabel = badge ?? (isCurrent ? 'CURRENT' : null);
  const badgeColor =
    badgeStyle === 'gold'    ? COLORS.neonGold :
    badgeStyle === 'outline' ? 'transparent'   :
    COLORS.neonCyan;
  const badgeTextColor = badgeStyle === 'outline' ? COLORS.neonGold : '#000';

  const inner = (
    <View style={styles.cardInner}>
      {/* Badge row — always occupies space so cards align */}
      <View style={styles.badgeRow}>
        {badgeLabel ? (
          <View style={[
            styles.badgePill,
            { backgroundColor: badgeColor, borderWidth: badgeStyle === 'outline' ? 1 : 0, borderColor: COLORS.neonGold },
          ]}>
            <Text style={[styles.badgePillText, { color: badgeTextColor }]}>{badgeLabel}</Text>
          </View>
        ) : (
          // Invisible spacer so cards without badge have same top padding
          <View style={styles.badgeSpacer} />
        )}
      </View>

      {/* Plan title */}
      <View style={styles.planTitleRow}>
        {isSelected && <Ionicons name="star" size={12} color={COLORS.neonGold} />}
        <Text style={[styles.planCardName, isSelected && { color: COLORS.neonGold }]}>
          {name}
        </Text>
      </View>

      {/* Price */}
      <Text style={styles.planCardPrice}>{price}</Text>
      <Text style={styles.planCardPeriod}>{period}</Text>

      {/* Savings — always reserve a line for alignment */}
      <Text style={[styles.planSavings, !savingsText && { opacity: 0 }]}>
        {savingsText ?? '—'}
      </Text>

      {/* Cycle label */}
      {cycleName ? <Text style={styles.planCycleLabel}>{cycleName}</Text> : null}

      {/* Selected checkmark */}
      {isSelected && (
        <View style={styles.selectedCheck}>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.neonGold} />
        </View>
      )}
    </View>
  );

  const cardStyle = [styles.planCard, { borderColor }];

  if (gradient) {
    return (
      <TouchableOpacity style={styles.planCardWrap} onPress={onPress} activeOpacity={0.85}>
        <LinearGradient colors={gradient as any} style={cardStyle}>
          {inner}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.planCardWrap, onPress && { cursor: 'pointer' } as any]}>
      <View style={cardStyle}>{inner}</View>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PlansScreen() {
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  const { data: plansData, isLoading } = usePlans();

  const isPremium    = user?.subscription_type === 'premium';
  const premiumPlans = (plansData?.plans ?? []).filter(p => p.tier === 'premium');
  const freePlan     = (plansData?.plans ?? []).find(p => p.tier === 'free');
  const features     = plansData?.features ?? [];

  const defaultPlan = premiumPlans.find(p => p.badge) ?? premiumPlans[0];
  const [selected, setSelected] = useState<SubscriptionPlan | null>(null);
  const activePlan = selected ?? defaultPlan ?? null;

  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    if (!user)      { router.push('/auth/login'); return; }
    if (isPremium)  { router.push('/manage-plan' as any); return; }
    if (!activePlan) return;

    setUpgrading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ subscription_type: 'premium' })
        .eq('id', user.id);
      if (error) throw error;

      const renewalMs = activePlan.billing_cycle === 'yearly' ? 365 * 86_400_000 : 30 * 86_400_000;
      // Isolated write — never touches auto_play, theme, or other pref columns
      await userAPI.updateSubscriptionMeta(user.id, {
        billing_cycle:  activePlan.billing_cycle,
        plan_name:      activePlan.name,
        subscribed_at:  new Date().toISOString(),
        next_renewal:   new Date(Date.now() + renewalMs).toISOString(),
      });

      await refreshUser();
      Alert.alert(
        '🎉 Welcome to Premium!',
        `You're now on the ${activePlan.display_name} plan. Enjoy unlimited access!`,
        [{ text: 'Start Watching', onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Upgrade failed. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.neon} size="large" />
        <Text style={styles.loadingText}>Loading plans…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerLabel}>// PRICING</Text>
          <Text style={styles.headerTitle}>Choose Your Plan</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Plan Cards ─────────────────────────────────────────────────────── */}
        <View style={styles.cardsRow}>

          {/* Free */}
          {freePlan && (
            <PlanCard
              name="FREE"
              price="₹0"
              period="forever"
              savingsText={null}
              badge={!isPremium ? 'CURRENT' : null}
              badgeStyle="cyan"
              isCurrent={!isPremium}
              borderColor={!isPremium ? COLORS.neonCyan : COLORS.border}
            />
          )}

          {/* Premium plans from DB */}
          {premiumPlans.map((plan) => {
            const isSelected = activePlan?.id === plan.id;
            const badgeLabel = plan.badge ?? (isPremium ? 'CURRENT' : null);
            const badgeStyle: 'gold' | 'outline' | 'cyan' =
              isPremium ? 'gold' : plan.badge ? 'outline' : 'cyan';

            return (
              <PlanCard
                key={plan.id}
                name={`PREMIUM\n${plan.display_name.toUpperCase()}`}
                price={formatPrice(plan)}
                period={formatPeriod(plan)}
                savingsText={plan.savings_text}
                badge={badgeLabel}
                badgeStyle={badgeStyle}
                isSelected={isSelected}
                onPress={() => setSelected(plan)}
                gradient={
                  isSelected
                    ? ['rgba(255,214,0,0.18)', 'rgba(255,140,0,0.08)', 'rgba(0,0,0,0)']
                    : ['rgba(255,255,255,0.025)', 'rgba(0,0,0,0)']
                }
                borderColor={
                  isSelected ? COLORS.neonGold :
                  isPremium  ? 'rgba(255,214,0,0.35)' :
                  'rgba(255,214,0,0.15)'
                }
              />
            );
          })}
        </View>

        {/* ── Feature Comparison Table ────────────────────────────────────────── */}
        {features.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>// FULL COMPARISON</Text>
            <View style={styles.table}>

              {/* Fixed-width header — mirrors body column flex ratios exactly */}
              <View style={[styles.tableRow, styles.tableHeader]}>
                <View style={styles.colFeature}>
                  <Text style={styles.tableHeaderText}>FEATURE</Text>
                </View>
                <View style={styles.colData}>
                  <Text style={[styles.tableHeaderText, { textAlign: 'center' }]}>FREE</Text>
                </View>
                <View style={[styles.colData, styles.colPremiumHeader]}>
                  <Text style={[styles.tableHeaderText, { textAlign: 'center', color: COLORS.neonGold }]}>
                    PREMIUM
                  </Text>
                </View>
              </View>

              {features.map((f: PlanFeature, i: number) => (
                <View
                  key={f.id}
                  style={[
                    styles.tableRow,
                    i % 2 === 0 ? styles.tableRowAlt : null,
                    f.is_highlighted ? styles.tableRowHighlight : null,
                  ]}
                >
                  {/* Feature label — flex: 2 */}
                  <View style={styles.colFeature}>
                    <Text
                      style={[styles.featureLabel, f.is_highlighted && styles.featureLabelBold]}
                      numberOfLines={2}
                    >
                      {f.label}
                    </Text>
                    {f.sub_label ? <Text style={styles.featureSub}>{f.sub_label}</Text> : null}
                  </View>

                  {/* Free value — flex: 1, centered */}
                  <View style={styles.colData}>
                    <FeatureCell value={f.free_value} isPremium={false} />
                  </View>

                  {/* Premium value — flex: 1, centered, tinted background on highlights */}
                  <View style={[styles.colData, f.is_highlighted && styles.colDataHighlight]}>
                    <FeatureCell value={f.premium_value} isPremium={true} />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── CTA ─────────────────────────────────────────────────────────────── */}
        <View style={styles.ctaSection}>
          {isPremium ? (
            <TouchableOpacity
              style={styles.managePlanBtn}
              onPress={() => router.push('/manage-plan' as any)}
            >
              <Ionicons name="settings-outline" size={18} color={COLORS.neon} />
              <Text style={styles.managePlanText}>Manage Your Plan</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.upgradeBtn, upgrading && { opacity: 0.7 }]}
              onPress={handleUpgrade}
              disabled={upgrading || !activePlan}
            >
              <LinearGradient
                colors={['#FFD700', '#FFA500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeBtnGradient}
              >
                {upgrading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="star" size={18} color="#000" />
                    <Text style={styles.upgradeBtnText}>
                      {activePlan
                        ? `Get ${activePlan.display_name} · ${formatPrice(activePlan)}${formatPeriod(activePlan)}`
                        : 'Upgrade to Premium'
                      }
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          <Text style={styles.ctaNote}>
            Cancel anytime · No hidden fees · Secure payment via Razorpay
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 13, color: COLORS.textMuted },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerLabel: { fontSize: 10, color: COLORS.neonGold, fontWeight: '800', letterSpacing: 2 },
  headerTitle: { fontSize: 20, color: COLORS.text, fontWeight: '900' },

  scroll: { padding: SPACING.md, paddingBottom: 80, gap: SPACING.md },

  // ── Plan cards ─────────────────────────────────────────────────────────────
  // Cards row: no overflow:hidden here — let badge pills breathe
  cardsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: 12, // room for badge pill that sits above card top edge
  },
  planCardWrap: { flex: 1 },
  planCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    backgroundColor: COLORS.bgCard,
  },
  cardInner: {
    padding: SPACING.md,
    gap: 3,
    flex: 1,
    position: 'relative',
  },

  // Badge row — always takes the same height so cards align vertically
  badgeRow: {
    height: 22,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 4,
  },
  badgePill: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgePillText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  badgeSpacer: { height: 22 }, // phantom spacer when no badge

  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  planCardName: {
    fontSize: 10, fontWeight: '900', color: COLORS.textSub,
    letterSpacing: 1.5, lineHeight: 14,
  },
  planCardPrice: { fontSize: 26, fontWeight: '900', color: COLORS.text, marginTop: 6 },
  planCardPeriod: { fontSize: 10, color: COLORS.textMuted },
  planSavings: { fontSize: 10, color: COLORS.neonGold, fontWeight: '700' },
  planCycleLabel: { fontSize: 9, color: COLORS.textMuted, letterSpacing: 0.5 },
  selectedCheck: { position: 'absolute', top: SPACING.sm, right: SPACING.sm },

  // Section label
  sectionLabel: {
    fontSize: 10, color: COLORS.neon, fontWeight: '800', letterSpacing: 2,
    marginTop: SPACING.xs,
  },

  // ── Comparison table ────────────────────────────────────────────────────────
  table: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: COLORS.bgElevated,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tableHeaderText: {
    fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: COLORS.textSub,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    // Horizontal padding handled per-column to avoid double-padding
  },
  tableRowAlt: { backgroundColor: 'rgba(255,255,255,0.013)' },
  tableRowHighlight: { backgroundColor: 'rgba(255,214,0,0.045)' },

  // Column flex: feature=2, data=1, data=1  →  total 4 parts
  colFeature: {
    flex: 2,
    paddingLeft: SPACING.sm,
    paddingVertical: SPACING.xs,
    justifyContent: 'center',
  },
  colData: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xs,
  },
  colPremiumHeader: {
    backgroundColor: 'rgba(255,214,0,0.04)',
  },
  colDataHighlight: {
    backgroundColor: 'rgba(255,214,0,0.07)',
  },
  featureLabel: { fontSize: 12, color: COLORS.textSub },
  featureLabelBold: { color: COLORS.text, fontWeight: '700' },
  featureSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },

  // Cell
  cellIcon: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,245,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  cellIconPremium: { backgroundColor: 'rgba(255,214,0,0.1)' },
  cellText: {
    fontSize: 10, color: COLORS.textSub,
    textAlign: 'center', paddingHorizontal: 4,
  },

  // ── CTA ─────────────────────────────────────────────────────────────────────
  ctaSection: { gap: SPACING.sm, marginTop: SPACING.xs },
  upgradeBtn: { borderRadius: RADIUS.md, overflow: 'hidden' },
  upgradeBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: 16, paddingHorizontal: SPACING.md,
  },
  upgradeBtnText: { color: '#000', fontWeight: '900', fontSize: 14 },
  managePlanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: 16,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.neon,
  },
  managePlanText: { color: COLORS.neon, fontWeight: '800', fontSize: 14 },
  ctaNote: {
    textAlign: 'center', fontSize: 10, color: COLORS.textMuted, lineHeight: 16,
  },
});
