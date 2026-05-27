import React, { useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Episode } from "../../types/database";
import { COLORS } from "../../constants/theme";
import { styles } from "../../screens/watch.styles";

interface EpisodeSelectorItemProps {
  ep: Episode;
  isActive: boolean;
  posterUrl?: string;
  onPress: (id: string) => void;
}

const EpisodeSelectorItem = React.memo(
  ({ ep, isActive, posterUrl, onPress }: EpisodeSelectorItemProps) => {
    return (
      <TouchableOpacity
        style={[
          styles.selectorItem,
          isActive && styles.activeItem,
        ]}
        onPress={() => onPress(ep.id)}
      >
        <Image
          source={{ uri: ep.thumbnail_url || posterUrl }}
          style={styles.selectorThumb}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.selectorInfo}>
          <Text style={styles.selectorEpNum}>
            EP {ep.episode_number}
          </Text>
          <Text style={styles.selectorEpTitle} numberOfLines={1}>
            {ep.title}
          </Text>
          {ep.duration ? (
            <Text style={styles.selectorEpDur}>
              {Math.round(ep.duration / 60)}m
            </Text>
          ) : null}
        </View>
        {isActive && (
          <View style={styles.nowPlayingBadge}>
            <Text style={styles.nowPlayingText}>NOW PLAYING</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.ep.id === nextProps.ep.id &&
      prevProps.isActive === nextProps.isActive &&
      prevProps.posterUrl === nextProps.posterUrl
    );
  }
);

interface EpisodeSelectorSheetProps {
  visible: boolean;
  onClose: () => void;
  streamableEpisodes: Episode[];
  activeEpisodeId: string;
  posterUrl?: string;
  onSelectEpisode: (epId: string) => void;
}

export default function EpisodeSelectorSheet({
  visible,
  onClose,
  streamableEpisodes,
  activeEpisodeId,
  posterUrl,
  onSelectEpisode,
}: EpisodeSelectorSheetProps) {
  const insets = useSafeAreaInsets();

  const activeIndex = useMemo(
    () => streamableEpisodes.findIndex((ep) => ep.id === activeEpisodeId),
    [streamableEpisodes, activeEpisodeId]
  );

  const renderEpisodeItem = useCallback(
    ({ item: ep }: { item: Episode }) => (
      <EpisodeSelectorItem
        ep={ep}
        isActive={ep.id === activeEpisodeId}
        posterUrl={posterUrl}
        onPress={onSelectEpisode}
      />
    ),
    [activeEpisodeId, posterUrl, onSelectEpisode]
  );

  const episodeKeyExtractor = useCallback((ep: Episode) => ep.id, []);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <TouchableOpacity
        style={styles.modalBg}
        activeOpacity={1}
        onPress={onClose}
      />
      <BlurView
        intensity={80}
        style={[
          styles.selectorSheet,
          { paddingBottom: Math.max(32, insets.bottom + 16) },
        ]}
        tint="dark"
      >
        <View style={styles.selectorHeader}>
          <Text style={styles.selectorTitle}>EPISODES</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={COLORS.textSub} />
          </TouchableOpacity>
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.selectorList}
          data={streamableEpisodes}
          keyExtractor={episodeKeyExtractor}
          initialScrollIndex={activeIndex >= 0 ? activeIndex : 0}
          getItemLayout={(data, index) => ({
            length: 196,
            offset: 196 * index,
            index,
          })}
          renderItem={renderEpisodeItem}
        />
      </BlurView>
    </View>
  );
}
