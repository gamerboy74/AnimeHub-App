import { create } from 'zustand';
import type { DownloadedEpisode, DownloadStatus, ActiveDownloadInfo } from '../types/downloads';
import {
  getAllDownloads,
  deleteDownload as deleteDownloadFs,
} from '../hooks/useHlsDownloader';

export type { ActiveDownloadInfo };

export interface DownloadStoreState {
  // In-flight active download
  activeDownload: ActiveDownloadInfo | null;
  // All completed downloads from disk
  downloads: DownloadedEpisode[];
  loading: boolean;

  // Actions
  setActiveDownload: (download: ActiveDownloadInfo | null) => void;
  updateActiveProgress: (progress: number) => void;
  updateActiveStatus: (status: DownloadStatus, error?: string | null) => void;
  setDownloads: (downloads: DownloadedEpisode[]) => void;
  loadDownloads: () => Promise<void>;
  removeDownload: (episodeId: string) => Promise<void>;
}

export const useDownloadStore = create<DownloadStoreState>((set) => ({
  activeDownload: null,
  downloads: [],
  loading: false,

  setActiveDownload: (activeDownload) => set({ activeDownload }),

  updateActiveProgress: (progress) =>
    set((state) =>
      state.activeDownload ? { activeDownload: { ...state.activeDownload, progress } } : {}
    ),

  updateActiveStatus: (status, error = null) =>
    set((state) =>
      state.activeDownload
        ? {
            activeDownload: {
              ...state.activeDownload,
              status,
              error: error ?? state.activeDownload.error,
            },
          }
        : {}
    ),

  setDownloads: (downloads) => set({ downloads }),

  loadDownloads: async () => {
    set({ loading: true });
    try {
      const list = await getAllDownloads();
      set({ downloads: list, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  removeDownload: async (episodeId: string) => {
    // Optimistic remove from store
    set((state) => ({
      downloads: state.downloads.filter((d) => d.episodeId !== episodeId),
    }));
    try {
      await deleteDownloadFs(episodeId);
    } catch (e) {
      // Reload on failure to restore consistency
      const list = await getAllDownloads();
      set({ downloads: list });
    }
  },
}));
