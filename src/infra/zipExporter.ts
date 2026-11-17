import { zipSync } from 'fflate';

export interface FileToZip {
  fileName: string;
  data: Uint8Array;
}

/**
 * Empaqueta una lista de archivos PDF en un archivo .ZIP listo para descargar en el navegador.
 */
export function createZipArchive(files: FileToZip[]): Blob {
  const zipObj: Record<string, Uint8Array> = {};
  // Sin distinguir mayúsculas: "Ana.pdf" y "ana.pdf" se pisarían al descomprimir en Windows o macOS
  const usedNames = new Set<string>();

  files.forEach(({ fileName, data }) => {
    let finalName = fileName;
    // Se prueba " (2)", " (3)"… hasta dar con un nombre libre, para no pisar un archivo que ya se llame así
    for (let n = 2; usedNames.has(finalName.toLowerCase()); n++) {
      finalName = /\.pdf$/i.test(fileName) ? fileName.replace(/\.pdf$/i, ` (${n}).pdf`) : `${fileName} (${n})`;
    }
    usedNames.add(finalName.toLowerCase());
    zipObj[finalName] = data;
  });

  const zippedBytes = zipSync(zipObj, { level: 6 });
  return new Blob([zippedBytes as BlobPart], { type: 'application/zip' });
}

/**
 * Dispara la descarga de un archivo Blob en el navegador.
 */
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
