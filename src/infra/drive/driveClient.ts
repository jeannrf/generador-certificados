import { DRIVE_MULTIPART_LIMIT_BYTES, idRequestSizes } from '../../domain/drive';
import { DriveAuthError } from './googleAuth';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RATE_LIMIT_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded']);

export class DriveApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'DriveApiError';
  }
}

export interface DriveClientOptions {
  /** Token vigente; se vuelve a pedir en cada solicitud por si se renovó */
  getToken: () => Promise<string>;
  /** Llamado tras un 401 para que el próximo getToken pida un token nuevo */
  onUnauthorized?: () => void;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
}

export interface UploadPdfInput {
  /** ID reservado con generateIds: el QR ya apunta a él */
  id: string;
  name: string;
  folderId: string;
  bytes: Uint8Array;
}

async function readErrorReason(response: Response): Promise<{ message: string; reason?: string }> {
  try {
    const body = await response.json();
    return { message: body?.error?.message ?? response.statusText, reason: body?.error?.errors?.[0]?.reason };
  } catch {
    return { message: response.statusText };
  }
}

/**
 * Cliente mínimo de la API REST de Google Drive v3 (sin librerías de Google).
 * Reintenta con espera exponencial ante límites de uso y errores temporales del servidor.
 */
export function createDriveClient(options: DriveClientOptions) {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxRetries = options.maxRetries ?? 5;

  async function request(url: string, init: RequestInit, allowConflict = false): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const token = await options.getToken();
      let response: Response;
      try {
        response = await fetchImpl(url, {
          ...init,
          headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        // Error de red: se reintenta igual que un error temporal del servidor
        if (attempt >= maxRetries) throw new DriveApiError('No hay conexión con Google Drive.', 0);
        await sleep(backoffMs(attempt));
        continue;
      }

      if (response.ok || (allowConflict && response.status === 409)) return response;
      if (response.status === 401) {
        options.onUnauthorized?.();
        throw new DriveAuthError('La sesión de Google expiró. Vuelve a conectar tu cuenta para continuar.');
      }

      const { message, reason } = await readErrorReason(response);
      const retryable =
        RETRYABLE_STATUS.has(response.status) || (response.status === 403 && reason !== undefined && RATE_LIMIT_REASONS.has(reason));
      if (!retryable || attempt >= maxRetries) {
        if (response.status === 403 && reason === 'storageQuotaExceeded') {
          throw new DriveApiError('Tu Google Drive no tiene espacio suficiente.', 403);
        }
        throw new DriveApiError(`Google Drive respondió ${response.status}: ${message}`, response.status);
      }
      await sleep(backoffMs(attempt));
    }
  }

  function backoffMs(attempt: number): number {
    return Math.min(32_000, 2 ** attempt * 1000) + Math.floor(Math.random() * 500);
  }

  /** Correo de la cuenta con la que se inició sesión (funciona con el permiso drive.file). */
  async function getAccountEmail(): Promise<string> {
    const response = await request(`${API}/about?fields=user(emailAddress)`, { method: 'GET' });
    return String((await response.json())?.user?.emailAddress ?? '');
  }

  async function createFolder(name: string): Promise<{ id: string }> {
    const response = await request(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
    });
    return { id: (await response.json()).id };
  }

  /** "Cualquier persona con el enlace puede ver", aplicado a un solo archivo (la carpeta queda privada). */
  async function shareWithAnyoneReader(fileId: string): Promise<void> {
    await request(`${API}/files/${encodeURIComponent(fileId)}/permissions?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  }

  /** Reserva IDs de archivo para conocer la URL de cada PDF antes de subirlo. */
  async function generateIds(count: number): Promise<string[]> {
    const ids: string[] = [];
    for (const size of idRequestSizes(count)) {
      const response = await request(`${API}/files/generateIds?count=${size}&space=drive&type=files&fields=ids`, {
        method: 'GET',
      });
      ids.push(...((await response.json()).ids as string[]));
    }
    if (ids.length !== count) {
      throw new DriveApiError(`Google Drive reservó ${ids.length} de ${count} identificadores.`, 0);
    }
    return ids;
  }

  /**
   * Sube un PDF con su ID reservado. Si el archivo ya existe (subida anterior que sí llegó),
   * Drive responde 409 y se considera subido: así reintentar nunca duplica certificados.
   */
  async function uploadPdf(input: UploadPdfInput): Promise<{ alreadyExisted: boolean }> {
    const metadata = { id: input.id, name: input.name, parents: [input.folderId], mimeType: 'application/pdf' };

    if (input.bytes.length <= DRIVE_MULTIPART_LIMIT_BYTES) {
      const boundary = `certificados_${input.id}`;
      const body = new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
        `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
        input.bytes as BlobPart,
        `\r\n--${boundary}--`,
      ]);
      const response = await request(
        `${UPLOAD_API}/files?uploadType=multipart&fields=id`,
        { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
        true
      );
      return { alreadyExisted: response.status === 409 };
    }

    // Archivos grandes: subida reanudable en dos pasos (crear sesión y enviar el contenido)
    const session = await request(
      `${UPLOAD_API}/files?uploadType=resumable&fields=id`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'application/pdf',
          'X-Upload-Content-Length': String(input.bytes.length),
        },
        body: JSON.stringify(metadata),
      },
      true
    );
    if (session.status === 409) return { alreadyExisted: true };
    const location = session.headers.get('Location');
    if (!location) throw new DriveApiError('Google Drive no devolvió la dirección de subida.', session.status);
    await request(location, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: new Blob([input.bytes as BlobPart]),
    });
    return { alreadyExisted: false };
  }

  return { getAccountEmail, createFolder, shareWithAnyoneReader, generateIds, uploadPdf };
}

export type DriveClient = ReturnType<typeof createDriveClient>;
