import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Episode } from "../../types/database";
import { COLORS } from "../../constants/theme";
import { styles } from "../../screens/watch.styles";

interface NextUpCardProps {
  visible: boolean;
  nextEpisode: Episode | null | undefined;
  posterUrl?: string;
  autoPlayCountdown: number | null;
  onPlayNow: () => void;
  onCancelAutoPlay: () => void;
}

export default function NextUpCard({
  visible,
  nextEpisode,
  posterUrl,
  autoPlayCountdown,
  onPlayNow,
  onCancelAutoPlay,
}: NextUpCardProps) {
  if (!visible || !nextEpisode) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={styles.nextUpCard}>
        <BlurView intensity={40} style={styles.nextUpBlur}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.nextUpClickableArea}
            onPress={onPlayNow}
          >
            <Image
              source={{ uri: nextEpisode.thumbnail_url || posterUrl }}
              style={styles.nextUpThumb}
              contentFit="cover"
              transition={200}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.nextUpLabel}>
                {autoPlayCountdown !== null
                  ? `AUTO-PLAYING IN ${autoPlayCountdown}s`
                  : "UP NEXT"}
              </Text>
              <Text style={styles.nextUpTitle} numberOfLines={1}>
                Episode {nextEpisode.episode_number}: {nextEpisode.title}
              </Text>
            </View>

            {/* Play now */}
            <View style={styles.nextUpPlayBtn}>
              <Ionicons name="play" size={16} color="#000" />
            </View>
          </TouchableOpacity>

          {/* Cancel (only shown during countdown) */}
          {autoPlayCountdown !== null && (
            <TouchableOpacity
              style={styles.nextUpCancelBtn}
              onPress={onCancelAutoPlay}
            >
              <Ionicons name="close" size={14} color={COLORS.text} />
            </TouchableOpacity>
          )}
        </BlurView>
      </View>
    </View>
  );
}
