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

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { supabase, userAPI } from '../src/lib/supabase';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
type BillingCycle = 'monthly' | 'yearly' | 'admin_grant';

interface SubscriptionMeta {
  billing_cycle: BillingCycle;
  subscribed_at: string;
  next_renewal: string;
  plan_name?: string;
}

interface PremiumStats {
  total_episodes_watched: number;
  premium_episodes_watched: number;
  total_watch_time_hours: number;
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

const PLAN_PRICES: Record<BillingCycle, string> = {
  monthly:     '₹149/mo',
  yearly:      '₹999/yr',
  admin_grant: 'Complimentary',
};
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

  const [meta, setMeta] = useState<SubscriptionMeta | null>(null);
  const [stats, setStats] = useState<PremiumStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Load subscription metadata + usage stats ──────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      try {
        // 1. Load subscription metadata from user_preferences
        const { data: prefs } = await userAPI.getPreferences(user.id);
        // subscription_meta is a nested object inside prefs — read it correctly
        const existingMeta = prefs?.subscription_meta as SubscriptionMeta | null | undefined;

        if (!cancelled && existingMeta?.billing_cycle) {
          // Normal path: meta was written by plans.tsx or premium.tsx on upgrade
          setMeta(existingMeta);
        } else if (!cancelled) {
          // Admin-granted VIP: subscription_type = 'premium' but no subscription_meta.
          // Show a helpful 'Admin Grant' state instead of crashing or showing wrong data.
          const subscribedAt = user.created_at ?? new Date().toISOString();
          const defaultMeta: SubscriptionMeta = {
            billing_cycle: 'admin_grant',
            subscribed_at: subscribedAt,
            // No meaningful renewal for admin grants
            next_renewal:  new Date('2099-12-31').toISOString(),
          };
          setMeta(defaultMeta);
          // Don't persist admin_grant to preferences — let admin decide cycle later
        }

        // 2. Load usage stats from user_stats view
        const { data: userStats } = await userAPI.getUserStats(user.id);
        if (!cancelled && userStats) {
          setStats({
            total_episodes_watched: userStats.total_episodes_watched ?? 0,
            // user_stats view doesn't track premium-specific count — use 0 as fallback
            premium_episodes_watched: userStats.premium_episodes_watched ?? 0,
            // total_watch_time is in seconds — convert to hours
            total_watch_time_hours: Math.round((userStats.total_watch_time ?? 0) / 3600),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Switch billing cycle (monthly ↔ yearly) ───────────────────────────────
  const handleSwitchCycle = useCallback(() => {
    if (!meta) return;
    const targetCycle = meta.billing_cycle === 'monthly' ? 'yearly' : 'monthly';
    const targetPrice = PLAN_PRICES[targetCycle];

    Alert.alert(
      `Switch to ${PLAN_LABELS[targetCycle]}?`,
      `You'll be billed ${targetPrice} starting from your next renewal date.\n\nThis change takes effect immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Switch to ${PLAN_LABELS[targetCycle]}`,
          onPress: async () => {
            setActionLoading(true);
            try {
              const newMeta: SubscriptionMeta = {
                ...meta,
                billing_cycle: targetCycle,
                next_renewal: targetCycle === 'yearly'
                  ? addMonths(new Date(), 12).toISOString()
                  : addMonths(new Date(), 1).toISOString(),
              };
              await userAPI.updateSubscriptionMeta(user!.id, newMeta);
              setMeta(newMeta);
              Alert.alert('Plan Updated', `You're now on the ${PLAN_LABELS[targetCycle]} plan.`);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [meta, user]);

  // ── Cancel subscription ───────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    Alert.alert(
      'Cancel Premium?',
      'You\'ll lose access to:\n\n• Premium episodes\n• Ad-free streaming\n• HD quality\n\nYour account will be downgraded to Free immediately.',
      [
        { text: 'Keep Premium', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            // Double confirm — destructive actions always need two taps
            Alert.alert(
              'Are you sure?',
              'This cannot be undone. Your premium access ends right now.',
              [
                { text: 'Go Back', style: 'cancel' },
                {
                  text: 'Cancel Subscription',
                  style: 'destructive',
                  onPress: async () => {
                    setActionLoading(true);
                    try {
                      // 1. Downgrade in users table
                      const { error } = await supabase
                        .from('users')
                        .update({ subscription_type: 'free' })
                        .eq('id', user!.id);
                      if (error) throw error;

                      // Clear subscription meta safely — null clears only this column
                      await userAPI.updateSubscriptionMeta(user!.id, null);

                      // 3. Refresh context so all screens reflect change instantly
                      await refreshUser();

                      Alert.alert(
                        'Subscription Cancelled',
                        'You\'ve been downgraded to the Free plan. You can upgrade again anytime.',
                        [{ text: 'OK', onPress: () => router.back() }],
                      );
                    } catch (e: any) {
                      Alert.alert('Error', e?.message ?? 'Failed to cancel. Try again.');
                    } finally {
                      setActionLoading(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [user, refreshUser, router]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (!user || user.subscription_type !== 'premium') {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="star-outline" size={48} color={COLORS.textMuted} />
        <Text style={styles.emptyText}>No active premium subscription.</Text>
        <TouchableOpacity
          style={styles.upgradeBtn}
          onPress={() => router.replace('/premium' as any)}
        >
          <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
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
                {meta ? PLAN_PRICES[meta.billing_cycle] : ''}
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
            { icon: 'film', text: 'HD & 4K quality streaming' },
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
                    {meta?.billing_cycle === 'monthly'
                      ? 'Save 44% · ₹999/year instead of ₹1788'
                      : 'Billed monthly at ₹149/month'
                    }
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
          {meta?.billing_cycle !== 'admin_grant' && <View style={styles.divider} />}

          {/* Billing history (placeholder) */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Alert.alert('Billing History', 'Detailed invoice history will be available once payment integration is live.')}
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

          <View style={styles.divider} />

          {/* Payment method */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Alert.alert('Payment Method', 'Update your payment method in Settings → Payment Methods.')}
          >
            <View style={styles.actionLeft}>
              <Ionicons name="card-outline" size={20} color={COLORS.neonGold} />
              <View>
                <Text style={styles.actionTitle}>Payment Method</Text>
                <Text style={styles.actionSub}>Razorpay · Manage saved cards</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <Text style={[styles.sectionLabel, { color: COLORS.danger }]}>// DANGER ZONE</Text>
        <View style={[styles.actionsCard, styles.dangerCard]}>
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
                <Text style={[styles.actionTitle, { color: COLORS.danger }]}>Cancel Subscription</Text>
                <Text style={styles.actionSub}>Downgrade to Free plan immediately</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>
          Questions? Contact support@animehub.app{'\n'}
          Powered by Razorpay · Secured by SSL
        </Text>

      </ScrollView>
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
});
