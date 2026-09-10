import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { ArtAsset, ArtItem } from '../types/art';

interface ArtState {
  playlist: ArtItem[];
  currentIndex: number;
  isPlaying: boolean;
  slideDuration: number; // ms
  isCaptionVisible: boolean;
  isQualityVisible: boolean;
  isInspecting: boolean;
  selectedDirectory: string | null;
  targetMonitorIndex: number | null;
  startFullscreen: boolean;

  setPlaylist: (items: ArtAsset[]) => void;
  nextSlide: () => void;
  previousSlide: () => void;
  togglePlay: () => void;
  toggleCaption: () => void;
  toggleQuality: () => void;
  setInspecting: (on: boolean) => void;
  setDirectory: (path: string) => void;
  setSlideDuration: (ms: number) => void;
  setTargetMonitor: (index: number | null) => void;
  setStartFullscreen: (on: boolean) => void;
}

/** Fisher-Yates: embaralha a fila sem viés de posição. */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const useArtStore = create<ArtState>()(
  persist(
    (set) => ({
      playlist: [],
      currentIndex: 0,
      isPlaying: true,
      slideDuration: 26000,
      isCaptionVisible: true,
      isQualityVisible: false,
      isInspecting: false,
      selectedDirectory: null,
      targetMonitorIndex: null,
      startFullscreen: true,

      setPlaylist: (items) => {
        const prepared = shuffle(
          items.map((item) => ({ ...item, assetUrl: convertFileSrc(item.path) })),
        );
        set({ playlist: prepared, currentIndex: 0 });
      },

      nextSlide: () =>
        set((state) => ({
          currentIndex: (state.currentIndex + 1) % (state.playlist.length || 1),
        })),

      previousSlide: () =>
        set((state) => ({
          currentIndex:
            state.currentIndex === 0
              ? Math.max(state.playlist.length - 1, 0)
              : state.currentIndex - 1,
        })),

      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      toggleCaption: () => set((state) => ({ isCaptionVisible: !state.isCaptionVisible })),
      toggleQuality: () => set((state) => ({ isQualityVisible: !state.isQualityVisible })),
      setInspecting: (on) => set({ isInspecting: on }),
      setDirectory: (path) => set({ selectedDirectory: path }),
      setSlideDuration: (ms) => set({ slideDuration: ms }),
      setTargetMonitor: (index) => set({ targetMonitorIndex: index }),
      setStartFullscreen: (on) => set({ startFullscreen: on }),
    }),
    {
      name: 'framecast-prefs',
      // A fila é reconstruída a cada abertura; só as preferências persistem.
      partialize: (state) => ({
        slideDuration: state.slideDuration,
        isCaptionVisible: state.isCaptionVisible,
        selectedDirectory: state.selectedDirectory,
        targetMonitorIndex: state.targetMonitorIndex,
        startFullscreen: state.startFullscreen,
      }),
    },
  ),
);
