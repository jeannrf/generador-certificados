import { useEffect, useState } from 'react';

/**
 * Vuelve a renderizar cuando el navegador termina de cargar fuentes.
 * El tamaño de letra en pantalla se calcula midiendo el texto con canvas: si se mide antes de que llegue
 * la fuente, se usa la de respaldo y el nombre queda con otro tamaño (y otra altura) que en el PDF.
 */
export function useRerenderOnFontLoad(): void {
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return;
    let active = true;
    const bump = () => {
      if (active) setVersion((v) => v + 1);
    };
    document.fonts.addEventListener('loadingdone', bump);
    document.fonts.ready.then(bump);
    return () => {
      active = false;
      document.fonts.removeEventListener('loadingdone', bump);
    };
  }, []);
}
