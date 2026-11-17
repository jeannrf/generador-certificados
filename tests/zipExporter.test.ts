import { describe, it, expect } from 'vitest';
import { unzipSync } from 'fflate';
import { createZipArchive } from '../src/infra/zipExporter';
import { qrDarkRuns, qrMatrix, QrMatrix } from '../src/infra/qr';

const file = (fileName: string, byte: number) => ({ fileName, data: new Uint8Array([byte]) });

async function entries(blob: Blob): Promise<Record<string, number>> {
  const unzipped = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return Object.fromEntries(Object.entries(unzipped).map(([name, data]) => [name, data[0]]));
}

describe('createZipArchive', () => {
  it('empaqueta cada archivo con su contenido', async () => {
    const blob = createZipArchive([file('Ana - Certificado.pdf', 1), file('Íñigo Peña - Certificado.pdf', 2)]);
    expect(blob.type).toBe('application/zip');
    expect(await entries(blob)).toEqual({ 'Ana - Certificado.pdf': 1, 'Íñigo Peña - Certificado.pdf': 2 });
  });

  it('numera los nombres repetidos (homónimos) sin perder ninguno', async () => {
    const blob = createZipArchive([file('Ana.pdf', 1), file('Ana.pdf', 2), file('Ana.pdf', 3)]);
    expect(await entries(blob)).toEqual({ 'Ana.pdf': 1, 'Ana (2).pdf': 2, 'Ana (3).pdf': 3 });
  });

  it('no pisa un archivo que ya se llama como el renombrado', async () => {
    const blob = createZipArchive([file('a.pdf', 1), file('a.pdf', 2), file('a (2).pdf', 3), file('a.pdf', 4)]);
    const result = await entries(blob);
    expect(Object.keys(result)).toHaveLength(4);
    expect(Object.values(result).sort()).toEqual([1, 2, 3, 4]);
  });

  it('trata como repetidos los nombres que solo cambian en mayúsculas', async () => {
    expect(await entries(createZipArchive([file('Ana.pdf', 1), file('ANA.PDF', 2)]))).toEqual({
      'Ana.pdf': 1,
      'ANA (2).pdf': 2,
    });
  });

  it('numera también los nombres sin extensión .pdf', async () => {
    expect(await entries(createZipArchive([file('reporte', 1), file('reporte', 2)]))).toEqual({
      reporte: 1,
      'reporte (2)': 2,
    });
  });

  it('una lista vacía da un ZIP válido sin entradas', async () => {
    expect(await entries(createZipArchive([]))).toEqual({});
  });
});

describe('Código QR', () => {
  it('la matriz crece con el largo del texto y siempre es de un tamaño válido', () => {
    const short = qrMatrix('https://drive.google.com/file/d/abc/view');
    const long = qrMatrix(`https://drive.google.com/file/d/${'x'.repeat(200)}/view`);
    for (const matrix of [short, long]) expect((matrix.size - 17) % 4).toBe(0);
    expect(long.size).toBeGreaterThan(short.size);
  });

  it('los tramos cubren exactamente los módulos oscuros', () => {
    const matrix = qrMatrix('https://drive.google.com/file/d/1AbCdEf/view');
    const fromRuns = new Set<string>();
    for (const [row, start, length] of qrDarkRuns(matrix)) {
      expect(length).toBeGreaterThan(0);
      for (let col = start; col < start + length; col++) fromRuns.add(`${row},${col}`);
    }
    const dark = new Set<string>();
    for (let row = 0; row < matrix.size; row++) {
      for (let col = 0; col < matrix.size; col++) if (matrix.isDark(row, col)) dark.add(`${row},${col}`);
    }
    expect(fromRuns).toEqual(dark);
  });

  it('une los módulos contiguos y cierra el tramo al final de la fila', () => {
    const grid = ['##.#', '....', '####', '.#.#'];
    const matrix: QrMatrix = { size: 4, isDark: (row, col) => grid[row][col] === '#' };
    expect(qrDarkRuns(matrix)).toEqual([
      [0, 0, 2],
      [0, 3, 1],
      [2, 0, 4],
      [3, 1, 1],
      [3, 3, 1],
    ]);
  });
});
