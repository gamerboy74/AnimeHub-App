import { create } from 'zustand';

export interface UIState {
  // Global Drawer & Modals
  drawerOpen: boolean;
  requestModalVisible: boolean;
  activeFilterChannel: string;
  isOffline: boolean;

  // In-App Dynamic Notification Banner
  activeToastNotification: {
    title: string;
    message: string;
    posterUrl?: string;
    actionUrl?: string;
    type?: string;
  } | null;

  // Actions
  setDrawerOpen: (open: boolean) => void;
  setRequestModalVisible: (visible: boolean) => void;
  setActiveFilterChannel: (channel: string) => void;
  setIsOffline: (offline: boolean) => void;
  showNotificationToast: (toast: { title: string; message: string; posterUrl?: string; actionUrl?: string; type?: string }) => void;
  hideNotificationToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  drawerOpen: false,
  requestModalVisible: false,
  activeFilterChannel: 'all',
  isOffline: false,
  activeToastNotification: null,

  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  setRequestModalVisible: (requestModalVisible) => set({ requestModalVisible }),
  setActiveFilterChannel: (activeFilterChannel) => set({ activeFilterChannel }),
  setIsOffline: (isOffline) => set({ isOffline }),
  showNotificationToast: (activeToastNotification) => set({ activeToastNotification }),
  hideNotificationToast: () => set({ activeToastNotification: null }),
}));

