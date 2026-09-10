import { useCallback, useEffect, useState } from 'react';
import type { Viewport } from './useFrameFit';

/**
 * Mede o palco em pixels CSS e a densidade em pixels de dispositivo.
 *
 * O `devicePixelRatio` muda sem disparar `resize` quando a janela atravessa
 * para um monitor com escala diferente, então ele é observado à parte por
 * `matchMedia`, que reage à mudança de resolução.
 */
export function useViewportMetrics(element: HTMLElement | null): Viewport {
  const [metrics, setMetrics] = useState<Viewport>({
    width: 0,
    height: 0,
    dpr: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
  });

  const measure = useCallback(() => {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setMetrics((prev) => {
      const next = {
        width: rect.width,
        height: rect.height,
        dpr: window.devicePixelRatio || 1,
      };
      return prev.width === next.width && prev.height === next.height && prev.dpr === next.dpr
        ? prev
        : next;
    });
  }, [element]);

  useEffect(() => {
    if (!element) return;
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, measure]);

  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener('change', measure);
    return () => query.removeEventListener('change', measure);
  }, [measure, metrics.dpr]);

  return metrics;
}
