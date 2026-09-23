import { create } from 'zustand';

export interface QualityLevel {
  label: string;
  height?: number;
  originalIndex?: number;
  isLocked?: boolean;
}

export interface SubtitleTrack {
  id: number;
  label: string;
}

export interface PlayerState {
  // Playback metrics
  currentTime: number;
  duration: number;
  paused: boolean;
  buffering: boolean;
  playerReady: boolean;
  playerError: boolean;

  // UI overlays
  showHud: boolean;
  showSelector: boolean;
  showServerPicker: boolean;
  showQualityPicker: boolean;
  showSubtitlePicker: boolean;
  showSettingsPicker: boolean;
  autoPlayCountdown: number | null;

  // Stream tracks
  qualityLevels: QualityLevel[];
  activeQualityIndex: number;
  subtitleTracks: SubtitleTrack[];
  activeSubtitleIndex: number;

  // Actions
  setProgress: (currentTime: number, duration: number) => void;
  setPaused: (paused: boolean) => void;
  setBuffering: (buffering: boolean) => void;
  setPlayerReady: (ready: boolean) => void;
  setPlayerError: (error: boolean) => void;
  setShowHud: (show: boolean | ((prev: boolean) => boolean)) => void;
  setShowSelector: (show: boolean) => void;
  setShowServerPicker: (show: boolean) => void;
  setShowQualityPicker: (show: boolean) => void;
  setShowSubtitlePicker: (show: boolean) => void;
  setShowSettingsPicker: (show: boolean) => void;
  setAutoPlayCountdown: (countdown: number | null) => void;
  setQualityLevels: (levels: QualityLevel[]) => void;
  setActiveQualityIndex: (index: number) => void;
  setSubtitleTracks: (tracks: SubtitleTrack[]) => void;
  setActiveSubtitleIndex: (index: number) => void;
  resetPlayer: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentTime: 0,
  duration: 0,
  paused: true,
  buffering: false,
  playerReady: false,
  playerError: false,

  showHud: false,
  showSelector: false,
  showServerPicker: false,
  showQualityPicker: false,
  showSubtitlePicker: false,
  showSettingsPicker: false,
  autoPlayCountdown: null,

  qualityLevels: [],
  activeQualityIndex: -1,
  subtitleTracks: [],
  activeSubtitleIndex: 0,

  setProgress: (currentTime, duration) => set({ currentTime, duration }),
  setPaused: (paused) => set({ paused }),
  setBuffering: (buffering) => set({ buffering }),
  setPlayerReady: (playerReady) => set({ playerReady }),
  setPlayerError: (playerError) => set({ playerError }),
  setShowHud: (show) =>
    set((state) => ({
      showHud: typeof show === 'function' ? show(state.showHud) : show,
    })),
  setShowSelector: (showSelector) => set({ showSelector }),
  setShowServerPicker: (showServerPicker) => set({ showServerPicker }),
  setShowQualityPicker: (showQualityPicker) => set({ showQualityPicker }),
  setShowSubtitlePicker: (showSubtitlePicker) => set({ showSubtitlePicker }),
  setShowSettingsPicker: (showSettingsPicker) => set({ showSettingsPicker }),
  setAutoPlayCountdown: (autoPlayCountdown) => set({ autoPlayCountdown }),
  setQualityLevels: (qualityLevels) => set({ qualityLevels }),
  setActiveQualityIndex: (activeQualityIndex) => set({ activeQualityIndex }),
  setSubtitleTracks: (subtitleTracks) => set({ subtitleTracks }),
  setActiveSubtitleIndex: (activeSubtitleIndex) => set({ activeSubtitleIndex }),

  resetPlayer: () =>
    set({
      currentTime: 0,
      duration: 0,
      paused: true,
      buffering: false,
      playerReady: false,
      playerError: false,
      showHud: false,
      showSelector: false,
      showServerPicker: false,
      showQualityPicker: false,
      showSubtitlePicker: false,
      showSettingsPicker: false,
      autoPlayCountdown: null,
      qualityLevels: [],
      activeQualityIndex: -1,
      subtitleTracks: [],
      activeSubtitleIndex: 0,
    }),
}));
