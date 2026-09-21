/**
 * app/premium.tsx
 *
 * Senior Dev Redesigned Fast-Track Premium Upgrade Screen.
 * Opened when users hit a premium gate (4K streaming, premium episodes, downloads).
 *
 * Integrates:
 *   - Cyberpunk hero showcase with glowing gold accents.
 *   - Bulletproof Razorpay checkout with UPI deep link handling and
 *     status check recovery (no false "Payment Cancelled").
 *   - Seamless comparison link to /plans.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { supabase, SubscriptionPlan } from '../src/lib/supabase';
import { usePlans, formatPrice, formatPeriod } from '../src/hooks/usePlans';
import RazorpayCheckout, { RazorpayPaymentResult } from '../src/components/ui/RazorpayCheckout';
import PlanCard from '../src/components/subscription/PlanCard';

const PERKS = [
  { icon: 'film-outline',     text: 'All premium anime episodes unlocked' },
  { icon: 'ban-outline',      text: 'Completely ad-free streaming' },
  { icon: 'tv-outline',       text: '4K Ultra HD + HDR quality' },
  { icon: 'download-outline', text: 'Unlimited offline downloads' },
  { icon: 'people-outline',   text: 'Watch on 2 devices at once' },
  { icon: 'server-outline',   text: 'Multi-server ultra-fast streaming' },
];

export default function PremiumUpgradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  const { data: plansData, isLoading } = usePlans();
  const premiumPlans = useMemo(
    () => (plansData?.plans ?? []).filter(p => p.tier === 'premium'),
    [plansData],
  );
  const monthlyPlan = useMemo(
    () => premiumPlans.find(p => p.billing_cycle === 'monthly'),
    [premiumPlans],
  );
  const yearlyPlan = useMemo(
    () => premiumPlans.find(p => p.billing_cycle === 'yearly'),
    [premiumPlans],
  );

  const defaultPlan = yearlyPlan || premiumPlans[0] || null;
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const activePlan = selectedPlan ?? defaultPlan;

  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Razorpay checkout modal state
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<{
    orderId:  string;
    amount:   number;
    currency: string;
    keyId:    string;
  } | null>(null);

  // ── Step 1: Create Order ──────────────────────────────────────────────────
  const handleUpgrade = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!activePlan) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/razorpay-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action:       'create-order',
            planId:       activePlan.id,
            userId:       user.id,
            billingCycle: activePlan.billing_cycle,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed to initialize payment');

      setPendingOrder({
        orderId:  json.orderId,
        amount:   json.amount,
        currency: json.currency,
        keyId:    json.keyId,
      });
      setCheckoutVisible(true);
    } catch (err: any) {
      Alert.alert('Payment Error', err?.message ?? 'Could not start checkout. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: In-App Verification ───────────────────────────────────────────
  const handlePaymentSuccess = async (result: RazorpayPaymentResult) => {
    setCheckoutVisible(false);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/razorpay-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action:       'verify-payment',
            orderId:      result.orderId,
            paymentId:    result.paymentId,
            signature:    result.signature,
            userId:       user!.id,
            planId:       activePlan?.id,
            billingCycle: activePlan?.billing_cycle,
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Payment verification failed');

      await refreshUser();

      Alert.alert(
        '🎉 Welcome to Premium!',
        `Your ${activePlan?.display_name} subscription is now active. Enjoy unrestricted 4K anime!`,
        [{ text: 'Start Watching', onPress: () => router.back() }],
      );
    } catch {
      Alert.alert(
        'Verification Notice',
        `Payment was processed. If your account is not upgraded immediately, please save Payment ID: ${result.paymentId} and contact support@animehub.app.`,
        [{ text: 'OK' }],
      );
    } finally {
      setLoading(false);
      setPendingOrder(null);
    }
  };

  // ── Step 3: Check Order Status (UPI app recovery) ──────────────────────────
  const checkOrderStatus = useCallback(async (): Promise<boolean> => {
    if (!pendingOrder || !user) return false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/razorpay-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action:       'check-order-status',
            orderId:      pendingOrder.orderId,
            userId:       user.id,
            planId:       activePlan?.id,
            billingCycle: activePlan?.billing_cycle,
          }),
        },
      );

      const json = await res.json();
      if (json?.status === 'paid') {
        await refreshUser();
        setCheckoutVisible(false);
        setPendingOrder(null);
        Alert.alert(
          '🎉 Welcome to Premium!',
          'Your payment was verified successfully. Enjoy AnimeHub Premium!',
          [{ text: 'Start Watching', onPress: () => router.back() }],
        );
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [pendingOrder, user, activePlan, refreshUser, router]);

  // ── Step 4: Dismiss Checkout (No false "Cancelled" popups) ─────────────────
  const handlePaymentDismiss = async (reason?: string) => {
    if (pendingOrder && user) {
      setCheckingStatus(true);
      const paid = await checkOrderStatus();
      setCheckingStatus(false);
      if (paid) return;
    }

    setCheckoutVisible(false);
    setPendingOrder(null);

    if (
      reason &&
      reason !== 'User cancelled' &&
      !reason.toLowerCase().includes('cancelled by user') &&
      !reason.toLowerCase().includes('user dismissed')
    ) {
      Alert.alert('Payment Incomplete', reason);
    }
  };

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
            userName={user.username ?? user.email ?? 'AnimeHub User'}
            userEmail={user.email ?? ''}
            description={`AnimeHub Premium ${activePlan.display_name}`}
            onSuccess={handlePaymentSuccess}
            onDismiss={handlePaymentDismiss}
            onCheckStatus={checkOrderStatus}
          />
        )}
      </Modal>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header Close */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Hero Banner */}
        <LinearGradient
          colors={['rgba(255, 214, 0, 0.16)', 'rgba(191, 95, 255, 0.08)', 'transparent']}
          style={styles.hero}
        >
          <View style={styles.crownWrap}>
            <Ionicons name="star" size={44} color={COLORS.neonGold} />
          </View>
          <Text style={styles.heroPretitle}>ANIMEHUB VIP ACCESS</Text>
          <Text style={styles.heroTitle}>Unlock Premium</Text>
          <Text style={styles.heroSubtitle}>
            Immerse yourself in top-tier anime with zero interruptions.
          </Text>
        </LinearGradient>

        {/* Perks Card */}
        <View style={styles.perksCard}>
          <Text style={styles.perksHeader}>WHAT YOU GET</Text>
          {PERKS.map((perk, i) => (
            <View key={i} style={styles.perkRow}>
              <View style={styles.perkIconWrap}>
                <Ionicons name={perk.icon as any} size={15} color={COLORS.neonGold} />
              </View>
              <Text style={styles.perkText}>{perk.text}</Text>
            </View>
          ))}
        </View>

        {/* Plan Cards Selection */}
        <Text style={styles.sectionTitle}>// SELECT A TIER</Text>
        <View style={styles.plansContainer}>
          {premiumPlans.map(plan => {
            const isSelected = activePlan?.id === plan.id;
            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                isSelected={isSelected}
                isCurrent={user?.subscription_type === 'premium'}
                onSelect={() => setSelectedPlan(plan)}
                monthlyReferencePricePaise={monthlyPlan?.price_paise ?? 9900}
              />
            );
          })}
        </View>

        {/* Upgrade CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, (loading || checkingStatus) && { opacity: 0.7 }]}
          onPress={handleUpgrade}
          disabled={loading || checkingStatus || !activePlan}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={['#FFD600', '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            {loading || checkingStatus ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <Ionicons name="star" size={18} color="#000" />
                <Text style={styles.ctaText}>
                  {activePlan
                    ? `GET ${activePlan.display_name.toUpperCase()} · ${formatPrice(activePlan)}${formatPeriod(activePlan)}`
                    : 'UPGRADE TO PREMIUM'
                  }
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Full Comparison Link */}
        <TouchableOpacity
          style={styles.compareLink}
          onPress={() => router.push('/plans')}
          activeOpacity={0.8}
        >
          <Text style={styles.compareLinkText}>View Full Feature Table & FAQs →</Text>
        </TouchableOpacity>

        {/* Trust Badges */}
        <View style={styles.trustBanner}>
          <View style={styles.trustRow}>
            <Ionicons name="shield-checkmark" size={14} color={COLORS.neonCyan} />
            <Text style={styles.trustText}>Razorpay 256-Bit SSL Checkout</Text>
          </View>
          <View style={styles.trustRow}>
            <Ionicons name="flash" size={14} color={COLORS.neonGold} />
            <Text style={styles.trustText}>Instant Activation · Cancel Anytime</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hero: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  crownWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 214, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 0, 0.3)',
    marginBottom: SPACING.sm,
  },
  heroPretitle: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.neonGold,
    letterSpacing: 2,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 1,
    marginTop: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
  perksCard: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(191, 95, 255, 0.2)',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  perksHeader: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.neonGold,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  perkIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,214,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.neon,
    letterSpacing: 1.5,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  plansContainer: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  ctaBtn: {
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 16,
  },
  ctaText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  compareLink: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  compareLinkText: {
    color: COLORS.neonGold,
    fontWeight: '700',
    fontSize: 13,
  },
  trustBanner: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: 6,
    alignItems: 'center',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    fontSize: 11,
    color: COLORS.textSub,
  },
});
