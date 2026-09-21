import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";

interface DeviceLimitOverlayProps {
  visible: boolean;
  isPremium: boolean;
  maxAllowed: number;
  onStopOtherStreams: () => void;
  onUpgrade: () => void;
  onGoBack: () => void;
  isStopping?: boolean;
}

export default function DeviceLimitOverlay({
  visible,
  isPremium,
  maxAllowed,
  onStopOtherStreams,
  onUpgrade,
  onGoBack,
  isStopping = false,
}: DeviceLimitOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.iconCircle}>
        <Ionicons name="phone-portrait-outline" size={38} color={COLORS.neonGold} />
      </View>

      <Text style={styles.title}>Device Limit Reached</Text>
      <Text style={styles.subtitle}>
        {isPremium
          ? `Your account is already streaming on ${maxAllowed} devices simultaneously (the maximum for Premium). Stop another stream to watch here.`
          : `Your account is currently streaming on another device. Free accounts are limited to 1 stream at a time.`}
      </Text>

      {/* Primary Action: Disconnect other screens */}
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={onStopOtherStreams}
        disabled={isStopping}
        activeOpacity={0.85}
      >
        {isStopping ? (
          <ActivityIndicator color="#000" size="small" />
        ) : (
          <>
            <Ionicons name="play" size={16} color="#000" />
            <Text style={styles.primaryBtnText}>Stop Other Screens & Play Here</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Upgrade Action (if Free tier) */}
      {!isPremium && (
        <TouchableOpacity
          style={styles.upgradeBtn}
          onPress={onUpgrade}
          activeOpacity={0.85}
        >
          <Ionicons name="star" size={15} color={COLORS.neonGold} />
          <Text style={styles.upgradeBtnText}>Upgrade to Premium · 2 Screens Simultaneous</Text>
        </TouchableOpacity>
      )}

      {/* Go Back */}
      <TouchableOpacity style={styles.secondaryBtn} onPress={onGoBack} activeOpacity={0.85}>
        <Ionicons name="arrow-back" size={15} color={COLORS.textMuted} />
        <Text style={styles.secondaryBtnText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 8, 16, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    zIndex: 999,
    gap: SPACING.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 214, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 0, 0.3)',
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSub,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.neonGold,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    width: '100%',
    maxWidth: 320,
    marginTop: SPACING.xs,
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255, 214, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 0, 0.4)',
    paddingVertical: 12,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    width: '100%',
    maxWidth: 320,
  },
  upgradeBtnText: {
    color: COLORS.neonGold,
    fontWeight: '800',
    fontSize: 12,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
  },
  secondaryBtnText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
