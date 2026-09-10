import React from 'react';
import type { LayerMeasure } from './CanvasLayer';
import type { FrameFit, Viewport } from '../hooks/useFrameFit';
import type { MonitorInfo } from '../types/art';

interface QualityReadoutProps {
  measure: LayerMeasure | null;
  viewport: Viewport;
  monitor: MonitorInfo | null;
  isVisible: boolean;
}

const MODE: Record<FrameFit['mode'], { label: string; tone: string }> = {
  native: { label: '1:1 nativo', tone: 'bg-emerald-400/15 text-emerald-300/90' },
  downsampled: { label: 'reduzido', tone: 'bg-emerald-400/15 text-emerald-300/90' },
  upscaled: { label: 'ampliado', tone: 'bg-amber-400/15 text-amber-300/90' },
};

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-8">
    <span className="text-white/40">{label}</span>
    <span className="tabular-nums text-white/85">{children}</span>
  </div>
);

/** Diagnóstico do enquadramento — tecla `Q`. */
export const QualityReadout: React.FC<QualityReadoutProps> = ({
  measure,
  viewport,
  monitor,
  isVisible,
}) => {
  if (!isVisible) return null;

  const fit = measure?.fit ?? null;
  const natural = measure?.natural ?? null;

  const dpi = monitor?.dpiX ?? null;
  // Pixels do arquivo por polegada de tela — é isto, e não o DPI gravado no
  // JPEG, que diz a densidade com que a obra chega ao olho.
  const effectiveDpi = dpi && fit ? dpi * fit.deviceScale : null;

  return (
    <div className="absolute left-6 top-6 z-30 w-[23rem] rounded-xl border border-white/10 bg-black/70 p-5 font-mono text-xs backdrop-blur-md">
      <h2 className="mb-3 font-sans text-[0.7rem] uppercase tracking-[0.2em] text-white/35">
        Enquadramento
      </h2>

      <div className="space-y-1.5">
        <Row label="monitor">{monitor ? `${monitor.width}×${monitor.height}` : '—'}</Row>
        <Row label="tamanho físico">
          {monitor?.physicalWidthMm
            ? `${monitor.physicalWidthMm}×${monitor.physicalHeightMm} mm`
            : 'não informado'}
        </Row>
        <Row label="dpi da tela">{dpi ? dpi.toFixed(1) : '—'}</Row>
        <Row label="escala do so">{`${viewport.dpr.toFixed(2)}×`}</Row>

        <div className="!my-3 border-t border-white/10" />

        <Row label="arquivo">{natural ? `${natural.width}×${natural.height}` : '—'}</Row>
        <Row label="altura ocupada">100%</Row>
        <Row label="escala">{fit ? pct(fit.deviceScale) : '—'}</Row>
        <Row label="dpi efetivo">{effectiveDpi ? effectiveDpi.toFixed(1) : '—'}</Row>

        <div className="!my-3 border-t border-white/10" />

        <Row label="fora do quadro">{fit ? pct(fit.croppedRatio) : '—'}</Row>
        <Row label="percurso">{fit ? `${Math.round(fit.overflowX)} px` : '—'}</Row>
        <Row label="travelling">
          {measure ? `${(measure.holdMs / 1000).toFixed(1)} s` : '—'}
        </Row>

        <div className="!my-3 border-t border-white/10" />

        <div className="flex items-center justify-between gap-8">
          <span className="text-white/40">estado</span>
          <span className={`rounded px-2 py-0.5 font-sans text-[0.7rem] ${fit ? MODE[fit.mode].tone : ''}`}>
            {fit ? MODE[fit.mode].label : '—'}
          </span>
        </div>

        <p className="pt-2 font-sans text-[0.7rem] leading-relaxed text-white/30">
          {fit?.mode === 'upscaled'
            ? 'O arquivo é mais baixo que o painel e está sendo esticado. Rode `npm run art` para rebaixar as fontes com altura suficiente.'
            : fit && fit.croppedRatio > 0
              ? 'A obra preenche a altura. O que fica fora do quadro é percorrido pelo travelling antes da troca — nada deixa de ser visto.'
              : 'A obra cabe inteira na largura; não há nada a percorrer.'}
        </p>
      </div>
    </div>
  );
};
