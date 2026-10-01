import { FieldBox } from './types';

export interface PdfBoxCoords {
  xPt: number;
  yPt: number; // Coordenada Y en sistema PDF (origen abajo-izquierda)
  widthPt: number;
  heightPt: number;
}

/**
 * Convierte coordenadas normalizadas (0 a 1, origen arriba-izquierda)
 * a coordenadas PDF en puntos tipográficos (72 DPI, origen abajo-izquierda).
 */
export function normalizedToPdfCoords(
  box: FieldBox,
  pageWidthPt: number,
  pageHeightPt: number
): PdfBoxCoords {
  const xPt = box.x * pageWidthPt;
  const widthPt = box.width * pageWidthPt;
  const heightPt = box.height * pageHeightPt;
  
  // En PDF el origen (0,0) está en la esquina inferior izquierda.
  // La base inferior de la caja está en:
  const yPt = pageHeightPt - (box.y + box.height) * pageHeightPt;

  return {
    xPt,
    yPt,
    widthPt,
    heightPt,
  };
}

/**
 * Calcula el tamaño óptimo de fuente reduciendo de 0.5pt en 0.5pt hasta que quepa en la caja o llegue al mínimo.
 * @param text Texto a medir
 * @param maxFontSize Tamaño máximo en pt
 * @param minFontSize Tamaño mínimo en pt
 * @param boxWidthPt Ancho disponible en pt
 * @param measureFn Función que calcula el ancho del texto dado un tamaño de fuente
 */
export function calculateOptimalFontSize(
  text: string,
  maxFontSize: number,
  minFontSize: number,
  boxWidthPt: number,
  measureFn: (text: string, size: number) => number
): { fontSize: number; fits: boolean } {
  let currentSize = maxFontSize;
  const padding = 4; // Pequeño margen de seguridad interior en pt
  const targetWidth = Math.max(10, boxWidthPt - padding * 2);

  while (currentSize >= minFontSize) {
    const textWidth = measureFn(text, currentSize);
    if (textWidth <= targetWidth) {
      return { fontSize: currentSize, fits: true };
    }
    currentSize -= 0.5;
  }

  // Si llegó al mínimo y aún excede, devolvemos el mínimo pero indicamos fits = false
  return { fontSize: minFontSize, fits: false };
}
