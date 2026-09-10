import { useMemo } from 'react';
import type { FrameFit, Viewport } from './useFrameFit';

export interface GalleryMotion {
  from: string;
  to: string;
  /** Duração do travelling, em ms. Nada de crossfade antes disso. */
  panMs: number;
}

/**
 * Segundos para o quadro visível se renovar por inteiro. Define a velocidade
 * do travelling em função da largura da tela, então o movimento é lido da
 * mesma forma num painel de 1080px ou de 2160px.
 */
const FRAME_RENEWAL_S = 15;

/** Respiro no fim do percurso, antes de trocar de obra. */
export const DWELL_MS = 1400;

/**
 * Travelling lateral que percorre **todo** o transbordo.
 *
 * Com a obra ancorada na altura da tela, a largura excedente é justamente o
 * que fica cortado a cada instante. O percurso vai de uma borda à outra da
 * pintura, de modo que nenhuma coluna de pixels deixe de ser vista dentro do
 * ciclo — cortar aqui adia, não elimina.
 *
 * Com a obra mais estreita que a tela não há o que percorrer, e ela fica
 * parada: qualquer deslocamento só mexeria nas barras laterais.
 */
export function useGalleryMotion(
  indexKey: number,
  fit: FrameFit | null,
  viewport: Viewport,
  minimumMs: number,
): GalleryMotion {
  return useMemo(() => {
    const still = {
      from: 'translate3d(0, 0, 0)',
      to: 'translate3d(0, 0, 0)',
      panMs: minimumMs,
    };

    if (!fit || fit.overflowX < 4 || !viewport.width) return still;

    // Centralizada, a obra tem metade do transbordo para cada lado; ir de
    // +metade a -metade encosta primeiro numa borda, depois na outra.
    const half = fit.overflowX / 2;
    const direction = Math.random() > 0.5 ? 1 : -1;

    const speedPxPerS = viewport.width / FRAME_RENEWAL_S;
    const panMs = Math.max(minimumMs, (fit.overflowX / speedPxPerS) * 1000);

    return {
      from: `translate3d(${(direction * half).toFixed(1)}px, 0, 0)`,
      to: `translate3d(${(-direction * half).toFixed(1)}px, 0, 0)`,
      panMs: Math.round(panMs),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexKey, fit?.overflowX, viewport.width, minimumMs]);
}
