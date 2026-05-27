import React, { useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { styles } from "../../screens/watch.styles";
import { COLORS } from "../../constants/theme";
import { Anime, AnimeWithStats, Episode } from "../../types/database";
import DownloadButton from "../ui/DownloadButton";

export function formatTime(seconds: number = 0) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface PlayerHUDOverlayProps {
  showHud: boolean;
  isRawVideo: boolean;
  useNativePlayerOnly: boolean;
  playerReady: boolean;
  playerState: {
    isPlaying: boolean;
    current: number;
    duration: number;
  };
  anime: AnimeWithStats | null | undefined;
  episode: Episode;
  downloader: any;
  sniffedMediaUrl: string | null;
  isPremium: boolean;
  serverLabel: string;
  isServerLocked: boolean;
  serversCount: number;
  
  // Actions
  onBack: () => void;
  onDownloadPress: () => void;
  onCancelDownload: () => void;
  onOpenServerPicker: () => void;
  onOpenEpisodeSelector: () => void;
  onNavigateToPlans: () => void;
  
  // Controls
  onSeekRelative: (offset: number) => void;
  onTogglePlayPause: () => void;
  onSeekTo: (seconds: number) => void;
  
  // Settings & popups state
  qualityLevels: { label: string }[];
  subtitleTracks: { id: number; label: string }[];
  activeQualityIndex: number;
  activeSubtitleIndex: number;
  showQualityPicker: boolean;
  showSubtitlePicker: boolean;
  showSettingsPicker: boolean;
  onSetShowQualityPicker: (show: boolean) => void;
  onSetShowSubtitlePicker: (show: boolean) => void;
  onSetShowSettingsPicker: (show: boolean) => void;
  
  onSelectQuality: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
  
  // Preferences
  autoPlayEnabled: boolean;
  onSetAutoPlay: (enabled: boolean) => void;
  autoSkipIntroEnabled: boolean;
  onSetAutoSkipIntro: (enabled: boolean) => void;
  
  // Toasts
  resumeToast: boolean;
  resumeSeconds: number;
  skipToast: boolean;
  skipLabel: string;
}

export default function PlayerHUDOverlay({
  showHud,
  isRawVideo,
  useNativePlayerOnly,
  playerReady,
  playerState,
  anime,
  episode,
  downloader,
  sniffedMediaUrl,
  isPremium,
  serverLabel,
  isServerLocked,
  serversCount,
  
  onBack,
  onDownloadPress,
  onCancelDownload,
  onOpenServerPicker,
  onOpenEpisodeSelector,
  onNavigateToPlans,
  
  onSeekRelative,
  onTogglePlayPause,
  onSeekTo,
  
  qualityLevels,
  subtitleTracks,
  activeQualityIndex,
  activeSubtitleIndex,
  showQualityPicker,
  showSubtitlePicker,
  showSettingsPicker,
  onSetShowQualityPicker,
  onSetShowSubtitlePicker,
  onSetShowSettingsPicker,
  
  onSelectQuality,
  onSelectSubtitle,
  
  autoPlayEnabled,
  onSetAutoPlay,
  autoSkipIntroEnabled,
  onSetAutoSkipIntro,
  
  resumeToast,
  resumeSeconds,
  skipToast,
  skipLabel,
}: PlayerHUDOverlayProps) {
  const insets = useSafeAreaInsets();
  const scrubTrackWidthRef = useRef<number>(200);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={showHud ? "box-none" : "none"}
    >
      {/* ── TOP BAR ── */}
      {showHud && (
        <View
          style={[
            styles.topHud,
            {
              paddingLeft: Math.max(24, insets.left),
              paddingRight: Math.max(24, insets.right),
              paddingTop: Math.max(20, insets.top),
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.topHudLeft} pointerEvents="box-none">
            <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={22} color={COLORS.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} pointerEvents="none">
              <Text style={styles.animeTitle} numberOfLines={1}>
                {anime?.title?.toUpperCase()}
              </Text>
              <Text style={styles.episodeInfo} numberOfLines={1}>
                S1:E{episode.episode_number} • {episode.title}
              </Text>
            </View>
          </View>

          <View style={styles.topHudRight} pointerEvents="box-none">
            {playerState.duration > 0 && (
              <View style={styles.progressChip} pointerEvents="none">
                <View
                  style={[
                    styles.progressChipFill,
                    { width: `${(playerState.current / playerState.duration) * 100}%` },
                  ]}
                />
                <Text style={styles.progressChipText}>
                  {formatTime(playerState.current)} / {formatTime(playerState.duration)}
                </Text>
              </View>
            )}

            {/* Download button */}
            <DownloadButton
              status={downloader.status}
              progress={downloader.progress}
              sniffedUrl={sniffedMediaUrl}
              isPremium={isPremium}
              onPress={onDownloadPress}
              onCancel={onCancelDownload}
            />

            {/* Server selection chip */}
            {serversCount > 0 && (
              <TouchableOpacity
                style={[
                  styles.serverChip,
                  isServerLocked && styles.serverChipLocked,
                ]}
                onPress={isServerLocked ? onNavigateToPlans : onOpenServerPicker}
              >
                <Ionicons
                  name={isServerLocked ? "lock-closed" : "server-outline"}
                  size={11}
                  color={isServerLocked ? COLORS.neonPink : COLORS.neonCyan}
                />
                <Text
                  style={[
                    styles.serverChipText,
                    isServerLocked && { color: COLORS.neonPink },
                  ]}
                >
                  {serverLabel}
                </Text>
                {isServerLocked ? (
                  <Text style={styles.serverChipLockLabel}>PRO</Text>
                ) : (
                  <Ionicons name="chevron-down" size={10} color={COLORS.textMuted} />
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.selectorBtn}
              onPress={onOpenEpisodeSelector}
            >
              <Ionicons name="list" size={16} color={COLORS.text} />
              <Text style={styles.selectorBtnText}>EPISODES</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Gradients + toast — only while HUD expanded */}
      {showHud && (
        <>
          <LinearGradient
            colors={["rgba(14,14,17,0.85)", "transparent"]}
            style={styles.topGradient}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["transparent", "rgba(14,14,17,0.7)"]}
            style={styles.bottomGradient}
            pointerEvents="none"
          />
          {resumeToast && (
            <View style={styles.resumeToast} pointerEvents="none">
              <BlurView intensity={40} style={styles.resumeToastBlur}>
                <Ionicons name="time" size={14} color={COLORS.neon} />
                <Text style={styles.resumeToastText}>
                  Resuming from {formatTime(resumeSeconds)}
                </Text>
              </BlurView>
            </View>
          )}
          {skipToast && (
            <View style={styles.skipToast} pointerEvents="none">
              <BlurView intensity={40} style={styles.skipToastBlur}>
                <Ionicons name="play-forward" size={14} color={COLORS.neonCyan} />
                <Text style={styles.skipToastText}>
                  Auto-skipped {skipLabel}
                </Text>
              </BlurView>
            </View>
          )}
        </>
      )}

      {/* ── EMBEDDED-PLAYER BOTTOM CONTROLS HUD ── */}
      {showHud && !isRawVideo && !useNativePlayerOnly && playerReady && (
        <View style={styles.embedControlsBar} pointerEvents="box-none">
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.82)"]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          
          {/* Seek controls row */}
          <View style={styles.embedCenterRow} pointerEvents="auto">
            <TouchableOpacity
              style={styles.embedCtrlBtn}
              onPress={() => onSeekRelative(-10)}
              activeOpacity={0.7}
            >
              <Ionicons name="play-back" size={22} color="#fff" />
              <Text style={styles.embedSeekLabel}>10</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.embedCtrlBtn, styles.embedPlayBtn]}
              onPress={onTogglePlayPause}
              activeOpacity={0.7}
            >
              <Ionicons
                name={playerState.isPlaying ? "pause" : "play"}
                size={28}
                color={COLORS.neon}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.embedCtrlBtn}
              onPress={() => onSeekRelative(10)}
              activeOpacity={0.7}
            >
              <Ionicons name="play-forward" size={22} color="#fff" />
              <Text style={styles.embedSeekLabel}>10</Text>
            </TouchableOpacity>
          </View>

          {/* Scrubber row */}
          <View style={styles.embedScrubRow} pointerEvents="auto">
            <Text style={styles.embedTimeLabel}>{formatTime(playerState.current)}</Text>
            <TouchableOpacity
              style={styles.embedTrack}
              activeOpacity={1}
              onLayout={(e) => {
                scrubTrackWidthRef.current = e.nativeEvent.layout.width;
              }}
              onPress={(e: any) => {
                if (playerState.duration <= 0) return;
                const locationX = e.nativeEvent.locationX;
                const pct = Math.max(
                  0,
                  Math.min(1, locationX / scrubTrackWidthRef.current)
                );
                onSeekTo(Math.floor(pct * playerState.duration));
              }}
            >
              <View style={styles.embedTrackBg}>
                <View
                  style={[
                    styles.embedTrackFill,
                    {
                      width: `${
                        playerState.duration > 0
                          ? (playerState.current / playerState.duration) * 100
                          : 0
                      }%`,
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
            <Text style={styles.embedTimeLabel}>
              {playerState.duration > 0 ? formatTime(playerState.duration) : "--:--"}
            </Text>

            {/* Quality selection chip */}
            {qualityLevels.length > 0 && (
              <TouchableOpacity
                style={styles.embedChip}
                onPress={() => {
                  onSetShowSubtitlePicker(false);
                  onSetShowSettingsPicker(false);
                  onSetShowQualityPicker(!showQualityPicker);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="settings-outline" size={11} color={COLORS.neonCyan} />
                <Text style={[styles.embedChipText, { color: COLORS.neonCyan }]}>
                  {activeQualityIndex >= 0 && qualityLevels[activeQualityIndex]
                    ? qualityLevels[activeQualityIndex].label
                    : "AUTO"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Subtitles/CC chip */}
            {subtitleTracks.length > 1 && (
              <TouchableOpacity
                style={styles.embedChip}
                onPress={() => {
                  onSetShowQualityPicker(false);
                  onSetShowSettingsPicker(false);
                  onSetShowSubtitlePicker(!showSubtitlePicker);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={11}
                  color={activeSubtitleIndex > 0 ? COLORS.neonCyan : "#fff"}
                />
                <Text
                  style={[
                    styles.embedChipText,
                    activeSubtitleIndex > 0 && { color: COLORS.neonCyan },
                  ]}
                >
                  {activeSubtitleIndex > 0 && subtitleTracks[activeSubtitleIndex]
                    ? subtitleTracks[activeSubtitleIndex].label
                    : "CC"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Settings Preferences chip */}
            <TouchableOpacity
              style={styles.embedChip}
              onPress={() => {
                onSetShowQualityPicker(false);
                onSetShowSubtitlePicker(false);
                onSetShowSettingsPicker(!showSettingsPicker);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="options-outline" size={11} color={COLORS.neonCyan} />
              <Text style={[styles.embedChipText, { color: COLORS.neonCyan }]}>
                SETTINGS
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quality popup menu */}
          {showQualityPicker && qualityLevels.length > 0 && (
            <View style={styles.embedPicker} pointerEvents="auto">
              <Text style={styles.embedPickerTitle}>Quality</Text>
              {qualityLevels.map((q, i) => {
                const isActive = i === activeQualityIndex;
                return (
                  <TouchableOpacity
                    key={`q-${i}`}
                    style={[
                      styles.embedPickerItem,
                      isActive && styles.embedPickerItemActive,
                    ]}
                    onPress={() => onSelectQuality(i)}
                  >
                    <Ionicons
                      name={isActive ? "radio-button-on" : "radio-button-off"}
                      size={13}
                      color={isActive ? COLORS.neonCyan : "rgba(255,255,255,0.4)"}
                    />
                    <Text
                      style={[
                        styles.embedPickerItemText,
                        isActive && { color: COLORS.neonCyan },
                      ]}
                    >
                      {q.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Subtitles popup menu */}
          {showSubtitlePicker && subtitleTracks.length > 0 && (
            <View
              style={[styles.embedPicker, { maxHeight: 180, minWidth: 150 }]}
              pointerEvents="auto"
            >
              <Text style={styles.embedPickerTitle}>Subtitles / CC</Text>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 4 }}
                showsVerticalScrollIndicator={true}
              >
                {subtitleTracks.map((t, i) => {
                  const isActive = i === activeSubtitleIndex;
                  return (
                    <TouchableOpacity
                      key={`sub-${i}-${t.label}`}
                      style={[
                        styles.embedPickerItem,
                        isActive && styles.embedPickerItemActive,
                      ]}
                      onPress={() => onSelectSubtitle(i)}
                    >
                      <Ionicons
                        name={isActive ? "radio-button-on" : "radio-button-off"}
                        size={13}
                        color={isActive ? COLORS.neonCyan : "rgba(255,255,255,0.4)"}
                      />
                      <Text
                        style={[
                          styles.embedPickerItemText,
                          isActive && { color: COLORS.neonCyan },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Playback Settings popup menu */}
          {showSettingsPicker && (
            <View style={[styles.embedPicker, { minWidth: 170 }]} pointerEvents="auto">
              <Text style={styles.embedPickerTitle}>Playback Options</Text>

              {/* Auto-Play Toggle */}
              <TouchableOpacity
                style={styles.embedPickerItem}
                onPress={() => onSetAutoPlay(!autoPlayEnabled)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={autoPlayEnabled ? "checkbox" : "square-outline"}
                  size={15}
                  color={autoPlayEnabled ? COLORS.neonCyan : "rgba(255,255,255,0.4)"}
                />
                <Text
                  style={[
                    styles.embedPickerItemText,
                    autoPlayEnabled && { color: COLORS.neonCyan },
                  ]}
                >
                  Auto-play Next
                </Text>
              </TouchableOpacity>

              {/* Auto-Skip Intro Toggle */}
              <TouchableOpacity
                style={styles.embedPickerItem}
                onPress={() => onSetAutoSkipIntro(!autoSkipIntroEnabled)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={autoSkipIntroEnabled ? "checkbox" : "square-outline"}
                  size={15}
                  color={autoSkipIntroEnabled ? COLORS.neonCyan : "rgba(255,255,255,0.4)"}
                />
                <Text
                  style={[
                    styles.embedPickerItemText,
                    autoSkipIntroEnabled && { color: COLORS.neonCyan },
                  ]}
                >
                  Auto-skip Intro
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
