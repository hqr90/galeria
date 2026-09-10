import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useArtStore } from '../store/useArtStore';

interface Options {
  onOpenSelector: () => void;
  /** Recebe o estado resultante, para o icone do HUD nao divergir da janela. */
  onFullscreenChange?: (isFullscreen: boolean) => void;
  enabled?: boolean;
}

/**
 * F / F11 fullscreen · Space play-pause · setas navegam ·
 * I legenda · Z inspeção · Q diagnóstico · O seletor · Esc sai do fullscreen.
 */
export function useKeyboardShortcuts({
  onOpenSelector,
  onFullscreenChange,
  enabled = true,
}: Options) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      const {
        nextSlide, previousSlide, togglePlay, toggleCaption, toggleQuality,
        setInspecting, isInspecting,
      } = useArtStore.getState();

      // A camada de inspeção trata as próprias teclas por captura. Aqui só
      // silenciamos, sem desmontar o listener: desmontar deixaria o app sem
      // saída caso aquela camada não chegue a montar.
      if (isInspecting) return;

      switch (event.key) {
        case 'f':
        case 'F':
        case 'F11':
          event.preventDefault();
          void invoke<boolean>('toggle_fullscreen').then(onFullscreenChange);
          break;
        case ' ':
          event.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          event.preventDefault();
          nextSlide();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          previousSlide();
          break;
        case 'i':
        case 'I':
          toggleCaption();
          break;
        case 'z':
        case 'Z':
          event.preventDefault();
          setInspecting(true);
          break;
        case 'q':
        case 'Q':
          toggleQuality();
          break;
        case 'o':
        case 'O':
          onOpenSelector();
          break;
        case 'Escape':
          void invoke<boolean>('toggle_fullscreen', { force: false }).then(onFullscreenChange);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpenSelector, onFullscreenChange, enabled]);
}
