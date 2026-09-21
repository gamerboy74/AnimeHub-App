/**
 * app/plans.tsx
 *
 * Professional Plan Selection Screen.
 * Design: clean border + bg tint for selection. No shadow bloat. Single accent color.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { supabase, SubscriptionPlan } from '../src/lib/supabase';
import { usePlans, formatPrice } from '../src/hooks/usePlans';
import RazorpayCheckout, { RazorpayPaymentResult } from '../src/components/ui/RazorpayCheckout';

// ─── Data ───────────────────────────────────────────────────────────────────

const COMPARISON = [
  { feature: 'Video Quality',     free: '720p HD',      vip: '4K Ultra HD + HDR', bold: true  },
  { feature: 'Ads',               free: 'With Ads',     vip: 'Zero Ads',          bold: true  },
  { feature: 'Screens',           free: '1 Device',     vip: '2 Simultaneous',    bold: true  },
  { feature: 'Downloads',         free: 'None',         vip: 'Unlimited',         bold: true  },
  { feature: 'New Episodes',      free: 'Delayed',      vip: 'Same-day',          bold: false },
  { feature: 'Stream Speed',      free: 'Standard',     vip: 'Multi-server',      bold: false },
];

const YEARLY_PERKS  = ['4K Ultra HD + HDR', 'Zero Ads', '2 Screens', '4 Months Free'];
const MONTHLY_PERKS = ['4K Ultra HD + HDR', 'Zero Ads', '2 Screens', 'Cancel Anytime'];

// ─── Component ──────────────────────────────────────────────────────────────

export default function PlansScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  const { data: plansData, isLoading } = usePlans();
  const isPremium = user?.subscription_type === 'premium';
  const plans     = useMemo(() => plansData?.plans ?? [], [plansData]);

  const premiumPlans  = useMemo(() => plans.filter(p => p.tier === 'premium'), [plans]);
  const monthlyPlan   = useMemo(() => premiumPlans.find(p => p.billing_cycle === 'monthly'), [premiumPlans]);
  const yearlyPlan    = useMemo(() => premiumPlans.find(p => p.billing_cycle === 'yearly'),  [premiumPlans]);

  const [selectedCycle, setSelectedCycle] = useState<'yearly' | 'monthly'>('yearly');
  const isYearly = selectedCycle === 'yearly';

  const comparisonFeatures = useMemo(() => {
    if (plansData?.features && plansData.features.length > 0) {
      return plansData.features.map(f => ({
        feature: f.label,
        free: f.free_value,
        vip: f.premium_value,
        bold: f.is_highlighted,
      }));
    }
    return COMPARISON;
  }, [plansData?.features]);

  // Single accent token — flows everywhere
  const accent   = isYearly ? COLORS.neonGold : COLORS.neon;
  const accentBg = isYearly ? 'rgba(255,214,0,0.09)' : 'rgba(191,95,255,0.09)';

  const activePlan: SubscriptionPlan | null = useMemo(() => {
    if (selectedCycle === 'monthly' && monthlyPlan) return monthlyPlan;
    if (selectedCycle === 'yearly'  && yearlyPlan)  return yearlyPlan;
    return yearlyPlan ?? monthlyPlan ?? premiumPlans[0] ?? null;
  }, [selectedCycle, yearlyPlan, monthlyPlan, premiumPlans]);

  // ── Checkout state ──────────────────────────────────────────────────────
  const [upgrading,        setUpgrading]        = useState(false);
  const [verifyingPending, setVerifyingPending] = useState(false);
  const [checkoutVisible,  setCheckoutVisible]  = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{
    orderId: string; amount: number; currency: string; keyId: string;
  } | null>(null);

  // Step 1 — Create order
  const handleUpgrade = async () => {
    if (!user)     { router.push('/auth/login'); return; }
    if (isPremium) { router.push('/manage-plan' as any); return; }
    if (!activePlan) return;
    setUpgrading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in required');
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/razorpay-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'create-order', planId: activePlan.id, userId: user.id, billingCycle: activePlan.billing_cycle }),
        },
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Could not initialize order');
      setPendingOrder({ orderId: json.orderId, amount: json.amount, currency: json.currency, keyId: json.keyId });
      setCheckoutVisible(true);
    } catch (err: any) {
      Alert.alert('Payment', err?.message ?? 'Failed to start payment. Try again.');
    } finally {
      setUpgrading(false);
    }
  };

  // Step 2 — Verify after success
  const handlePaymentSuccess = async (result: RazorpayPaymentResult) => {
    setCheckoutVisible(false);
    setUpgrading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/razorpay-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({
            action: 'verify-payment', orderId: result.orderId, paymentId: result.paymentId,
            signature: result.signature, userId: user!.id, planId: activePlan?.id, billingCycle: activePlan?.billing_cycle,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Verification failed');
      await refreshUser();
      Alert.alert('🎉 Welcome to VIP!', `Your ${activePlan?.display_name} is now active. Enjoy 4K anime!`, [{ text: 'Start Watching', onPress: () => router.back() }]);
    } catch {
      Alert.alert('Notice', `Payment was processed. Save Payment ID: ${result.paymentId} and contact support@animehub.app if not upgraded.`);
    } finally {
      setUpgrading(false);
      setPendingOrder(null);
    }
  };

  // Step 3 — Check order (UPI app return)
  const checkOrderStatus = useCallback(async (): Promise<boolean> => {
    if (!pendingOrder || !user) return false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/razorpay-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'check-order-status', orderId: pendingOrder.orderId, userId: user.id, planId: activePlan?.id, billingCycle: activePlan?.billing_cycle }),
        },
      );
      const json = await res.json();
      if (json?.status === 'paid') {
        await refreshUser();
        setCheckoutVisible(false);
        setPendingOrder(null);
        Alert.alert('🎉 Welcome to VIP!', 'Payment verified. Enjoy unlimited access!', [{ text: 'Start Watching', onPress: () => router.back() }]);
        return true;
      }
      return false;
    } catch { return false; }
  }, [pendingOrder, user, activePlan, refreshUser, router]);

  // Auto-verify when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active' && pendingOrder) await checkOrderStatus();
    });
    return () => sub.remove();
  }, [pendingOrder, checkOrderStatus]);

  // Step 4 — Dismiss (no false "cancelled" alerts)
  const handlePaymentDismiss = async (reason?: string) => {
    if (pendingOrder && user) {
      setVerifyingPending(true);
      const paid = await checkOrderStatus();
      setVerifyingPending(false);
      if (paid) return;
    }
    setCheckoutVisible(false);
    setPendingOrder(null);
    if (reason && reason !== 'User cancelled' && !reason.toLowerCase().includes('cancelled') && !reason.toLowerCase().includes('dismissed')) {
      Alert.alert('Payment', reason);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={accent} size="large" />
        <Text style={styles.loadingText}>Loading plans…</Text>
      </View>
    );
  }

  const yearlyPriceStr  = yearlyPlan  ? formatPrice(yearlyPlan)  : '₹799';
  const monthlyPriceStr = monthlyPlan ? formatPrice(monthlyPlan) : '₹99';
  const yearlyPerMonth  = yearlyPlan  ? Math.round((yearlyPlan.price_paise / 100) / 12) : 67;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Razorpay Modal */}
      <Modal
        visible={checkoutVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => handlePaymentDismiss('User cancelled')}
      >
        {pendingOrder && user && activePlan && (
          <RazorpayCheckout
            orderId={pendingOrder.orderId}
            amount={pendingOrder.amount}
            currency={pendingOrder.currency}
            keyId={pendingOrder.keyId}
            userName={user.username ?? user.email ?? 'User'}
            userEmail={user.email ?? ''}
            description={`AnimeHub ${activePlan.display_name}`}
            onSuccess={handlePaymentSuccess}
            onDismiss={handlePaymentDismiss}
            onCheckStatus={checkOrderStatus}
          />
        )}
      </Modal>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={COLORS.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Select Plan</Text>

        <View style={[styles.statusPill, isPremium ? styles.pillVip : styles.pillFree]}>
          <Text style={[styles.statusText, isPremium && { color: COLORS.neonGold }]}>
            {isPremium ? 'VIP' : 'FREE'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 108 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            AnimeHub <Text style={{ color: accent }}>VIP</Text>
          </Text>
          <Text style={styles.heroSub}>
            4K HDR · Zero Ads · Offline Downloads · 2 Screens
          </Text>
        </View>

        {/* ── Plan Cards ── */}
        <View style={styles.cardsRow}>

          {/* Yearly Card */}
          <TouchableOpacity
            style={[
              styles.card,
              isYearly
                ? { borderColor: COLORS.neonGold, borderWidth: 2, backgroundColor: 'rgba(255,214,0,0.09)' }
                : styles.cardInactive,
            ]}
            onPress={() => setSelectedCycle('yearly')}
            activeOpacity={0.85}
          >
            {/* Tag row */}
            <View style={styles.cardTopRow}>
              <View style={[styles.tag, { backgroundColor: isYearly ? COLORS.neonGold : 'rgba(255,255,255,0.07)' }]}>
                <Text style={[styles.tagTxt, { color: isYearly ? '#000' : COLORS.textMuted }]}>BEST VALUE</Text>
              </View>
              {isYearly && <Ionicons name="checkmark-circle" size={15} color={COLORS.neonGold} />}
            </View>

            <Text style={[styles.cycleName, { color: isYearly ? COLORS.neonGold : COLORS.textSub }]}>
              1 YEAR
            </Text>

            <View style={styles.priceRow}>
              <Text style={[styles.priceMain, !isYearly && { color: COLORS.textSub }]}>
                ₹{yearlyPerMonth}
              </Text>
              <Text style={styles.priceUnit}>/mo</Text>
            </View>

            <Text style={[styles.priceFull, !isYearly && { color: COLORS.textMuted }]}>
              {yearlyPriceStr} billed yearly
            </Text>
            <Text style={styles.strikeThrough}>₹1,188/yr</Text>

            <View style={styles.cardDivider} />

            {YEARLY_PERKS.map((p, i) => (
              <View key={i} style={styles.perkRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={12}
                  color={isYearly ? COLORS.neonGold : 'rgba(255,255,255,0.2)'}
                />
                <Text style={[styles.perkTxt, isYearly && { color: COLORS.text }]}>{p}</Text>
              </View>
            ))}
          </TouchableOpacity>

          {/* Monthly Card */}
          <TouchableOpacity
            style={[
              styles.card,
              !isYearly
                ? { borderColor: COLORS.neon, borderWidth: 2, backgroundColor: 'rgba(191,95,255,0.09)' }
                : styles.cardInactive,
            ]}
            onPress={() => setSelectedCycle('monthly')}
            activeOpacity={0.85}
          >
            {/* Tag row */}
            <View style={styles.cardTopRow}>
              <View style={[styles.tag, { backgroundColor: !isYearly ? COLORS.neon : 'rgba(255,255,255,0.07)' }]}>
                <Text style={[styles.tagTxt, { color: !isYearly ? '#fff' : COLORS.textMuted }]}>FLEXIBLE</Text>
              </View>
              {!isYearly && <Ionicons name="checkmark-circle" size={15} color={COLORS.neon} />}
            </View>

            <Text style={[styles.cycleName, { color: !isYearly ? COLORS.neon : COLORS.textSub }]}>
              MONTHLY
            </Text>

            <View style={styles.priceRow}>
              <Text style={[styles.priceMain, isYearly && { color: COLORS.textSub }]}>
                {monthlyPriceStr}
              </Text>
              <Text style={styles.priceUnit}>/mo</Text>
            </View>

            <Text style={[styles.priceFull, isYearly && { color: COLORS.textMuted }]}>
              Billed monthly
            </Text>
            <Text style={styles.strikeThrough}> </Text>

            <View style={styles.cardDivider} />

            {MONTHLY_PERKS.map((p, i) => (
              <View key={i} style={styles.perkRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={12}
                  color={!isYearly ? COLORS.neon : 'rgba(255,255,255,0.2)'}
                />
                <Text style={[styles.perkTxt, !isYearly && { color: COLORS.text }]}>{p}</Text>
              </View>
            ))}
          </TouchableOpacity>

        </View>

        {/* ── Comparison Table ── */}
        <View style={[styles.tableCard, { borderColor: `${accent}50` }]}>
          <View style={styles.tableHead}>
            <Text style={[styles.tableTitle, { color: accent }]}>WHAT'S INCLUDED</Text>
          </View>

          {/* Column headers */}
          <View style={styles.tableColRow}>
            <View style={styles.tColFeature}><Text style={styles.tColHead}>FEATURE</Text></View>
            <View style={styles.tColFree}><Text style={styles.tColHead}>FREE</Text></View>
            <View style={[styles.tColVip, { backgroundColor: `${accent}14` }]}>
              <Text style={[styles.tColHead, { color: accent }]}>VIP</Text>
            </View>
          </View>

          {comparisonFeatures.map((row, i) => (
            <View
              key={i}
              style={[
                styles.tRow,
                i % 2 === 1 && styles.tRowAlt,
                i === comparisonFeatures.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={styles.tColFeature}>
                <Text style={[styles.tFeatureTxt, row.bold && { color: COLORS.text, fontWeight: '700' }]}>
                  {row.feature}
                </Text>
              </View>
              <View style={styles.tColFree}>
                <Text style={styles.tFreeVal}>{row.free}</Text>
              </View>
              <View style={[styles.tColVip, { backgroundColor: `${accent}0D` }]}>
                <Text style={[styles.tVipVal, { color: accent }]}>{row.vip}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Order Summary ── */}
        <View style={[styles.summaryCard, { borderColor: `${accent}40` }]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Plan</Text>
            <Text style={styles.summaryVal}>
              {isYearly ? 'VIP Yearly · 365 days' : 'VIP Monthly · 30 days'}
            </Text>
          </View>
          {isYearly && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Savings</Text>
              <Text style={[styles.summaryVal, { color: COLORS.neonGold }]}>−₹389 (33% off)</Text>
            </View>
          )}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLbl}>Total Payable</Text>
            <Text style={[styles.summaryTotalVal, { color: accent }]}>
              {isYearly ? yearlyPriceStr : monthlyPriceStr}
            </Text>
          </View>
          <View style={styles.payRow}>
            <Ionicons name="shield-checkmark-outline" size={12} color={COLORS.neonCyan} />
            <Text style={styles.payTxt}>Razorpay · UPI · Cards · NetBanking</Text>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          Cancel anytime from Profile → Manage Plan. Activates instantly after payment.
        </Text>
      </ScrollView>

      {/* ── Sticky Bottom CTA ── */}
      <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: `${accent}35` }]}>
        <View style={styles.barLeft}>
          <Text style={[styles.barLabel, { color: accent }]}>
            {isYearly ? 'YEARLY · SAVE 33%' : 'MONTHLY'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
            <Text style={styles.barPrice}>{isYearly ? yearlyPriceStr : monthlyPriceStr}</Text>
            <Text style={styles.barUnit}>{isYearly ? '/yr' : '/mo'}</Text>
          </View>
        </View>

        {isPremium ? (
          <TouchableOpacity
            style={styles.manageBtn}
            onPress={() => router.push('/manage-plan' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="settings-outline" size={14} color={COLORS.neonGold} />
            <Text style={styles.manageBtnTxt}>Manage VIP</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.ctaBtn, (upgrading || verifyingPending) && { opacity: 0.65 }]}
            onPress={handleUpgrade}
            disabled={upgrading || verifyingPending || !activePlan}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={isYearly ? ['#FFD600', '#FFA500'] : ['#BF5FFF', '#7B2FBE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              {upgrading || verifyingPending ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Text style={styles.ctaTxt}>{isYearly ? 'Get Yearly VIP' : 'Get Monthly VIP'}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#000" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.bg },
  center:      { alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingText: { fontSize: 13, color: COLORS.textSub },

  // Header
  header:      {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: COLORS.bg,
  },
  closeBtn:    {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  statusPill:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  pillVip:     { backgroundColor: 'rgba(255,214,0,0.1)',    borderColor: 'rgba(255,214,0,0.3)'    },
  pillFree:    { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
  statusText:  { fontSize: 10, fontWeight: '800', color: COLORS.textSub, letterSpacing: 0.5 },

  scroll: { padding: SPACING.md, gap: 12 },

  // Hero
  hero:     { alignItems: 'center', paddingVertical: SPACING.sm },
  heroTitle:{ fontSize: 28, fontWeight: '900', color: COLORS.text, textAlign: 'center' },
  heroSub:  { fontSize: 12, color: COLORS.textSub, textAlign: 'center', marginTop: 5, lineHeight: 18 },

  // Cards
  cardsRow:    { flexDirection: 'row', gap: 10 },
  card:        {
    flex: 1,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
  },
  cardInactive: { borderColor: 'rgba(255,255,255,0.08)' },

  cardTopRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  tag:         { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  tagTxt:      { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },

  cycleName:   { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, marginBottom: 8 },
  priceRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  priceMain:   { fontSize: 26, fontWeight: '900', color: COLORS.text },
  priceUnit:   { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  priceFull:   { fontSize: 10, color: COLORS.neonGold, fontWeight: '700', marginTop: 2 },
  strikeThrough: { fontSize: 10, color: COLORS.textMuted, textDecorationLine: 'line-through', marginTop: 1 },

  cardDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 8 },
  perkRow:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  perkTxt:     { fontSize: 10, color: COLORS.textMuted, flex: 1, fontWeight: '500' },

  // Comparison Table
  tableCard:    {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg,
    borderWidth: 1, overflow: 'hidden',
  },
  tableHead:    {
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tableTitle:   { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  tableColRow:  {
    flexDirection: 'row', backgroundColor: COLORS.bgElevated,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tColHead:     { fontSize: 9, fontWeight: '900', color: COLORS.textSub, letterSpacing: 0.8, textAlign: 'center' },
  tColFeature:  { flex: 2, paddingLeft: SPACING.md, justifyContent: 'center' },
  tColFree:     { flex: 1.2, alignItems: 'center', justifyContent: 'center' },
  tColVip:      { flex: 1.6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tRow:         {
    flexDirection: 'row', alignItems: 'center', minHeight: 38,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)', paddingVertical: 5,
  },
  tRowAlt:      { backgroundColor: 'rgba(255,255,255,0.015)' },
  tFeatureTxt:  { fontSize: 11, color: COLORS.textSub },
  tFreeVal:     { fontSize: 10, color: COLORS.textMuted, textAlign: 'center' },
  tVipVal:      { fontSize: 10, fontWeight: '800', textAlign: 'center' },

  // Order Summary
  summaryCard:     {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.md,
    borderWidth: 1, padding: 12, gap: 8,
  },
  summaryRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel:    { fontSize: 12, color: COLORS.textSub },
  summaryVal:      { fontSize: 12, fontWeight: '700', color: COLORS.text },
  summaryDivider:  { height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  summaryTotalLbl: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  summaryTotalVal: { fontSize: 20, fontWeight: '900' },
  payRow:          { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  payTxt:          { fontSize: 10, color: COLORS.textMuted },

  disclaimer: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', lineHeight: 14 },

  // Sticky Bar
  stickyBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(10,10,18,0.98)',
    borderTopWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: 10, gap: 10,
  },
  barLeft:   { flex: 1 },
  barLabel:  { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 1 },
  barPrice:  { fontSize: 22, fontWeight: '900', color: COLORS.text },
  barUnit:   { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },

  ctaBtn:    { flex: 1.3, borderRadius: RADIUS.md, overflow: 'hidden' },
  ctaGrad:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, paddingHorizontal: 16,
  },
  ctaTxt:    { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 0.3 },

  manageBtn:    {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,214,0,0.1)', borderWidth: 1, borderColor: COLORS.neonGold,
    borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 14,
  },
  manageBtnTxt: { fontSize: 13, fontWeight: '800', color: COLORS.neonGold },
});
