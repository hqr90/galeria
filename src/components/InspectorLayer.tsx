import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { NaturalSize, Viewport } from '../hooks/useFrameFit';

interface InspectorLayerProps {
  assetUrl: string;
  filename: string;
  viewport: Viewport;
  onExit: () => void;
}

/** Diâmetro da lupa, em px CSS. */
const LOUPE_SIZE = 280;

/** 1 pixel do arquivo por pixel físico: o limite do detalhe que existe mesmo. */
const LOSSLESS_SCALE = 1;

/**
 * Teto do zoom. Passa do 1:1 porque examinar pincelada pede aproximação maior
 * que o arquivo sustenta — daí para cima o pixel é interpolado, e a interface
 * diz isso em vez de fingir detalhe. Acima de ~4× não há informação nova,
 * só o mesmo borrão maior.
 */
const MAX_SCALE = 4;

const ZOOM_STEP = 1.0015;

interface Point {
  x: number;
  y: number;
}

/**
 * Modo de inspeção: zoom livre e arrasto, com uma lupa que antecipa o 1:1.
 *
 * A escala é sempre contada em pixels de dispositivo por pixel do arquivo,
 * então `1` é exatamente o limite sem interpolação — o mesmo teto que o modo
 * automático respeita. O piso é o enquadramento que mostra a obra inteira.
 *
 * As dimensões são lidas aqui dentro, e não recebidas prontas: depender da
 * medição da camada de exibição fazia o modo não abrir quando ela ainda não
 * tinha chegado, sem nada na tela explicando por quê.
 */
export const InspectorLayer: React.FC<InspectorLayerProps> = ({
  assetUrl,
  filename,
  viewport,
  onExit,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);

  const [natural, setNatural] = useState<NaturalSize | null>(null);
  const [scale, setScale] = useState<number | null>(null);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [cursor, setCursor] = useState<Point | null>(null);
  const [isDragging, setDragging] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setNatural({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.src = assetUrl;
    return () => {
      cancelled = true;
      setNatural(null);
      setScale(null);
      setOffset({ x: 0, y: 0 });
    };
  }, [assetUrl]);

  const containScale = natural
    ? Math.min(
        (viewport.width * viewport.dpr) / natural.width,
        (viewport.height * viewport.dpr) / natural.height,
      )
    : 1;
  const minScale = Math.min(containScale, LOSSLESS_SCALE);

  // Abre com a obra inteira, não no enquadramento de altura cheia. Ali a base
  // já está perto do 1:1 e a lupa renderia 1,2× — indistinguível do fundo, e
  // parecendo quebrada. Da visão geral ela salta para ~2,2×, e o percurso
  // vira o natural: panorama primeiro, detalhe depois.
  useEffect(() => {
    if (natural && scale === null) setScale(minScale);
  }, [natural, scale, minScale]);

  /** Impede que a obra seja arrastada para fora de vista. */
  const clamp = useCallback(
    (next: Point, atScale: number): Point => {
      if (!natural) return next;
      const w = (natural.width * atScale) / viewport.dpr;
      const h = (natural.height * atScale) / viewport.dpr;
      const limitX = Math.max(0, (w - viewport.width) / 2);
      const limitY = Math.max(0, (h - viewport.height) / 2);
      return {
        x: Math.max(-limitX, Math.min(limitX, next.x)),
        y: Math.max(-limitY, Math.min(limitY, next.y)),
      };
    },
    [natural, viewport.width, viewport.height, viewport.dpr],
  );

  /** Ponto do arquivo, em pixels do próprio arquivo, sob uma coordenada da tela. */
  const toImagePoint = useCallback(
    (point: Point, atScale: number, atOffset: Point): Point | null => {
      if (!natural) return null;
      const w = (natural.width * atScale) / viewport.dpr;
      const h = (natural.height * atScale) / viewport.dpr;
      const left = viewport.width / 2 - w / 2 + atOffset.x;
      const top = viewport.height / 2 - h / 2 + atOffset.y;
      return {
        x: ((point.x - left) * viewport.dpr) / atScale,
        y: ((point.y - top) * viewport.dpr) / atScale,
      };
    },
    [natural, viewport.width, viewport.height, viewport.dpr],
  );

  // A roda amplia ancorada no cursor: o ponto sob o ponteiro não escorrega.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !natural) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };

      setScale((previous) => {
        if (previous === null) return previous;
        const next = Math.max(
          minScale,
          Math.min(MAX_SCALE, previous * Math.pow(ZOOM_STEP, -event.deltaY)),
        );
        if (next === previous) return previous;

        setOffset((currentOffset) => {
          const anchor = toImagePoint(point, previous, currentOffset);
          if (!anchor) return currentOffset;
          return clamp(
            {
              x:
                point.x -
                viewport.width / 2 +
                (natural.width * next) / viewport.dpr / 2 -
                (anchor.x * next) / viewport.dpr,
              y:
                point.y -
                viewport.height / 2 +
                (natural.height * next) / viewport.dpr / 2 -
                (anchor.y * next) / viewport.dpr,
            },
            next,
          );
        });

        return next;
      });
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [clamp, toImagePoint, minScale, natural, viewport]);

  const reset = useCallback(() => {
    setScale(minScale);
    setOffset({ x: 0, y: 0 });
  }, [minScale]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'z' || event.key === 'Z') {
        event.preventDefault();
        event.stopPropagation();
        onExit();
        return;
      }
      if (event.key === '0') reset();
      if (event.key === '1') setScale(LOSSLESS_SCALE);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onExit, reset]);

  const onPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    if (!isDragging || scale === null) return;
    setOffset((previous) =>
      clamp({ x: previous.x + event.movementX, y: previous.y + event.movementY }, scale),
    );
  };

  const endDrag = (event: React.PointerEvent) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  };

  const ready = natural !== null && scale !== null;
  const cssWidth = ready ? (natural.width * scale) / viewport.dpr : 0;
  const cssHeight = ready ? (natural.height * scale) / viewport.dpr : 0;

  // A lupa só existe enquanto há aumento a revelar; no 1:1 ela seria um
  // recorte idêntico ao fundo.
  const magnification = ready ? LOSSLESS_SCALE / scale : 1;
  const anchor = ready && cursor ? toImagePoint(cursor, scale, offset) : null;
  const showLoupe =
    ready &&
    !isDragging &&
    scale < LOSSLESS_SCALE * 0.999 &&
    anchor !== null &&
    anchor.x >= 0 &&
    anchor.y >= 0 &&
    anchor.x <= natural.width &&
    anchor.y <= natural.height;

  return (
    <div
      ref={stageRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => setCursor(null)}
      className={`absolute inset-0 z-40 overflow-hidden bg-black ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {ready ? (
        <img
          src={assetUrl}
          alt=""
          draggable={false}
          style={{
            width: `${cssWidth}px`,
            height: `${cssHeight}px`,
            maxWidth: 'none',
            transform: `translate3d(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px), 0)`,
          }}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
        />
      ) : (
        <p className="absolute inset-0 flex items-center justify-center font-mono text-xs text-white/40">
          medindo a obra…
        </p>
      )}

      {showLoupe && cursor && anchor && natural && (
        <div
          style={{
            left: `${cursor.x - LOUPE_SIZE / 2}px`,
            top: `${cursor.y - LOUPE_SIZE / 2}px`,
            width: `${LOUPE_SIZE}px`,
            height: `${LOUPE_SIZE}px`,
            backgroundImage: `url("${assetUrl}")`,
            // 1:1 em pixels de dispositivo, independente do zoom do fundo.
            backgroundSize: `${natural.width / viewport.dpr}px ${natural.height / viewport.dpr}px`,
            backgroundPosition: `${-(anchor.x / viewport.dpr - LOUPE_SIZE / 2)}px ${-(anchor.y / viewport.dpr - LOUPE_SIZE / 2)}px`,
            backgroundRepeat: 'no-repeat',
            backgroundColor: '#000',
          }}
          className="pointer-events-none absolute rounded-full border-2 border-white/70 shadow-2xl shadow-black/80 ring-1 ring-black/60"
        >
          <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2 py-0.5 font-mono text-[0.7rem] tabular-nums text-white/70">
            {magnification.toFixed(1)}×
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-8">
        <div className="flex items-end justify-between gap-8">
          <div>
            <p className="text-lg font-light text-white/85">{filename}</p>
            <p className="mt-1 font-mono text-xs text-white/40">
              {natural ? `${natural.width}×${natural.height}` : '…'}
              {ready ? ` · zoom ${(scale * 100).toFixed(0)}%` : ''}
              {ready && scale < LOSSLESS_SCALE * 0.999
                ? ` · lupa a ${magnification.toFixed(1)}×`
                : ''}
              {ready && Math.abs(scale - LOSSLESS_SCALE) < 0.001 ? ' · 1:1' : ''}
              {ready && scale > LOSSLESS_SCALE * 1.001 ? (
                <span className="text-amber-300/80">
                  {` · ${(scale / LOSSLESS_SCALE).toFixed(1)}× acima do 1:1 · interpolado`}
                </span>
              ) : null}
            </p>
          </div>
          <p className="font-mono text-[0.7rem] leading-relaxed text-white/35">
            roda: zoom · arrastar: mover · 0: obra inteira · 1: 1:1 · Z/Esc: sair
          </p>
        </div>
      </div>
    </div>
  );
};
