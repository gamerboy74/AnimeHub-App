import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

export default function SubscriptionExpiryBanner() {
  const router = useRouter();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const expiryInfo = useMemo(() => {
    if (!user || user.subscription_type !== 'premium' || dismissed) {
      return null;
    }

    const expiresAt = user.subscription_expires_at;
    if (!expiresAt) return null;

    const expiryTime = new Date(expiresAt).getTime();
    const now = Date.now();
    const diffMs = expiryTime - now;
    const daysLeft = Math.ceil(diffMs / 86_400_000);

    // Only alert if expiring within 2 days (<= 2)
    if (daysLeft <= 0 || daysLeft > 2) {
      return null;
    }

    const isTomorrow = daysLeft === 1;
    return {
      daysLeft,
      title: isTomorrow ? 'Premium Expires Tomorrow' : 'Premium Expires in 2 Days',
      subtitle: isTomorrow
        ? 'Renew today to keep 2-device 4K streaming and downloads.'
        : 'Renew your subscription to prevent any interruption.',
      urgent: isTomorrow,
    };
  }, [user, dismissed]);

  if (!expiryInfo) return null;

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={
          expiryInfo.urgent
            ? ['rgba(255, 45, 120, 0.16)', 'rgba(255, 82, 82, 0.08)']
            : ['rgba(255, 214, 0, 0.14)', 'rgba(191, 95, 255, 0.06)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.container,
          expiryInfo.urgent ? styles.urgentBorder : styles.warningBorder,
        ]}
      >
        <View style={styles.iconCol}>
          <View
            style={[
              styles.iconCircle,
              expiryInfo.urgent ? styles.urgentCircle : styles.warningCircle,
            ]}
          >
            <Ionicons
              name={expiryInfo.urgent ? 'alert-circle' : 'time-outline'}
              size={18}
              color={expiryInfo.urgent ? '#FF2D78' : COLORS.neonGold}
            />
          </View>
        </View>

        <View style={styles.textCol}>
          <Text style={styles.titleText}>{expiryInfo.title}</Text>
          <Text style={styles.subtitleText}>{expiryInfo.subtitle}</Text>
        </View>

        <View style={styles.actionCol}>
          <TouchableOpacity
            style={[styles.renewBtn, expiryInfo.urgent && styles.urgentBtn]}
            onPress={() => router.push('/plans')}
            activeOpacity={0.85}
          >
            <Text style={styles.renewBtnText}>Renew</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setDismissed(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  container: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  warningBorder: {
    borderColor: 'rgba(255, 214, 0, 0.35)',
  },
  urgentBorder: {
    borderColor: 'rgba(255, 45, 120, 0.45)',
  },
  iconCol: {
    paddingLeft: 2,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCircle: {
    backgroundColor: 'rgba(255, 214, 0, 0.15)',
  },
  urgentCircle: {
    backgroundColor: 'rgba(255, 45, 120, 0.18)',
  },
  textCol: {
    flex: 1,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  subtitleText: {
    fontSize: 10,
    color: COLORS.textSub,
    marginTop: 2,
    lineHeight: 14,
  },
  actionCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  renewBtn: {
    backgroundColor: COLORS.neonGold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  urgentBtn: {
    backgroundColor: COLORS.neonPink,
  },
  renewBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 3,
  },
});
