import { useMemo } from 'react';

export interface Viewport {
  /** Em pixels CSS — o que o layout enxerga. */
  width: number;
  height: number;
  /** Pixels de dispositivo por pixel CSS (escala do SO × zoom do WebView). */
  dpr: number;
}

export interface NaturalSize {
  width: number;
  height: number;
}

export type FitMode = 'native' | 'downsampled' | 'upscaled';

export interface FrameFit {
  /** Tamanho final em pixels CSS. A altura é sempre a da tela. */
  cssWidth: number;
  cssHeight: number;
  /** Pixels de dispositivo por pixel do arquivo. Acima de 1 há interpolação. */
  deviceScale: number;
  mode: FitMode;
  /** Largura em px CSS que transborda da tela e vira travelling lateral. */
  overflowX: number;
  /** Fração da largura da obra que fica fora do quadro a cada instante. */
  croppedRatio: number;
  /** Barra lateral em px CSS, quando a obra é mais estreita que a tela. */
  pillarboxX: number;
}

/**
 * Enquadra a obra ocupando toda a altura da tela.
 *
 * A conta é em pixels de dispositivo, não em pixels CSS: numa tela a 150%,
 * 1 px CSS vale 1,5 px físico, e ignorar isso ampliaria a imagem em 50% sem
 * que a matemática percebesse.
 *
 * Ao contrário do enquadramento "contain", aqui a escala pode passar de 1 —
 * arquivos mais baixos que a tela precisam ser ampliados para preencher a
 * altura, e `mode: 'upscaled'` denuncia essa perda. O caminho para evitá-la
 * não é no render, e sim no acervo: `npm run art` busca as obras com altura
 * suficiente para o painel.
 */
export function useFrameFit(natural: NaturalSize | null, viewport: Viewport): FrameFit | null {
  return useMemo(() => {
    if (!natural?.width || !natural.height) return null;
    if (!viewport.width || !viewport.height) return null;

    const deviceH = viewport.height * viewport.dpr;
    const deviceScale = deviceH / natural.height;

    const cssHeight = viewport.height;
    const cssWidth = (natural.width * deviceScale) / viewport.dpr;

    const overflowX = Math.max(0, cssWidth - viewport.width);
    const pillarboxX = Math.max(0, viewport.width - cssWidth);

    const mode: FitMode =
      deviceScale > 1.001 ? 'upscaled' : deviceScale > 0.999 ? 'native' : 'downsampled';

    return {
      cssWidth,
      cssHeight,
      deviceScale,
      mode,
      overflowX,
      croppedRatio: cssWidth > 0 ? overflowX / cssWidth : 0,
      pillarboxX,
    };
  }, [natural, viewport.width, viewport.height, viewport.dpr]);
}
