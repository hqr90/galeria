import React, { useEffect, useState } from 'react';
import { useGalleryMotion, DWELL_MS } from '../hooks/useGalleryMotion';
import { useFrameFit } from '../hooks/useFrameFit';
import type { FrameFit, NaturalSize, Viewport } from '../hooks/useFrameFit';

export interface LayerMeasure {
  natural: NaturalSize;
  fit: FrameFit;
  /** Quanto a obra precisa ficar no ar para o travelling terminar. */
  holdMs: number;
}

interface CanvasLayerProps {
  assetUrl: string;
  isActive: boolean;
  minimumMs: number;
  viewport: Viewport;
  onMeasure?: (measure: LayerMeasure | null) => void;
}

/**
 * Uma das duas camadas do double-buffer.
 *
 * A obra ocupa toda a altura da tela e transborda na horizontal; o excedente
 * é percorrido pelo travelling, e não descartado. O `transform` cuida só do
 * deslocamento, com o tamanho de layout já resolvido — assim o Chromium
 * rasteriza uma vez na escala certa em vez de esticar um bitmap pronto.
 */
export const CanvasLayer: React.FC<CanvasLayerProps> = ({
  assetUrl,
  isActive,
  minimumMs,
  viewport,
  onMeasure,
}) => {
  const [animated, setAnimated] = useState(false);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const [natural, setNatural] = useState<NaturalSize | null>(null);

  const fit = useFrameFit(natural, viewport);
  const motion = useGalleryMotion(renderTrigger, fit, viewport, minimumMs);

  useEffect(() => setNatural(null), [assetUrl]);

  useEffect(() => {
    if (!isActive) return;
    onMeasure?.(
      natural && fit ? { natural, fit, holdMs: motion.panMs + DWELL_MS } : null,
    );
  }, [isActive, natural, fit, motion.panMs, onMeasure]);

  useEffect(() => {
    if (!isActive || !fit) return;

    setRenderTrigger((prev) => prev + 1);
    setAnimated(false);

    // Dois frames: o primeiro comita a posição inicial, o segundo inicia a
    // transição — sem isso o browser colapsa os dois estados em um só.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setAnimated(true));
    });

    return () => {
      cancelAnimationFrame(outer);
      if (inner) cancelAnimationFrame(inner);
    };
  }, [isActive, assetUrl, Boolean(fit)]);

  return (
    <div
      className={`absolute inset-0 overflow-hidden transition-opacity duration-[2000ms] ease-in-out ${
        isActive ? 'opacity-100 z-10' : 'opacity-0 z-0'
      }`}
    >
      {/* Só aparece quando a obra é mais estreita que a tela — evita duas
          barras pretas nas laterais. É decorativo; a nitidez está acima. */}
      {fit && fit.pillarboxX > 2 && (
        <img
          src={assetUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-3xl brightness-[0.3] saturate-150"
        />
      )}

      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={assetUrl}
          alt=""
          draggable={false}
          onLoad={(event) =>
            setNatural({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
          style={{
            width: fit ? `${fit.cssWidth}px` : undefined,
            height: fit ? `${fit.cssHeight}px` : undefined,
            maxWidth: 'none',
            visibility: fit ? 'visible' : 'hidden',
            transform: animated ? motion.to : motion.from,
            transitionProperty: 'transform',
            transitionDuration: `${motion.panMs}ms`,
            // Linear de propósito: um travelling que acelera e freia chamaria
            // atenção para si em vez de para a pintura.
            transitionTimingFunction: 'linear',
          }}
          className="pointer-events-none max-w-none select-none"
        />
      </div>
    </div>
  );
};
