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
 * Mide el ancho en puntos PDF de un texto utilizando Canvas 2D en el navegador o una estimación tipográfica robusta.
 */
export function measureBrowserTextWidth(
  text: string,
  fontSizePt: number,
  fontFamily: string,
  fontWeight: number | string = 400,
  fontStyle: string = 'normal'
): number {
  const isBold = fontWeight === 700 || fontWeight === 'bold' || String(fontWeight).includes('bold');
  const upperCount = (text.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length;
  const lowerCount = text.length - upperCount;

  // Factores realistas de ancho tipográfico por carácter en puntos PDF
  const charFactor = isBold ? 0.52 : 0.48;
  const upperFactor = isBold ? 0.68 : 0.60;
  const estimatedPt = (lowerCount * charFactor + upperCount * upperFactor) * fontSizePt;

  if (typeof document === 'undefined') return estimatedPt;
  if (!sharedCanvas) {
    sharedCanvas = document.createElement('canvas');
  }
  const ctx = sharedCanvas.getContext('2d');
  if (!ctx) return estimatedPt;

  // En Canvas 2D, 1pt = 1.3333px a 96 DPI
  const fontSizePx = fontSizePt * (96 / 72);
  const formattedFamily = fontFamily
    .split(',')
    .map((name) => {
      const trimmed = name.trim().replace(/^['"]|['"]$/g, '');
      return trimmed.includes(' ') ? `'${trimmed}'` : trimmed;
    })
    .join(', ');

  ctx.font = `${fontStyle} ${fontWeight} ${fontSizePx}px ${formattedFamily}`;
  const measuredPx = ctx.measureText(text).width;
  const measuredPt = measuredPx * (72 / 96);

  // Devolver el máximo entre la medición y la estimación para evitar falsos negativos en fuentes aún no cargadas
  return Math.max(measuredPt, estimatedPt);
}

/**
 * Calcula el tamaño exacto en píxeles de pantalla manteniendo el tamaño de fuente constante
 * o autoescalando suavemente si el nombre es muy largo para que quepa sin cortarse ni mostrar puntos suspensivos.
 */
export function calculateScreenFontSize(
  text: string,
  field: FieldBox,
  containerWidthPx: number,
  templateWidthPt: number
): number {
  if (!containerWidthPx || !templateWidthPt) {
    return Math.max(12, field.maxFontSize * 0.5);
  }

  const scale = containerWidthPx / templateWidthPt;
  const boxWidthPt = field.width * templateWidthPt;
  const fontWeight = field.isBold ? 700 : 400;
  const fontStyle = field.isItalic ? 'italic' : 'normal';

  if (text && text.trim().length > 0) {
    const optimal = calculateOptimalFontSize(
      text,
      field.maxFontSize,
      field.minFontSize || 14,
      boxWidthPt,
      (t, size) => measureBrowserTextWidth(t, size, field.fontFamily, fontWeight, fontStyle)
    );
    return optimal.fontSize * scale;
  }

  return field.maxFontSize * scale;
}
