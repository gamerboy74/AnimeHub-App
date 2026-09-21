import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADIUS } from "../../constants/theme";

interface WifiOnlyOverlayProps {
  visible: boolean;
  onStreamAnyway: () => void;
  onOpenSettings: () => void;
  onGoBack: () => void;
}

export default function WifiOnlyOverlay({
  visible,
  onStreamAnyway,
  onOpenSettings,
  onGoBack,
}: WifiOnlyOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.iconCircle}>
        <Ionicons name="cellular-outline" size={38} color={COLORS.neonCyan} />
      </View>

      <Text style={styles.title}>Wi-Fi Only Streaming</Text>
      <Text style={styles.subtitle}>
        You have "Stream on Wi-Fi only" enabled in your settings. You are currently on cellular data.
      </Text>

      {/* Primary Action: Allow for this session */}
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={onStreamAnyway}
        activeOpacity={0.85}
      >
        <Ionicons name="play" size={16} color="#000" />
        <Text style={styles.primaryBtnText}>Stream Anyway (This Time)</Text>
      </TouchableOpacity>

      {/* Open Settings */}
      <TouchableOpacity
        style={styles.settingsBtn}
        onPress={onOpenSettings}
        activeOpacity={0.85}
      >
        <Ionicons name="settings-outline" size={15} color={COLORS.neonCyan} />
        <Text style={styles.settingsBtnText}>Manage in Settings</Text>
      </TouchableOpacity>

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
    backgroundColor: "rgba(8, 8, 16, 0.96)",
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0, 245, 255, 0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(0, 245, 255, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: SPACING.xs,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSub,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: SPACING.xl,
    maxWidth: 440,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    backgroundColor: COLORS.neonCyan,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: SPACING.xl,
    width: "100%",
    maxWidth: 320,
    marginBottom: SPACING.sm,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 0.3,
  },
  settingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    backgroundColor: "rgba(0, 245, 255, 0.08)",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "rgba(0, 245, 255, 0.25)",
    paddingVertical: 11,
    paddingHorizontal: SPACING.xl,
    width: "100%",
    maxWidth: 320,
    marginBottom: SPACING.sm,
  },
  settingsBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.neonCyan,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: 10,
    paddingHorizontal: SPACING.lg,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
});
