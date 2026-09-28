import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  /** serverTime - Date.now(), from /today or /live responses (ms). */
  serverOffsetMs: number;
  /** Group currently selected by the user (persisted). */
  selectedGroupId: string | null;
  setServerOffsetMs: (ms: number) => void;
  setSelectedGroupId: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      serverOffsetMs: 0,
      selectedGroupId: null,
      setServerOffsetMs: (serverOffsetMs) => set({ serverOffsetMs }),
      setSelectedGroupId: (selectedGroupId) => set({ selectedGroupId }),
    }),
    {
      name: "hc-app",
      partialize: (state) => ({ selectedGroupId: state.selectedGroupId }),
    }
  )
);
