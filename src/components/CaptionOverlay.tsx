import React from 'react';

interface CaptionOverlayProps {
  filename: string;
  position: number;
  total: number;
  isVisible: boolean;
  isPaused: boolean;
}

/** "a-noite-estrelada_1889" -> "A Noite Estrelada 1889" */
function prettify(filename: string): string {
  // Nome vindo de museu já chega capitalizado; só um arquivo em minúsculas
  // precisa de ajuda, e aí a primeira letra basta. Title-case palavra por
  // palavra quebrava acento — o `\b` do JavaScript é ASCII, então "Eugène"
  // ganhava fronteira antes e depois do "è" e virava "EugÈNe" — e ainda
  // maiusculizava preposição ("at Deauville" → "At Deauville").
  const looksLikeSlug = !filename.includes(' ') && filename === filename.toLowerCase();
  const spaced = looksLikeSlug ? filename.replace(/[-_]+/g, ' ') : filename.replace(/_+/g, ' ');
  const clean = spaced.replace(/\s+/g, ' ').trim();
  return looksLikeSlug ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean;
}

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  filename,
  position,
  total,
  isVisible,
  isPaused,
}) => (
  <div
    className={`absolute inset-x-0 bottom-0 z-20 p-10 pointer-events-none transition-opacity duration-1000 ${
      isVisible ? 'opacity-100' : 'opacity-0'
    }`}
  >
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
    <div className="relative flex items-end justify-between gap-6">
      <h1 className="text-white/90 text-3xl font-light tracking-wide drop-shadow-lg">
        {prettify(filename)}
      </h1>
      <span className="text-white/50 text-sm tabular-nums whitespace-nowrap">
        {isPaused && <span className="mr-3 uppercase tracking-[0.2em]">pausado</span>}
        {position} / {total}
      </span>
    </div>
  </div>
);
