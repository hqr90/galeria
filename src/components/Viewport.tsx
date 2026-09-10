import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useArtStore } from '../store/useArtStore';
import { useViewportMetrics } from '../hooks/useViewportMetrics';
import { CanvasLayer } from './CanvasLayer';
import type { LayerMeasure } from './CanvasLayer';
import { CaptionOverlay } from './CaptionOverlay';
import { QualityReadout } from './QualityReadout';
import { InspectorLayer } from './InspectorLayer';
import type { ArtItem, MonitorInfo } from '../types/art';

interface LayerState {
  a: ArtItem | null;
  b: ArtItem | null;
  active: 'a' | 'b';
}

interface ViewportProps {
  hudVisible: boolean;
}

const PRELOAD_LEAD_MS = 3000;
/** Se a obra não medir (arquivo corrompido, leitura travada), segue adiante. */
const STALL_TIMEOUT_MS = 8000;

export const Viewport: React.FC<ViewportProps> = ({ hudVisible }) => {
  const playlist = useArtStore((s) => s.playlist);
  const currentIndex = useArtStore((s) => s.currentIndex);
  const isPlaying = useArtStore((s) => s.isPlaying);
  const slideDuration = useArtStore((s) => s.slideDuration);
  const isCaptionVisible = useArtStore((s) => s.isCaptionVisible);
  const isQualityVisible = useArtStore((s) => s.isQualityVisible);
  const isInspecting = useArtStore((s) => s.isInspecting);
  const setInspecting = useArtStore((s) => s.setInspecting);
  const nextSlide = useArtStore((s) => s.nextSlide);

  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const viewport = useViewportMetrics(stage);

  const [layers, setLayers] = useState<LayerState>({ a: null, b: null, active: 'a' });
  const [measure, setMeasure] = useState<LayerMeasure | null>(null);
  const [monitor, setMonitor] = useState<MonitorInfo | null>(null);

  const current = playlist[currentIndex] ?? null;

  // O monitor pode mudar de DPI quando a janela troca de tela; o palco muda de
  // tamanho junto, então esta é a deixa para reler.
  useEffect(() => {
    invoke<MonitorInfo | null>('get_current_monitor')
      .then(setMonitor)
      .catch(() => setMonitor(null));
  }, [viewport.width, viewport.height, viewport.dpr]);

  // Alterna o buffer sempre que a obra corrente muda.
  useEffect(() => {
    if (!current) return;
    setLayers((prev) => {
      if (prev[prev.active]?.path === current.path) return prev;
      const nextActive = prev.active === 'a' ? 'b' : 'a';
      return { ...prev, [nextActive]: current, active: nextActive };
    });
  }, [current]);

  // A medição pertence à obra que está no ar; some junto com ela.
  useEffect(() => setMeasure(null), [currentIndex]);

  // O relógio só começa quando a obra foi medida: é a medida que diz quanto
  // tempo o travelling precisa para percorrer todo o trecho cortado.
  useEffect(() => {
    if (!isPlaying || isInspecting || playlist.length < 2) return;
    const wait = measure ? measure.holdMs : STALL_TIMEOUT_MS;
    const timer = window.setTimeout(nextSlide, wait);
    return () => window.clearTimeout(timer);
  }, [isPlaying, isInspecting, currentIndex, measure, playlist.length, nextSlide]);

  // Pré-carrega a próxima imagem antes do crossfade, para que discos lentos
  // nunca produzam um quadro preto.
  useEffect(() => {
    if (playlist.length < 2 || !measure) return;
    const next = playlist[(currentIndex + 1) % playlist.length];
    if (!next) return;

    const lead = Math.max(measure.holdMs - PRELOAD_LEAD_MS, 0);
    const timer = window.setTimeout(() => {
      const img = new Image();
      img.src = next.assetUrl;
    }, lead);

    return () => window.clearTimeout(timer);
  }, [currentIndex, playlist, measure]);

  const handleMeasure = useCallback((result: LayerMeasure | null) => setMeasure(result), []);

  const exitInspect = useCallback(() => setInspecting(false), [setInspecting]);

  return (
    <div
      ref={setStage}
      onDoubleClick={() => playlist.length > 0 && setInspecting(true)}
      className="absolute inset-0 overflow-hidden bg-black"
    >
      {current &&
        (['a', 'b'] as const).map((key) => {
          const item = layers[key];
          if (!item) return null;
          return (
            <CanvasLayer
              key={`${key}-${item.path}`}
              assetUrl={item.assetUrl}
              isActive={layers.active === key}
              minimumMs={slideDuration}
              viewport={viewport}
              onMeasure={layers.active === key ? handleMeasure : undefined}
            />
          );
        })}

      {current && (
        <CaptionOverlay
          filename={current.filename}
          position={currentIndex + 1}
          total={playlist.length}
          isVisible={isCaptionVisible && hudVisible}
          isPaused={!isPlaying}
        />
      )}

      {isInspecting && current && (
        <InspectorLayer
          assetUrl={current.assetUrl}
          filename={current.filename}
          viewport={viewport}
          onExit={exitInspect}
        />
      )}

      <QualityReadout
        measure={measure}
        viewport={viewport}
        monitor={monitor}
        isVisible={isQualityVisible && playlist.length > 0}
      />
    </div>
  );
};
