import { describe, it, expect, vi } from 'vitest';
import {
  defaultFolderName,
  DriveBatch,
  driveBatchKey,
  driveFileUrl,
  idRequestSizes,
  pendingRecipientIds,
  sameAccount,
} from '../src/domain/drive';
import { createDriveClient, DriveApiError } from '../src/infra/drive/driveClient';
import { DriveAuthError } from '../src/infra/drive/googleAuth';
import { createTaskPool } from '../src/shared/taskPool';
import { createQrField, resolveFieldText, usesDriveLink, createNameField } from '../src/domain/fields';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: BodyInit | null;
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

/** fetch simulado que responde en orden y registra cada llamada */
function mockFetch(responses: Array<Response | Error>) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body,
    });
    const next = responses.shift();
    if (!next) throw new Error(`Llamada inesperada a ${url}`);
    if (next instanceof Error) throw next;
    return next;
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function client(responses: Array<Response | Error>, extra: { onUnauthorized?: () => void } = {}) {
  const { calls, fetchImpl } = mockFetch(responses);
  const sleep = vi.fn(async () => {});
  const drive = createDriveClient({ getToken: async () => 'token-123', fetchImpl, sleep, ...extra });
  return { drive, calls, sleep };
}

describe('Drive - reglas de dominio', () => {
  it('arma las URLs públicas de archivo', () => {
    expect(driveFileUrl('1AbC_d-9')).toBe('https://drive.google.com/file/d/1AbC_d-9/view');
  });

  it('nombra la carpeta con la plantilla (sin extensión) y la fecha', () => {
    expect(defaultFolderName('Diploma UNI.pdf', new Date(2026, 9, 5))).toBe('Certificados - Diploma UNI - 2026-10-05');
  });

  it('compara cuentas sin distinguir mayúsculas', () => {
    expect(sameAccount('Ana@Gmail.com', ' ana@gmail.com')).toBe(true);
    expect(sameAccount('ana@gmail.com', 'otra@gmail.com')).toBe(false);
  });

  it('respeta el máximo de 1.000 IDs por pedido', () => {
    expect(idRequestSizes(2500)).toEqual([1000, 1000, 500]);
    expect(idRequestSizes(0)).toEqual([]);
  });

  it('identifica un lote por plantilla y personas, sin importar el orden', () => {
    expect(driveBatchKey('tpl', ['b', 'a'])).toBe(driveBatchKey('tpl', ['a', 'b']));
    expect(driveBatchKey('tpl', ['a'])).not.toBe(driveBatchKey('tpl', ['a', 'b']));
  });

  it('calcula quiénes faltan por subir', () => {
    const batch = { uploaded: ['a', 'c'] } as DriveBatch;
    expect(pendingRecipientIds(batch, ['a', 'b', 'c', 'd'])).toEqual(['b', 'd']);
  });
});

describe('Drive - campos QR', () => {
  it('crea un QR cuadrado en puntos aunque la página no sea cuadrada', () => {
    const page = { id: 'p1', widthPt: 842, heightPt: 595 };
    const qr = createQrField(page, []);
    expect(qr.kind).toBe('qr');
    expect(qr.source).toEqual({ type: 'driveLink' });
    expect(qr.width * page.widthPt).toBeCloseTo(qr.height * page.heightPt, 6);
    expect(qr.x + qr.width).toBeLessThanOrEqual(1);
    expect(qr.y + qr.height).toBeLessThanOrEqual(1);
  });

  it('el enlace a Drive sale del contexto de cada certificado', () => {
    const qr = createQrField({ id: 'p1', widthPt: 600, heightPt: 800 }, []);
    const recipient = { name: 'Ana', extra: {} };
    expect(resolveFieldText(qr, recipient)).toBe('');
    expect(resolveFieldText(qr, recipient, { driveUrl: 'https://drive.google.com/file/d/x/view' })).toBe(
      'https://drive.google.com/file/d/x/view'
    );
  });

  it('detecta si algún campo necesita Drive', () => {
    const qr = createQrField({ id: 'p1', widthPt: 600, heightPt: 800 }, []);
    expect(usesDriveLink([createNameField('p1')])).toBe(false);
    expect(usesDriveLink([createNameField('p1'), qr])).toBe(true);
    expect(usesDriveLink([createNameField('p1'), { ...qr, source: { type: 'column', column: 'url' } }])).toBe(false);
  });
});

describe('Drive - cliente de la API', () => {
  it('crea la carpeta con el token del usuario', async () => {
    const { drive, calls } = client([jsonResponse(200, { id: 'folder1' })]);
    await expect(drive.createFolder('Certificados')).resolves.toEqual({ id: 'folder1' });
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('https://www.googleapis.com/drive/v3/files?fields=id');
    expect(calls[0].headers.Authorization).toBe('Bearer token-123');
    expect(JSON.parse(String(calls[0].body))).toEqual({ name: 'Certificados', mimeType: 'application/vnd.google-apps.folder' });
  });

  it('comparte la carpeta como lectura pública', async () => {
    const { drive, calls } = client([jsonResponse(200, { id: 'perm1' })]);
    await drive.shareWithAnyoneReader('folder1');
    expect(calls[0].url).toBe('https://www.googleapis.com/drive/v3/files/folder1/permissions?fields=id');
    expect(JSON.parse(String(calls[0].body))).toEqual({ role: 'reader', type: 'anyone' });
  });

  it('obtiene el correo de la cuenta con la que se inició sesión', async () => {
    const { drive, calls } = client([jsonResponse(200, { user: { emailAddress: 'ana@uni.pe' } })]);
    await expect(drive.getAccountEmail()).resolves.toBe('ana@uni.pe');
    expect(calls[0].url).toBe('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
  });

  it('reserva IDs en varios pedidos cuando son más de 1.000', async () => {
    const ids = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
    const { drive, calls } = client([
      jsonResponse(200, { ids: ids(1000, 'a') }),
      jsonResponse(200, { ids: ids(200, 'b') }),
    ]);
    const result = await drive.generateIds(1200);
    expect(result).toHaveLength(1200);
    expect(calls.map((c) => new URL(c.url).searchParams.get('count'))).toEqual(['1000', '200']);
  });

  it('sube un PDF pequeño en una sola petición multipart con su ID reservado', async () => {
    const { drive, calls } = client([jsonResponse(200, { id: 'file1' })]);
    const bytes = new TextEncoder().encode('%PDF-1.7 contenido');
    await expect(drive.uploadPdf({ id: 'file1', name: 'Ana.pdf', folderId: 'folder1', bytes })).resolves.toEqual({
      alreadyExisted: false,
    });
    expect(calls[0].url).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id');
    expect(calls[0].headers['Content-Type']).toBe('multipart/related; boundary=certificados_file1');
    const body = await (calls[0].body as Blob).text();
    expect(body).toContain('{"id":"file1","name":"Ana.pdf","parents":["folder1"],"mimeType":"application/pdf"}');
    expect(body).toContain('%PDF-1.7 contenido');
    expect(body.trimEnd().endsWith('--certificados_file1--')).toBe(true);
  });

  it('un 409 (el archivo ya existe) cuenta como subido: reintentar no duplica', async () => {
    const { drive } = client([jsonResponse(409, { error: { message: 'exists' } })]);
    await expect(
      drive.uploadPdf({ id: 'file1', name: 'Ana.pdf', folderId: 'f', bytes: new Uint8Array(10) })
    ).resolves.toEqual({ alreadyExisted: true });
  });

  it('los PDFs de más de 5 MB usan la subida reanudable', async () => {
    const { drive, calls } = client([
      new Response(null, { status: 200, headers: { Location: 'https://upload.example/session-1' } }),
      jsonResponse(200, { id: 'big' }),
    ]);
    const bytes = new Uint8Array(5 * 1024 * 1024 + 1);
    await drive.uploadPdf({ id: 'big', name: 'Grande.pdf', folderId: 'f', bytes });
    expect(calls[0].url).toBe('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id');
    expect(calls[0].headers['X-Upload-Content-Length']).toBe(String(bytes.length));
    expect(calls[1].url).toBe('https://upload.example/session-1');
    expect(calls[1].method).toBe('PUT');
    expect((calls[1].body as Blob).size).toBe(bytes.length);
  });

  it('reintenta con espera ante 503, 429, límite de uso y errores de red', async () => {
    const { drive, calls, sleep } = client([
      jsonResponse(503, { error: { message: 'backend' } }),
      jsonResponse(429, { error: { message: 'too many' } }),
      jsonResponse(403, { error: { message: 'rate', errors: [{ reason: 'userRateLimitExceeded' }] } }),
      new TypeError('Failed to fetch'),
      jsonResponse(200, { id: 'folder1' }),
    ]);
    await expect(drive.createFolder('X')).resolves.toEqual({ id: 'folder1' });
    expect(calls).toHaveLength(5);
    expect(sleep).toHaveBeenCalledTimes(4);
  });

  it('no reintenta un 403 que no es por límite de uso y explica la falta de espacio', async () => {
    const { drive, calls } = client([
      jsonResponse(403, { error: { message: 'quota', errors: [{ reason: 'storageQuotaExceeded' }] } }),
    ]);
    const err = await drive.createFolder('X').catch((e) => e);
    expect(err).toBeInstanceOf(DriveApiError);
    expect(err.message).toBe('Tu Google Drive no tiene espacio suficiente.');
    expect(calls).toHaveLength(1);
  });

  it('se rinde tras el máximo de reintentos', async () => {
    const { drive, calls } = client(Array.from({ length: 6 }, () => jsonResponse(500, { error: { message: 'down' } })));
    const err = await drive.createFolder('X').catch((e) => e);
    expect(err).toBeInstanceOf(DriveApiError);
    expect(err.status).toBe(500);
    expect(calls).toHaveLength(6);
  });

  it('un 401 avisa que la sesión expiró y no reintenta', async () => {
    const onUnauthorized = vi.fn();
    const { drive, calls } = client([jsonResponse(401, { error: { message: 'expired' } })], { onUnauthorized });
    await expect(drive.createFolder('X')).rejects.toBeInstanceOf(DriveAuthError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(1);
  });
});

describe('Pool de tareas', () => {
  it('nunca ejecuta más tareas a la vez que el máximo y las completa todas', async () => {
    const pool = createTaskPool(3);
    let running = 0;
    let maxRunning = 0;
    const done: number[] = [];
    for (let i = 0; i < 10; i++) {
      await pool.add(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((resolve) => setTimeout(resolve, 5 + (i % 3) * 3));
        running--;
        done.push(i);
      });
    }
    await pool.drain();
    expect(maxRunning).toBe(3);
    expect(done.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
