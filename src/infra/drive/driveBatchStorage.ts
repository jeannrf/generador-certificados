import { DriveBatch } from '../../domain/drive';

const BATCH_KEY = 'certificates_drive_batch_v1';

/**
 * Guarda el progreso de la subida a Drive tras cada archivo, para reanudarla sin duplicar
 * certificados si se recarga o se cierra la página.
 */
export function saveDriveBatch(batch: DriveBatch): void {
  try {
    localStorage.setItem(BATCH_KEY, JSON.stringify(batch));
  } catch (err) {
    console.warn('No se pudo guardar el progreso de la subida a Drive:', err);
  }
}

/** Devuelve la subida guardada solo si corresponde al mismo lote (plantilla + personas). */
export function loadDriveBatch(batchKey: string): DriveBatch | null {
  try {
    const raw = localStorage.getItem(BATCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DriveBatch;
    if (!parsed || parsed.batchKey !== batchKey || !parsed.folderId || !parsed.fileIds) return null;
    return { ...parsed, uploaded: Array.isArray(parsed.uploaded) ? parsed.uploaded : [] };
  } catch (err) {
    console.warn('Error leyendo el progreso de la subida a Drive:', err);
    return null;
  }
}

export function clearDriveBatch(): void {
  try {
    localStorage.removeItem(BATCH_KEY);
  } catch (err) {
    console.warn('No se pudo borrar el progreso de la subida a Drive:', err);
  }
}
