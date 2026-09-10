import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Viewport } from './components/Viewport';
import { FolderSelectorModal } from './components/FolderSelectorModal';
import { useIdleHud } from './hooks/useIdleHud';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useArtStore } from './store/useArtStore';

export default function App() {
  const playlist = useArtStore((s) => s.playlist);
  const isInspecting = useArtStore((s) => s.isInspecting);
  const [isSelectorOpen, setSelectorOpen] = useState(true);
  const [isFullscreen, setFullscreen] = useState(false);

  const hudVisible = useIdleHud(2000);
  const openSelector = useCallback(() => setSelectorOpen(true), []);

  useKeyboardShortcuts({
    onOpenSelector: openSelector,
    onFullscreenChange: setFullscreen,
    enabled: !isSelectorOpen,
  });

  const toggleFullscreen = useCallback(async () => {
    setFullscreen(await invoke<boolean>('toggle_fullscreen'));
  }, []);

  // O modal tambem entra em tela cheia ao iniciar; le o estado real da janela
  // para o icone nao ficar invertido.
  useEffect(() => {
    if (isSelectorOpen) return;
    void getCurrentWindow().isFullscreen().then(setFullscreen);
  }, [isSelectorOpen]);

  const hideCursor = !hudVisible && !isSelectorOpen && !isInspecting && playlist.length > 0;
  const showControls = hudVisible && !isSelectorOpen && !isInspecting && playlist.length > 0;

  return (
    <main className={`relative h-screen w-screen overflow-hidden bg-black ${hideCursor ? 'cursor-none' : ''}`}>
      <Viewport hudVisible={hudVisible} />

      <button
        type="button"
        onClick={() => void toggleFullscreen()}
        title={isFullscreen ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'}
        aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
        className={`absolute right-6 top-6 z-30 rounded-lg border border-white/15 bg-black/40 p-2.5 text-white/70 backdrop-blur-sm transition-opacity duration-700 hover:bg-white/10 hover:text-white ${
          showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {isFullscreen ? (
            <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
          ) : (
            <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
          )}
        </svg>
      </button>

      {isSelectorOpen && (
        <FolderSelectorModal
          onClose={() => setSelectorOpen(false)}
          closable={playlist.length > 0}
        />
      )}
    </main>
  );
}
