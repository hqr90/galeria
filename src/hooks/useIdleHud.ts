import { useEffect, useState } from 'react';

/**
 * Mantém HUD e cursor visíveis enquanto houver movimento do ponteiro e
 * os esconde após `delayMs` de repouso.
 */
export function useIdleHud(delayMs = 2000): boolean {
  const [isVisible, setVisible] = useState(true);

  useEffect(() => {
    let timer: number | undefined;

    const wake = () => {
      setVisible(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), delayMs);
    };

    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('mousedown', wake);
    window.addEventListener('keydown', wake);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('mousedown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [delayMs]);

  return isVisible;
}
