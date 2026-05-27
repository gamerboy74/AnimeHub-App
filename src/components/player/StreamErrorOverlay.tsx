import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/theme";
import { styles } from "../../screens/watch.styles";

interface StreamErrorOverlayProps {
  visible: boolean;
  serversCount: number;
  isServerLocked: boolean;
  serverLabel: string;
  onSwitchServer: () => void;
  onRetry: () => void;
  onGoBack: () => void;
}

export default function StreamErrorOverlay({
  visible,
  serversCount,
  isServerLocked,
  serverLabel,
  onSwitchServer,
  onRetry,
  onGoBack,
}: StreamErrorOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.errorOverlay}>
      {/* Icon + headline */}
      <Ionicons name="cloud-offline-outline" size={52} color={COLORS.neonPink} />
      <Text style={styles.errorTitle}>Stream Unavailable</Text>
      <Text style={styles.errorSubtitle}>
        {serversCount > 1
          ? "This server failed. Try switching to another."
          : "Could not load the stream. Try retrying or go back."}
      </Text>

      {/* Server switcher — opens picker (premium) or upgrade prompt (free) */}
      {(serversCount > 1 || isServerLocked) && (
        <TouchableOpacity
          style={styles.errorSwitchBtn}
          onPress={onSwitchServer}
        >
          <Ionicons
            name={isServerLocked ? "lock-closed" : "swap-horizontal"}
            size={15}
            color={COLORS.neonCyan}
          />
          <Text style={styles.errorSwitchBtnText}>
            {isServerLocked
              ? "Unlock More Servers  •  Go Premium"
              : `Switch Server  •  ${serverLabel}`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Action buttons */}
      <View style={styles.errorBtnRow}>
        <TouchableOpacity style={styles.errorBtn} onPress={onRetry}>
          <Ionicons name="refresh" size={16} color="#000" />
          <Text style={styles.errorBtnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.errorBtn, styles.errorBtnSecondary]}
          onPress={onGoBack}
        >
          <Ionicons name="arrow-back" size={16} color={COLORS.neon} />
          <Text style={[styles.errorBtnText, { color: COLORS.neon }]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
