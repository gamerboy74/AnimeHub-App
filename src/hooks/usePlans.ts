/**
 * src/hooks/usePlans.ts
 *
 * Fetches subscription plans + feature comparison rows from Supabase.
 * Cached for 30 minutes — plans rarely change and reads are free.
 *
 * Falls back to hardcoded defaults if the DB tables don't exist yet
 * (before the migration is run), so the app never crashes.
 */

import { useQuery } from '@tanstack/react-query';
import { plansAPI, SubscriptionPlan, PlanFeature } from '../lib/supabase';

// ─── Fallback data (shown if migration hasn't been run yet) ──────────────────
const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'free',
    display_name: 'Free',
    tier: 'free',
    price_paise: 0,
    currency: 'INR',
    billing_cycle: null,
    badge: null,
    savings_text: null,
    sort_order: 0,
  },
  {
    id: 'premium_monthly',
    name: 'premium_monthly',
    display_name: 'Monthly',
    tier: 'premium',
    price_paise: 14900,
    currency: 'INR',
    billing_cycle: 'monthly',
    badge: null,
    savings_text: null,
    sort_order: 1,
  },
  {
    id: 'premium_yearly',
    name: 'premium_yearly',
    display_name: 'Yearly',
    tier: 'premium',
    price_paise: 99900,
    currency: 'INR',
    billing_cycle: 'yearly',
    badge: 'BEST VALUE',
    savings_text: '₹83/mo · Save 44%',
    sort_order: 2,
  },
];

const FALLBACK_FEATURES: PlanFeature[] = [
  { id: '1', label: 'Anime Library',         sub_label: null, free_value: '✓',          premium_value: '✓',       is_highlighted: false, sort_order: 0 },
  { id: '2', label: 'Free Episodes',          sub_label: null, free_value: '✓',          premium_value: '✓',       is_highlighted: false, sort_order: 1 },
  { id: '3', label: 'Premium Episodes',       sub_label: null, free_value: '✗',          premium_value: '✓',       is_highlighted: true,  sort_order: 2 },
  { id: '4', label: 'Video Quality',          sub_label: null, free_value: 'Up to 720p', premium_value: 'Up to 4K', is_highlighted: true, sort_order: 3 },
  { id: '5', label: 'Ads',                    sub_label: null, free_value: 'With ads',   premium_value: 'Ad-free', is_highlighted: true,  sort_order: 4 },
  { id: '6', label: 'Simultaneous Streams',   sub_label: null, free_value: '1 device',   premium_value: '2 devices', is_highlighted: false, sort_order: 5 },
  { id: '7', label: 'Offline Downloads',      sub_label: null, free_value: '✗',          premium_value: '✓',       is_highlighted: false, sort_order: 6 },
  { id: '13', label: 'Multiple Stream Servers', sub_label: 'Switch to faster back-up streams', free_value: 'Server 1 only', premium_value: 'Unlimited', is_highlighted: true,  sort_order: 6.5 },
  { id: '8', label: 'Early Episode Access',   sub_label: null, free_value: '✗',          premium_value: '✓',       is_highlighted: false, sort_order: 7 },
  { id: '9', label: 'New Episode Alerts',     sub_label: null, free_value: '✓',          premium_value: '✓',       is_highlighted: false, sort_order: 8 },
  { id: '10', label: 'Watchlist & Favorites', sub_label: null, free_value: '✓',          premium_value: '✓',       is_highlighted: false, sort_order: 9 },
  { id: '11', label: 'Community Reviews',     sub_label: null, free_value: '✓',          premium_value: '✓',       is_highlighted: false, sort_order: 10 },
  { id: '12', label: 'Customer Support',      sub_label: null, free_value: 'Standard',   premium_value: 'Priority', is_highlighted: false, sort_order: 11 },
];

// ─── Price formatter ──────────────────────────────────────────────────────────
export function formatPrice(plan: SubscriptionPlan): string {
  if (plan.price_paise === 0) return '₹0';
  const amount = plan.price_paise / 100;
  return `₹${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

export function formatPeriod(plan: SubscriptionPlan): string {
  if (!plan.billing_cycle) return 'forever';
  return plan.billing_cycle === 'monthly' ? '/month' : '/year';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePlans() {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      try {
        const result = await plansAPI.getAll();
        // If tables don't exist yet, fall back gracefully
        if (!result.plans.length) {
          return { plans: FALLBACK_PLANS, features: FALLBACK_FEATURES, isFallback: true };
        }
        return { ...result, isFallback: false };
      } catch {
        return { plans: FALLBACK_PLANS, features: FALLBACK_FEATURES, isFallback: true };
      }
    },
    staleTime:  30 * 60 * 1000,   // treat as fresh for 30 minutes
    gcTime:     60 * 60 * 1000,   // keep in cache for 1 hour
    retry: 1,
  });
}
