import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { supabase, userAPI, SubscriptionPlan } from '../src/lib/supabase';
import { usePlans, formatPrice, formatPeriod } from '../src/hooks/usePlans';

const { width } = Dimensions.get('window');

// Perks are marketing copy — fine to keep static
const PERKS = [
  { icon: 'star', text: 'Unlimited premium episodes' },
  { icon: 'play-skip-forward', text: 'Ad-free streaming' },
  { icon: 'download', text: 'Download for offline' },
  { icon: 'time', text: 'Early access to new episodes' },
  { icon: 'shield-checkmark', text: 'HD & 4K quality' },
  { icon: 'people', text: 'Watch on 2 devices' },
];

export default function PremiumUpgradeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();

  // Dynamic plans from DB
  const { data: plansData } = usePlans();
  const premiumPlans = (plansData?.plans ?? []).filter(p => p.tier === 'premium');
  const defaultPlan  = premiumPlans.find(p => p.badge) ?? premiumPlans[0];

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const activePlan = selectedPlan ?? defaultPlan ?? null;
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user)      { router.push('/auth/login'); return; }
    if (!activePlan) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ subscription_type: 'premium' })
        .eq('id', user.id);
      if (error) throw error;

      // Save billing cycle as an isolated write — never touches other pref columns
      const renewalMs = activePlan.billing_cycle === 'yearly' ? 365 * 86_400_000 : 30 * 86_400_000;
      await userAPI.updateSubscriptionMeta(user.id, {
        billing_cycle: activePlan.billing_cycle,
        plan_name:     activePlan.name,
        subscribed_at: new Date().toISOString(),
        next_renewal:  new Date(Date.now() + renewalMs).toISOString(),
      });

      await refreshUser();

      Alert.alert(
        '🎉 Welcome to Premium!',
        `You're on the ${activePlan.display_name} plan. Enjoy unlimited access!`,
        [{ text: 'Start Watching', onPress: () => router.back() }],
      );
    } catch (e: any) {
      Alert.alert('Upgrade Failed', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Hero gradient */}
        <LinearGradient
          colors={['rgba(255,214,0,0.15)', 'transparent']}
          style={styles.heroGradient}
        >
          <View style={styles.crownWrap}>
            <Ionicons name="star" size={48} color={COLORS.neonGold} />
          </View>
          <Text style={styles.heroTitle}>ANIMEHUB{'\n'}PREMIUM</Text>
          <Text style={styles.heroSub}>Unlock the full experience</Text>
        </LinearGradient>

        {/* Perks list */}
        <View style={styles.perksCard}>
          {PERKS.map((perk, i) => (
            <View key={i} style={styles.perkRow}>
              <View style={styles.perkIconWrap}>
                <Ionicons name={perk.icon as any} size={18} color={COLORS.neonGold} />
              </View>
              <Text style={styles.perkText}>{perk.text}</Text>
            </View>
          ))}
        </View>

        {/* Plan selector — dynamic from DB */}
        <Text style={styles.sectionLabel}>// CHOOSE YOUR PLAN</Text>
        <View style={styles.plansRow}>
          {premiumPlans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                activePlan?.id === plan.id && styles.planCardActive,
              ]}
              onPress={() => setSelectedPlan(plan)}
              activeOpacity={0.85}
            >
              {plan.badge && (
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>{plan.badge}</Text>
                </View>
              )}
              <Text style={styles.planLabel}>{plan.display_name.toUpperCase()}</Text>
              <Text style={styles.planPrice}>{formatPrice(plan)}</Text>
              <Text style={styles.planPeriod}>{formatPeriod(plan)}</Text>
              {plan.savings_text && (
                <Text style={styles.planNote}>{plan.savings_text}</Text>
              )}
              {activePlan?.id === plan.id && (
                <View style={styles.planCheckWrap}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.neonGold} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, loading && { opacity: 0.7 }]}
          onPress={handleUpgrade}
          disabled={loading}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : (
                <>
                  <Ionicons name="star" size={18} color="#000" />
                  <Text style={styles.ctaText}>
                    {activePlan ? `${formatPrice(activePlan)} ${formatPeriod(activePlan)}`.toUpperCase() : 'UPGRADE TO PREMIUM'}
                  </Text>
                </>
              )
            }
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Cancel anytime · No hidden fees{'\n'}
          Secure payment powered by Razorpay
        </Text>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 60 },

  header: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },

  heroGradient: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  crownWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,214,0,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,214,0,0.3)',
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: 32, color: COLORS.text, fontWeight: '900',
    letterSpacing: 2, textAlign: 'center', lineHeight: 38,
  },
  heroSub: {
    fontSize: 14, color: COLORS.textSub, marginTop: SPACING.xs,
    letterSpacing: 1,
  },

  perksCard: {
    marginHorizontal: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  perkRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
  },
  perkIconWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,214,0,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,214,0,0.2)',
  },
  perkText: { fontSize: 14, color: COLORS.text, flex: 1 },

  sectionLabel: {
    fontSize: 11, color: COLORS.neon, fontWeight: '800',
    letterSpacing: 2, paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  plansRow: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.md, marginBottom: SPACING.lg,
  },
  planCard: {
    flex: 1, backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    padding: SPACING.md, alignItems: 'center',
    position: 'relative', gap: 4,
  },
  planCardActive: {
    borderColor: COLORS.neonGold,
    backgroundColor: 'rgba(255,214,0,0.08)',
  },
  planBadge: {
    position: 'absolute', top: -10,
    backgroundColor: COLORS.neonGold,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  planBadgeText: { fontSize: 9, color: '#000', fontWeight: '900', letterSpacing: 1 },
  planLabel: { fontSize: 10, color: COLORS.textSub, fontWeight: '700', letterSpacing: 2, marginTop: 8 },
  planPrice: { fontSize: 28, color: COLORS.text, fontWeight: '900' },
  planPeriod: { fontSize: 11, color: COLORS.textMuted },
  planNote: { fontSize: 10, color: COLORS.neonGold, fontWeight: '600' },
  planCheckWrap: { marginTop: 4 },

  ctaBtn: { marginHorizontal: SPACING.md, borderRadius: RADIUS.md, overflow: 'hidden', marginBottom: SPACING.md },
  ctaGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm, paddingVertical: 16,
  },
  ctaText: { color: '#000', fontWeight: '900', fontSize: 15, letterSpacing: 1.5 },

  disclaimer: {
    textAlign: 'center', fontSize: 11, color: COLORS.textMuted,
    lineHeight: 18, paddingHorizontal: SPACING.xl,
  },
});
