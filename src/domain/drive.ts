/**
 * Reglas puras para guardar los certificados en Google Drive (ver ADR-010).
 * La API real vive en infra/drive.
 */

/** La API reserva como máximo 1.000 IDs por pedido (files.generateIds). */
export const DRIVE_MAX_IDS_PER_REQUEST = 1000;
/** La subida "multipart" es para archivos de hasta 5 MB; los más grandes usan subida reanudable. */
export const DRIVE_MULTIPART_LIMIT_BYTES = 5 * 1024 * 1024;

export function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

export function driveFolderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
}

/** URL de ejemplo para las vistas previas (el QR real se genera con el ID reservado en Drive). */
export const SAMPLE_DRIVE_URL = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view';

/** Nombre por defecto de la carpeta: "Certificados - <plantilla> - AAAA-MM-DD" */
export function defaultFolderName(templateName: string, date: Date): string {
  const base = templateName.replace(/\.(pdf|png|jpe?g)$/i, '').trim() || 'Plantilla';
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `Certificados - ${base} - ${day}`;
}

/** Gmail y Workspace no distinguen mayúsculas en el correo. */
export function sameAccount(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Divide `count` en pedidos que respetan el máximo de la API. */
export function idRequestSizes(count: number): number[] {
  const sizes: number[] = [];
  for (let remaining = count; remaining > 0; remaining -= DRIVE_MAX_IDS_PER_REQUEST) {
    sizes.push(Math.min(remaining, DRIVE_MAX_IDS_PER_REQUEST));
  }
  return sizes;
}

/** Estado persistido de una subida, para poder reanudarla sin duplicar archivos. */
export interface DriveBatch {
  /** Plantilla + personas: una subida solo se reanuda para el mismo lote */
  batchKey: string;
  folderId: string;
  folderName: string;
  /** Cuenta de Google dueña de la carpeta */
  accountEmail?: string;
  /** ID reservado en Drive para el certificado de cada persona */
  fileIds: Record<string, string>;
  /** Personas cuyo PDF ya está confirmado en Drive */
  uploaded: string[];
  createdAt: string;
}

export function driveBatchKey(templateId: string, recipientIds: string[]): string {
  return `${templateId}::${[...recipientIds].sort().join(',')}`;
}

export function pendingRecipientIds(batch: DriveBatch, recipientIds: string[]): string[] {
  const done = new Set(batch.uploaded);
  return recipientIds.filter((id) => !done.has(id));
}
