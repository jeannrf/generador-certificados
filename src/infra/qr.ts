import { create as createQrCode } from 'qrcode';

export interface QrMatrix {
  size: number;
  isDark: (row: number, col: number) => boolean;
}

/** Margen blanco alrededor del código, en módulos. El estándar pide 4; 2 basta sobre un fondo propio. */
export const QR_QUIET_ZONE = 2;

/**
 * Módulos del código QR para un texto (corrección de errores M: tolera ~15 % de daño).
 */
export function qrMatrix(text: string): QrMatrix {
  const { modules } = createQrCode(text, { errorCorrectionLevel: 'M' });
  return {
    size: modules.size,
    isDark: (row, col) => modules.get(row, col) === 1,
  };
}

/**
 * Tramos horizontales de módulos oscuros por fila: [fila, columnaInicio, largo].
 * Dibujar tramos en vez de módulos sueltos reduce mucho el tamaño del PDF y del SVG.
 */
export function qrDarkRuns(matrix: QrMatrix): Array<[number, number, number]> {
  const runs: Array<[number, number, number]> = [];
  for (let row = 0; row < matrix.size; row++) {
    let start = -1;
    for (let col = 0; col <= matrix.size; col++) {
      const dark = col < matrix.size && matrix.isDark(row, col);
      if (dark && start === -1) start = col;
      if (!dark && start !== -1) {
        runs.push([row, start, col - start]);
        start = -1;
      }
    }
  }
  return runs;
}
