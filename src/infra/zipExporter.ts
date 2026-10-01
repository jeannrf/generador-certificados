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
  const seenNames = new Map<string, number>();

  files.forEach(({ fileName, data }) => {
    let finalName = fileName;
    if (seenNames.has(fileName)) {
      const count = seenNames.get(fileName)! + 1;
      seenNames.set(fileName, count);
      finalName = fileName.replace(/\.pdf$/i, ` (${count}).pdf`);
    } else {
      seenNames.set(fileName, 1);
    }
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
