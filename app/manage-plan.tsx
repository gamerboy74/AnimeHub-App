/**
 * app/manage-plan.tsx
 *
 * Subscription management screen for premium users.
 *
 * Architecture (senior dev approach):
 * - Plan metadata (billing_cycle, subscribed_at) stored in user_preferences
 *   since we don't have a dedicated subscriptions table.
 * - Cancel = downgrade to free immediately (no grace period in demo mode;
 *   production would use a webhook from Razorpay/Stripe to set end_date).
 * - All destructive actions are double-confirmed.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { supabase, userAPI } from '../src/lib/supabase';
import { usePlans, formatPrice, formatPeriod } from '../src/hooks/usePlans';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────
type BillingCycle = 'monthly' | 'yearly' | 'admin_grant';

interface SubscriptionMeta extends Record<string, unknown> {
  billing_cycle: BillingCycle;
  subscribed_at: string;
  next_renewal: string;
  plan_name?: string;
  cancel_at_period_end?: boolean;
  cancelled_at?: string;
}

interface PremiumStats {
  total_episodes_watched: number;
  premium_episodes_watched: number;
  total_watch_time_hours: number;
}

interface UserPayment {
  id: string;
  plan_name: string;
  billing_cycle: string;
  amount_paise: number;
  currency: string;
  status: string;
  period_start: string;
  period_end: string;
  razorpay_payment_id: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

const PLAN_LABELS: Record<BillingCycle, string> = {
  monthly:     'Monthly',
  yearly:      'Yearly',
  admin_grant: 'Admin Grant',
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ManagePlanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: plansData } = usePlans();

  const [actionLoading, setActionLoading] = useState(false);
  const [billingHistoryVisible, setBillingHistoryVisible] = useState(false);
  const [cancelDialogVisible, setCancelDialogVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // 1. Subscription preferences (cached with settings.tsx)
  const { data: prefs, isLoading: loadingPrefs } = useQuery({
    queryKey: ['user', user?.id, 'preferences'],
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await userAPI.getPreferences(user!.id);
      return data;
    },
  });

  // 2. User stats (cached with stats.tsx)
  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ['user', user?.id, 'stats-summary'],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!user?.id,
    queryFn: async () => {
      const statsRes = await userAPI.getUserStats(user!.id);
      return {
        allProgress: [],
        watchlist: [],
        dbStats: statsRes && !statsRes.error && statsRes.data ? statsRes.data : null,
        dbBadges: [],
      };
    },
  });

  // 3. Billing payments history (lazy-enabled when modal opens)
  const { data: payments = [], isLoading: loadingPayments } = useQuery<UserPayment[]>({
    queryKey: ['user', user?.id, 'payments'],
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!user?.id && billingHistoryVisible,
    queryFn: async () => {
      const { data } = await userAPI.getUserPayments(user!.id);
      return (data as UserPayment[]) ?? [];
    },
  });

  const loading = loadingPrefs || loadingStats;

  const monthlyPlan = plansData?.plans.find(p => p.billing_cycle === 'monthly');
  const yearlyPlan = plansData?.plans.find(p => p.billing_cycle === 'yearly');

  const getPlanPrice = useCallback((cycle?: BillingCycle) => {
    if (!cycle) return '';
    if (cycle === 'admin_grant') return 'Complimentary';
    if (cycle === 'yearly') {
      return yearlyPlan ? `${formatPrice(yearlyPlan)}${formatPeriod(yearlyPlan)}` : '₹799/yr';
    }
    return monthlyPlan ? `${formatPrice(monthlyPlan)}${formatPeriod(monthlyPlan)}` : '₹99/mo';
  }, [monthlyPlan, yearlyPlan]);

  // Derived subscription metadata from single source of truth + prefs cache
  const meta: SubscriptionMeta | null = useMemo(() => {
    if (!user) return null;
    const legacyMeta = prefs?.subscription_meta as SubscriptionMeta | null | undefined;
    const cycle = (user.billing_cycle ?? legacyMeta?.billing_cycle) as BillingCycle | undefined;
    const renewal = user.subscription_expires_at ?? legacyMeta?.next_renewal;
    const subscribed = user.subscription_started_at ?? legacyMeta?.subscribed_at ?? user.created_at ?? new Date().toISOString();
    const cancelAtEnd = user.cancel_at_period_end ?? legacyMeta?.cancel_at_period_end ?? false;

    if (cycle) {
      return {
        billing_cycle: cycle,
        subscribed_at: subscribed,
        next_renewal: renewal ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
        cancel_at_period_end: cancelAtEnd,
        cancelled_at: legacyMeta?.cancelled_at,
      };
    }
    return {
      billing_cycle: 'admin_grant',
      subscribed_at: subscribed,
      next_renewal: new Date('2099-12-31').toISOString(),
    };
  }, [user, prefs]);

  const stats: PremiumStats | null = useMemo(() => {
    const s = statsData?.dbStats;
    if (!s) return null;
    return {
      total_episodes_watched: s.total_episodes_watched ?? 0,
      premium_episodes_watched: s.premium_episodes_watched ?? 0,
      total_watch_time_hours: Math.round((s.total_watch_time ?? 0) / 3600),
    };
  }, [statsData?.dbStats]);

  const switchSubtext = React.useMemo(() => {
    if (meta?.billing_cycle === 'monthly') {
      if (yearlyPlan) {
        const yearlyFormatted = formatPrice(yearlyPlan);
        const monthlyPaise = monthlyPlan?.price_paise ?? 9900;
        const annualizedMonthly = (monthlyPaise * 12) / 100;
        const savings = yearlyPlan.savings_text ? `${yearlyPlan.savings_text} · ` : '';
        return `${savings}${yearlyFormatted}/year instead of ₹${annualizedMonthly}`;
      }
      return 'Save 33% · ₹799/year instead of ₹1188';
    }
    const monthlyFormatted = monthlyPlan ? `${formatPrice(monthlyPlan)}/month` : '₹99/month';
    return `Billed monthly at ${monthlyFormatted}`;
  }, [meta?.billing_cycle, monthlyPlan, yearlyPlan]);

  // ── Switch billing cycle (monthly ↔ yearly) ───────────────────────────────
  const handleSwitchCycle = useCallback(() => {
    if (!meta) return;
    const targetCycle = meta.billing_cycle === 'monthly' ? 'yearly' : 'monthly';
    const targetPrice = getPlanPrice(targetCycle);

    Alert.alert(
      `Switch to ${PLAN_LABELS[targetCycle]}?`,
      `To switch to the ${PLAN_LABELS[targetCycle]} plan (${targetPrice}), please proceed to Plans to complete the checkout securely with Razorpay.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `View Plans & Switch`,
          onPress: () => {
            router.push('/plans');
          },
        },
      ],
    );
  }, [meta, getPlanPrice, router]);

  // ── Cancel auto-renewal — opens styled dialog ────────────────────────────
  const handleCancel = useCallback(() => {
    if (!meta || !user) return;
    setCancelDialogVisible(true);
  }, [meta, user]);

  const confirmCancel = useCallback(async () => {
    if (!meta || !user) return;
    const expiryStr = meta.next_renewal ? formatDate(meta.next_renewal) : 'end of current cycle';
    setCancelling(true);
    try {
      // 1. Update single source of truth on users table
      await userAPI.updateSubscriptionAutoRenew(user.id, true);

      // 2. Also mirror to preferences for legacy compatibility
      const updatedMeta: SubscriptionMeta = {
        ...meta,
        cancel_at_period_end: true,
        cancelled_at: new Date().toISOString(),
      };
      await userAPI.updateSubscriptionMeta(user.id, updatedMeta);
      await queryClient.invalidateQueries({ queryKey: ['user', user.id, 'preferences'] });
      await refreshUser();
      setCancelDialogVisible(false);
      Alert.alert('Auto-Renewal Cancelled', `Premium access stays active until ${expiryStr}. No future charges.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to cancel. Try again.');
    } finally {
      setCancelling(false);
    }
  }, [meta, user, refreshUser, queryClient]);

  // ── Reactivate auto-renewal ───────────────────────────────────────────────
  const handleReactivate = useCallback(async () => {
    if (!meta || !user) return;
    setActionLoading(true);
    try {
      // 1. Restore auto-renewal on users table
      await userAPI.updateSubscriptionAutoRenew(user.id, false);

      // 2. Also mirror to preferences for legacy compatibility
      const updatedMeta: SubscriptionMeta = {
        ...meta,
        cancel_at_period_end: false,
        cancelled_at: undefined,
      };
      await userAPI.updateSubscriptionMeta(user.id, updatedMeta);
      await queryClient.invalidateQueries({ queryKey: ['user', user.id, 'preferences'] });
      await refreshUser();

      Alert.alert(
        'Subscription Reactivated',
        `Auto-renewal is restored. Your next billing date is ${formatDate(meta.next_renewal)}.`,
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to reactivate. Try again.');
    } finally {
      setActionLoading(false);
    }
  }, [meta, user, refreshUser, queryClient]);

  // ── Render ────────────────────────────────────────────────────────────────
  const isExpired = Boolean(
    user?.subscription_expires_at &&
    user.billing_cycle !== 'admin_grant' &&
    new Date(user.subscription_expires_at).getTime() <= Date.now()
  );

  if (!user || user.subscription_type !== 'premium' || isExpired) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="star-outline" size={48} color={COLORS.textMuted} />
        <Text style={styles.emptyText}>No active premium subscription.</Text>
        <TouchableOpacity
          style={styles.upgradeBtn}
          onPress={() => router.replace('/plans' as any)}
        >
          <Text style={styles.upgradeBtnText}>Explore Premium Plans</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const daysLeft = meta ? daysUntil(meta.next_renewal) : null;
  const renewalUrgent = daysLeft !== null && daysLeft <= 7;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerLabel}>// SUBSCRIPTION</Text>
          <Text style={styles.headerTitle}>Manage Plan</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Active Plan Card */}
        <LinearGradient
          colors={['rgba(255,214,0,0.18)', 'rgba(255,140,0,0.08)', 'transparent']}
          style={styles.planCard}
        >
          <View style={styles.planCardTop}>
            <View>
              <View style={styles.planBadge}>
                <Ionicons name="star" size={12} color="#000" />
                <Text style={styles.planBadgeText}>ACTIVE</Text>
              </View>
              <Text style={styles.planName}>
                Premium{meta && meta.billing_cycle !== 'admin_grant' ? ` ${PLAN_LABELS[meta.billing_cycle]}` : ''}
              </Text>
              <Text style={styles.planPrice}>
                {meta ? getPlanPrice(meta.billing_cycle) : ''}
              </Text>
              {meta?.billing_cycle === 'admin_grant' && (
                <Text style={styles.adminGrantNote}>
                  ✦ Granted by admin
                </Text>
              )}
            </View>
            <View style={styles.planIconWrap}>
              <Ionicons name="star" size={36} color={COLORS.neonGold} />
            </View>
          </View>

          {/* Renewal info */}
          {loading ? (
            <ActivityIndicator color={COLORS.neonGold} style={{ marginTop: SPACING.md }} />
          ) : meta ? (
            <View style={styles.renewalSection}>
              {meta.billing_cycle === 'admin_grant' ? (
                // Admin grants: no renewal date shown
                <View style={styles.renewalRow}>
                  <Ionicons name="shield-checkmark" size={16} color={COLORS.neonGold} />
                  <Text style={styles.renewalText}>Lifetime access granted by admin</Text>
                </View>
              ) : meta.cancel_at_period_end ? (
                // Cancelled: retains access until end of paid period
                <View style={[styles.renewalRow, { backgroundColor: 'rgba(255, 82, 82, 0.12)', borderColor: 'rgba(255, 82, 82, 0.35)' }]}>
                  <Ionicons name="time-outline" size={16} color="#FF5252" />
                  <Text style={[styles.renewalText, { color: '#FF5252', fontWeight: '700' }]}>
                    Cancels on {formatDate(meta.next_renewal)} · Access remains active
                  </Text>
                </View>
              ) : (
                <View style={[styles.renewalRow, renewalUrgent && styles.renewalUrgent]}>
                  <Ionicons
                    name={renewalUrgent ? 'warning' : 'calendar-outline'}
                    size={16}
                    color={renewalUrgent ? COLORS.neonPink : COLORS.neonGold}
                  />
                  <Text style={[styles.renewalText, renewalUrgent && { color: COLORS.neonPink }]}>
                    {renewalUrgent
                      ? `Renews in ${daysLeft} day${daysLeft === 1 ? '' : 's'} · ${formatDate(meta.next_renewal)}`
                      : `Next renewal: ${formatDate(meta.next_renewal)}`
                    }
                  </Text>
                </View>
              )}
              <Text style={styles.subscribedText}>
                Member since {formatDate(meta.subscribed_at)}
              </Text>
            </View>
          ) : null}
        </LinearGradient>

        {/* Usage Stats */}
        <Text style={styles.sectionLabel}>// YOUR USAGE</Text>
        <View style={styles.statsGrid}>
          <StatTile
            icon="play-circle"
            value={stats?.total_episodes_watched?.toString() ?? '—'}
            label="Episodes Watched"
            color={COLORS.neon}
          />
          <StatTile
            icon="star"
            value={stats?.premium_episodes_watched?.toString() ?? '—'}
            label="Premium Episodes"
            color={COLORS.neonGold}
          />
          <StatTile
            icon="time"
            value={stats?.total_watch_time_hours?.toString() ?? '—'}
            label="Hours Streamed"
            color={COLORS.neonCyan}
          />
        </View>

        {/* Plan Perks Summary */}
        <Text style={styles.sectionLabel}>// WHAT YOU GET</Text>
        <View style={styles.perksCard}>
          {[
            { icon: 'star', text: 'All premium episodes unlocked' },
            { icon: 'ban', text: 'Zero ads, ever' },
            { icon: 'film', text: '1080p Full HD streaming' },
            { icon: 'time', text: 'Early access to new episodes' },
            { icon: 'people', text: 'Watch on 2 devices simultaneously' },
          ].map((perk, i) => (
            <View key={i} style={styles.perkRow}>
              <View style={styles.perkDot} />
              <Ionicons name={perk.icon as any} size={15} color={COLORS.neonGold} />
              <Text style={styles.perkText}>{perk.text}</Text>
            </View>
          ))}
        </View>

        {/* Plan Actions */}
        <Text style={styles.sectionLabel}>// PLAN ACTIONS</Text>
        <View style={styles.actionsCard}>
          {/* Switch cycle — hide for admin grants */}
          {meta?.billing_cycle !== 'admin_grant' && (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleSwitchCycle}
              disabled={actionLoading}
            >
              <View style={styles.actionLeft}>
                <Ionicons name="swap-horizontal" size={20} color={COLORS.neon} />
                <View>
                  <Text style={styles.actionTitle}>
                    Switch to {meta?.billing_cycle === 'monthly' ? 'Yearly' : 'Monthly'}
                  </Text>
                  <Text style={styles.actionSub}>
                    {switchSubtext}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
          {meta?.billing_cycle !== 'admin_grant' && <View style={styles.divider} />}

          {/* Billing history */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              if (!user) return;
              setBillingHistoryVisible(true);
            }}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="receipt-outline" size={20} color={COLORS.neonCyan} />
              <View>
                <Text style={styles.actionTitle}>Billing History</Text>
                <Text style={styles.actionSub}>View past invoices and receipts</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

        </View>

        {/* Danger Zone */}
        <Text style={[styles.sectionLabel, { color: meta?.cancel_at_period_end ? COLORS.neonGold : COLORS.danger }]}>
          // {meta?.cancel_at_period_end ? 'SUBSCRIPTION STATUS' : 'DANGER ZONE'}
        </Text>
        <View style={[styles.actionsCard, meta?.cancel_at_period_end ? { borderColor: 'rgba(255,214,0,0.3)' } : styles.dangerCard]}>
          {meta?.cancel_at_period_end ? (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleReactivate}
              disabled={actionLoading}
            >
              <View style={styles.actionLeft}>
                {actionLoading
                  ? <ActivityIndicator size="small" color={COLORS.neonGold} />
                  : <Ionicons name="refresh-circle-outline" size={20} color={COLORS.neonGold} />
                }
                <View>
                  <Text style={[styles.actionTitle, { color: COLORS.neonGold }]}>Reactivate Auto-Renewal</Text>
                  <Text style={styles.actionSub}>Resume continuous access without interruption</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleCancel}
              disabled={actionLoading}
            >
              <View style={styles.actionLeft}>
                {actionLoading
                  ? <ActivityIndicator size="small" color={COLORS.danger} />
                  : <Ionicons name="close-circle-outline" size={20} color={COLORS.danger} />
                }
                <View>
                  <Text style={[styles.actionTitle, { color: COLORS.danger }]}>Cancel Auto-Renewal</Text>
                  <Text style={styles.actionSub}>
                    Keep access until {meta?.next_renewal ? formatDate(meta.next_renewal) : 'cycle ends'}, zero future charges
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.footerNote}>
          Questions? Contact support@animehub.app{'\n'}
          Powered by Razorpay · Secured by SSL
        </Text>

      </ScrollView>

      {/* ── Billing History Modal ── */}
      <Modal
        visible={billingHistoryVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBillingHistoryVisible(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Billing History</Text>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setBillingHistoryVisible(false)}
            >
              <Ionicons name="close" size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {loadingPayments ? (
            <View style={styles.modalCenter}>
              <ActivityIndicator color={COLORS.neonGold} />
              <Text style={styles.modalLoadingTxt}>Fetching invoices…</Text>
            </View>
          ) : payments.length === 0 ? (
            <View style={styles.modalCenter}>
              <Ionicons name="receipt-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.modalEmptyTitle}>No payments yet</Text>
              <Text style={styles.modalEmptyTxt}>
                Future payments will appear here after your first Razorpay transaction.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {payments.map((p) => {
                const amount = `₹${(p.amount_paise / 100).toFixed(0)}`;
                const date = new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
                const periodEnd = new Date(p.period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                const isPaid = p.status === 'captured';
                return (
                  <View key={p.id} style={styles.invoiceRow}>
                    <View style={[styles.invoiceStatus, { backgroundColor: isPaid ? 'rgba(0,245,180,0.1)' : 'rgba(255,60,100,0.1)', borderColor: isPaid ? 'rgba(0,245,180,0.3)' : 'rgba(255,60,100,0.3)' }]}>
                      <Ionicons name={isPaid ? 'checkmark' : 'close'} size={12} color={isPaid ? COLORS.success : COLORS.danger} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invoicePlan}>VIP {p.plan_name}</Text>
                      <Text style={styles.invoiceDate}>{date} · until {periodEnd}</Text>
                      <Text style={styles.invoiceId} numberOfLines={1}>
                        ID: {p.razorpay_payment_id}
                      </Text>
                    </View>
                    <Text style={styles.invoiceAmount}>{amount}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* ── Cancel Auto-Renewal Confirmation Sheet ── */}
      <Modal
        visible={cancelDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !cancelling && setCancelDialogVisible(false)}
      >
        <Pressable
          style={styles.cancelOverlay}
          onPress={() => !cancelling && setCancelDialogVisible(false)}
        />
        <BlurView intensity={95} tint="dark" style={styles.cancelSheet}>
          <View style={styles.cancelGlow} />
          <View style={styles.cancelHandle} />

          <View style={styles.cancelIconWrap}>
            <Ionicons name="warning-outline" size={28} color={COLORS.danger} />
          </View>

          <Text style={styles.cancelTitle}>Cancel Auto-Renewal?</Text>
          <Text style={styles.cancelDescription}>
            Your VIP benefits will remain active until{' '}
            <Text style={{ color: COLORS.neonGold, fontWeight: '700' }}>
              {meta?.next_renewal ? formatDate(meta.next_renewal) : 'end of current cycle'}
            </Text>
            . No additional charges will be made.
          </Text>

          <View style={styles.cancelBenefitsCard}>
            <View style={styles.cancelBenefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.cancelBenefitTxt}>Uninterrupted 1080p Full HD streaming until period ends</Text>
            </View>
            <View style={styles.cancelBenefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.cancelBenefitTxt}>Keep offline downloads & ad-free access</Text>
            </View>
            <View style={styles.cancelBenefitRow}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.cancelBenefitTxt}>Zero surprise auto-renewal charges</Text>
            </View>
          </View>

          <View style={styles.cancelActions}>
            <TouchableOpacity
              style={styles.keepBtn}
              onPress={() => setCancelDialogVisible(false)}
              disabled={cancelling}
              activeOpacity={0.85}
            >
              <Text style={styles.keepBtnText}>Keep Subscription</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.confirmCancelBtn}
              onPress={confirmCancel}
              disabled={cancelling}
              activeOpacity={0.8}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color={COLORS.danger} />
              ) : (
                <Text style={styles.confirmCancelText}>Yes, Cancel Auto-Renewal</Text>
              )}
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </View>
  );
}

// ─── StatTile ─────────────────────────────────────────────────────────────────
function StatTile({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) {
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon as any} size={22} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: SPACING.md },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  headerLabel: { fontSize: 10, color: COLORS.neonGold, fontWeight: '800', letterSpacing: 2 },
  headerTitle: { fontSize: 20, color: COLORS.text, fontWeight: '900' },

  scroll: { padding: SPACING.md, paddingBottom: 80, gap: SPACING.sm },

  // Plan card
  planCard: {
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: 'rgba(255,214,0,0.25)',
    padding: SPACING.lg, marginBottom: SPACING.md,
  },
  planCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.neonGold, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start',
    marginBottom: SPACING.xs,
  },
  planBadgeText: { fontSize: 9, fontWeight: '900', color: '#000', letterSpacing: 1 },
  planName: { fontSize: 22, color: COLORS.text, fontWeight: '900' },
  planPrice: { fontSize: 15, color: COLORS.neonGold, fontWeight: '700', marginTop: 2 },
  adminGrantNote: { fontSize: 11, color: COLORS.neonCyan, fontWeight: '600', marginTop: 4 },
  planIconWrap: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(255,214,0,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,214,0,0.25)',
  },
  renewalSection: { marginTop: SPACING.md, gap: SPACING.xs },
  renewalRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
    backgroundColor: 'rgba(255,214,0,0.08)',
    borderRadius: RADIUS.sm, padding: SPACING.sm,
    borderWidth: 1, borderColor: 'rgba(255,214,0,0.15)',
  },
  renewalUrgent: {
    backgroundColor: 'rgba(255,60,100,0.08)',
    borderColor: 'rgba(255,60,100,0.2)',
  },
  renewalText: { fontSize: 13, color: COLORS.neonGold, fontWeight: '600', flex: 1 },
  subscribedText: { fontSize: 11, color: COLORS.textMuted, paddingHorizontal: 2 },

  // Section labels
  sectionLabel: {
    fontSize: 10, color: COLORS.neon, fontWeight: '800', letterSpacing: 2,
    marginTop: SPACING.md, marginBottom: SPACING.xs,
  },

  // Stats
  statsGrid: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  statTile: {
    flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, alignItems: 'center', gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', fontWeight: '600' },

  // Perks
  perksCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  perkDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.neonGold },
  perkText: { fontSize: 13, color: COLORS.text, flex: 1 },

  // Actions
  actionsCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden', marginBottom: SPACING.sm,
  },
  dangerCard: { borderColor: 'rgba(255,60,100,0.2)' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: SPACING.md,
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  actionTitle: { fontSize: 14, color: COLORS.text, fontWeight: '700' },
  actionSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.md },

  // Footer
  footerNote: {
    textAlign: 'center', fontSize: 11, color: COLORS.textMuted,
    lineHeight: 18, marginTop: SPACING.md,
  },

  // Empty state
  emptyText: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center' },
  upgradeBtn: {
    backgroundColor: COLORS.neonGold, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm,
  },
  upgradeBtnText: { color: '#000', fontWeight: '900' },

  // Billing History Modal
  modalRoot:       { flex: 1, backgroundColor: COLORS.bg },
  modalHeader:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  modalTitle:      { fontSize: 17, fontWeight: '800', color: COLORS.text },
  modalCloseBtn:   {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  modalCenter:     {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    padding: SPACING.xl,
  },
  modalLoadingTxt: { fontSize: 13, color: COLORS.textSub },
  modalEmptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  modalEmptyTxt:   { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
  modalScroll:     { padding: SPACING.md, gap: SPACING.sm },

  invoiceRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: SPACING.md,
  },
  invoiceStatus: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  invoicePlan:   { fontSize: 13, fontWeight: '700', color: COLORS.text },
  invoiceDate:   { fontSize: 11, color: COLORS.textSub, marginTop: 1 },
  invoiceId:     { fontSize: 9, color: COLORS.textMuted, marginTop: 2, fontFamily: 'monospace' },
  invoiceAmount: { fontSize: 15, fontWeight: '900', color: COLORS.neonGold },

  // Cancel Auto-Renewal Dialog / Bottom Sheet
  cancelOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 4, 8, 0.78)',
  },
  cancelSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: 40,
    backgroundColor: 'rgba(14, 14, 24, 0.96)',
    borderTopWidth: 1.5,
    borderColor: 'rgba(255, 60, 100, 0.3)',
    overflow: 'hidden',
    alignItems: 'center',
  },
  cancelGlow: {
    position: 'absolute',
    top: -50,
    alignSelf: 'center',
    width: 180,
    height: 180,
    backgroundColor: COLORS.danger,
    borderRadius: 90,
    opacity: 0.12,
  },
  cancelHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: SPACING.lg,
  },
  cancelIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 60, 100, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 60, 100, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  cancelTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  cancelDescription: {
    fontSize: 13,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  cancelBenefitsCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  cancelBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cancelBenefitTxt: {
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: '500',
    flex: 1,
  },
  cancelActions: {
    width: '100%',
    gap: SPACING.sm,
  },
  keepBtn: {
    width: '100%',
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.neonGold,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#080810',
    letterSpacing: 0.5,
  },
  confirmCancelBtn: {
    width: '100%',
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(255, 60, 100, 0.08)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 60, 100, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
});
