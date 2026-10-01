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

// Canvas singleton para mediciones rápidas en el navegador
let sharedCanvas: HTMLCanvasElement | null = null;

/**
 * Mide el ancho en píxeles de un texto en el navegador utilizando un Canvas 2D.
 */
export function measureBrowserTextWidth(
  text: string,
  fontSizePx: number,
  fontFamily: string,
  fontWeight: number | string = 400,
  fontStyle: string = 'normal'
): number {
  if (typeof document === 'undefined') return text.length * fontSizePx * 0.55;
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas');
  }
  const ctx = sharedCanvas.getContext('2d');
  if (!ctx) return text.length * fontSizePx * 0.55;

  // En Canvas 2D, los nombres de fuentes con espacios deben tener comillas para cumplir la especificación CSS Font
  const formattedFamily = fontFamily
    .split(',')
    .map((name) => {
      const trimmed = name.trim().replace(/^['"]|['"]$/g, '');
      return trimmed.includes(' ') ? `'${trimmed}'` : trimmed;
    })
    .join(', ');

  ctx.font = `${fontStyle} ${fontWeight} ${fontSizePx}px ${formattedFamily}`;
  const measured = ctx.measureText(text).width;
  const fallbackWidth = text.length * fontSizePx * 0.55;
  return Math.max(measured, fallbackWidth * 0.85);
}

/**
 * Calcula el tamaño exacto en píxeles de pantalla manteniendo el tamaño de fuente constante
 * según la escala del contenedor respecto a la plantilla.
 */
export function calculateScreenFontSize(
  _text: string,
  field: FieldBox,
  containerWidthPx: number,
  templateWidthPt: number
): number {
  if (!containerWidthPx || !templateWidthPt) {
    return Math.max(12, field.maxFontSize * 0.5);
  }

  const scale = containerWidthPx / templateWidthPt;
  return field.maxFontSize * scale;
}
