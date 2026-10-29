import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { qrDarkRuns, qrMatrix } from '../../src/infra/qr';

/**
 * Google se simula por completo: un script falso de inicio de sesión y respuestas de la API de Drive.
 * Cada pedido queda registrado para verificar qué haría la app contra Google.
 */

const GIS_STUB = `
  window.__tokenRequests = 0;
  window.google = { accounts: { oauth2: {
    initTokenClient: (config) => ({
      requestAccessToken: (overrides) => {
        window.__tokenRequests++;
        window.__prompts = (window.__prompts || []).concat(overrides && overrides.prompt);
        setTimeout(() => config.callback({ access_token: 'token-' + window.__tokenRequests, expires_in: 3600 }), 20);
      },
    }),
    hasGrantedAllScopes: () => true,
  } } };
`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Expose-Headers': 'Location',
};

interface Upload {
  id: string;
  name: string;
  parents: string[];
  pdf: Buffer;
  token: string;
}

interface DriveMock {
  folders: Array<{ name: string }>;
  permissions: Array<{ fileId: string; body: Record<string, string> }>;
  generatedIds: string[];
  uploads: Upload[];
}

function parseMultipart(body: Buffer): { metadata: Record<string, unknown>; pdf: Buffer } {
  const text = body.toString('latin1');
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.indexOf('}\r\n', jsonStart) + 1;
  const pdfStart = text.indexOf('%PDF');
  const pdfEnd = text.lastIndexOf('\r\n--');
  return {
    metadata: JSON.parse(text.slice(jsonStart, jsonEnd)),
    pdf: body.subarray(pdfStart, pdfEnd),
  };
}

async function mockGoogle(
  page: Page,
  options: { failOnceWith401For?: string; accountsByToken?: Record<string, string> } = {}
): Promise<DriveMock> {
  const mock: DriveMock = { folders: [], permissions: [], generatedIds: [], uploads: [] };
  let failed401 = false;

  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: GIS_STUB })
  );

  await page.route('https://www.googleapis.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(body) });

    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

    if (url.pathname === '/drive/v3/about') {
      const token = request.headers()['authorization']?.replace('Bearer ', '') ?? '';
      return json(200, { user: { emailAddress: options.accountsByToken?.[token] ?? 'organizador@uni.pe' } });
    }
    if (url.pathname === '/drive/v3/files/generateIds') {
      const count = Number(url.searchParams.get('count'));
      const ids = Array.from({ length: count }, (_, i) => `id-e2e-${mock.generatedIds.length + i}`);
      mock.generatedIds.push(...ids);
      return json(200, { ids });
    }
    if (url.pathname === '/drive/v3/files' && request.method() === 'POST') {
      mock.folders.push(request.postDataJSON());
      return json(200, { id: 'folder-e2e' });
    }
    const permission = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)\/permissions$/);
    if (permission) {
      mock.permissions.push({ fileId: permission[1], body: request.postDataJSON() });
      return json(200, { id: `perm-${mock.permissions.length}` });
    }
    if (url.pathname === '/upload/drive/v3/files' && url.searchParams.get('uploadType') === 'multipart') {
      const { metadata, pdf } = parseMultipart(request.postDataBuffer()!);
      if (metadata.id === options.failOnceWith401For && !failed401) {
        failed401 = true;
        return json(401, { error: { message: 'Token expirado' } });
      }
      mock.uploads.push({
        id: String(metadata.id),
        name: String(metadata.name),
        parents: metadata.parents as string[],
        pdf,
        token: request.headers()['authorization'],
      });
      return json(200, { id: metadata.id });
    }
    return json(404, { error: { message: `Ruta no simulada: ${url.pathname}` } });
  });

  return mock;
}

/** Cantidad de rellenos (rectángulos) de la primera página: el QR suma uno por tramo + el fondo. */
async function fillCount(pdf: Uint8Array): Promise<number> {
  const doc = await getDocument({ data: pdf, verbosity: 0 }).promise;
  const ops = await (await doc.getPage(1)).getOperatorList();
  return ops.fnArray.filter((fn) => fn === OPS.fill || fn === OPS.eoFill).length;
}

async function prepareBatchWithQr(page: Page) {
  await page.goto('/#certificados');
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/page1.jpg'));
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  // Paso 2: agregar el QR; por defecto abre el PDF en Drive
  await page.getByRole('button', { name: 'QR', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'PDF en Drive' })).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: 'test-results/drive-step2-qr.png', fullPage: true });
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  await page.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/destinatarios.csv'));
  await expect(page.locator('text=personas en la lista')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  // Paso 5: Drive viene activado porque hay un QR que lo necesita
  await expect(page.getByRole('checkbox', { name: /Guardar en mi Google Drive/ })).toBeChecked();
  // Sin conectar la cuenta de Google no se puede empezar
  await expect(page.getByRole('button', { name: /^Generar \d+ certificados?$/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Conectar con Google' }).click();
  await expect(page.locator('text=Conectado como organizador@uni.pe')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Generar \d+ certificados?$/ })).toBeEnabled();
}

test.describe('Certificados en Google Drive con QR', () => {
  test('crea la carpeta, la comparte y sube cada PDF con un QR que apunta a su propio archivo', async ({ page }) => {
    const mock = await mockGoogle(page);
    await prepareBatchWithQr(page);

    await page.getByRole('textbox', { name: 'Carpeta' }).fill('Certificados Software Week');
    await page.screenshot({ path: 'test-results/drive-step5-options.png', fullPage: true });
    await page.getByRole('button', { name: /^Generar \d+ certificados?$/ }).click();

    await expect(page.locator('text=certificados generados')).toBeVisible({ timeout: 30000 });
    const total = Number((await page.locator('h2:has-text("certificados generados")').textContent())!.match(/\d+/)![0]);
    await expect(page.locator(`text=${total} de ${total} guardados`)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: 'Abrir carpeta' })).toHaveAttribute(
      'href',
      'https://drive.google.com/drive/folders/folder-e2e'
    );
    await expect(page.getByRole('button', { name: '+ {enlace}' })).toBeVisible();
    await page.screenshot({ path: 'test-results/drive-step5-done.png', fullPage: true });

    // Una sola ventana de Google (al conectar, para elegir cuenta); generar reutiliza esa sesión
    expect(await page.evaluate(() => (window as unknown as { __prompts?: string[] }).__prompts)).toEqual(['select_account']);

    // Carpeta y permisos
    expect(mock.folders).toEqual([{ name: 'Certificados Software Week', mimeType: 'application/vnd.google-apps.folder' }]);
    expect(mock.permissions).toEqual([{ fileId: 'folder-e2e', body: { role: 'reader', type: 'anyone' } }]);

    // Una subida por persona, cada una con un ID reservado distinto y dentro de la carpeta
    expect(mock.generatedIds).toHaveLength(total);
    expect(mock.uploads).toHaveLength(total);
    expect(new Set(mock.uploads.map((u) => u.id))).toEqual(new Set(mock.generatedIds));
    for (const upload of mock.uploads) {
      expect(upload.parents).toEqual(['folder-e2e']);
      expect(upload.name).toMatch(/ - Certificado\.pdf$/);
      expect(upload.token).toBe('Bearer token-1');
    }

    // El QR de cada PDF codifica la URL de SU archivo (se reconstruye por la cantidad de tramos dibujados)
    const plain = (await fillCount(new Uint8Array(mock.uploads[0].pdf))) - (qrDarkRuns(qrMatrix(`https://drive.google.com/file/d/${mock.uploads[0].id}/view`)).length + 1);
    for (const upload of mock.uploads.slice(0, 3)) {
      const expected = qrDarkRuns(qrMatrix(`https://drive.google.com/file/d/${upload.id}/view`)).length + 1;
      expect((await fillCount(new Uint8Array(upload.pdf))) - plain).toBe(expected);
    }
  });

  test('si la sesión de Google vence a mitad, permite reconectar y sube solo lo que falta', async ({ page }) => {
    const mock = await mockGoogle(page, { failOnceWith401For: 'id-e2e-3' });
    await prepareBatchWithQr(page);
    await page.getByRole('button', { name: /^Generar \d+ certificados?$/ }).click();

    await expect(page.locator('text=certificados generados')).toBeVisible({ timeout: 30000 });
    const total = Number((await page.locator('h2:has-text("certificados generados")').textContent())!.match(/\d+/)![0]);
    const reconnect = page.getByRole('button', { name: 'Reconectar y continuar' });
    await expect(reconnect).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/drive-needs-auth.png', fullPage: true });
    const uploadedBefore = mock.uploads.length;
    expect(uploadedBefore).toBeLessThan(total);

    await reconnect.click();
    await expect(page.locator(`text=${total} de ${total} guardados`)).toBeVisible({ timeout: 15000 });

    // Cada archivo se subió exactamente una vez, y lo pendiente usó el token nuevo
    const ids = mock.uploads.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(mock.generatedIds));
    expect(mock.uploads.slice(uploadedBefore).every((u) => u.token === 'Bearer token-2')).toBe(true);
    expect(mock.folders).toHaveLength(1);
  });

  test('"Cambiar cuenta" guarda los certificados en la nueva cuenta', async ({ page }) => {
    const mock = await mockGoogle(page, { accountsByToken: { 'token-2': 'otra.cuenta@gmail.com' } });
    await prepareBatchWithQr(page);

    await page.getByRole('button', { name: 'Cambiar cuenta' }).click();
    await expect(page.locator('text=Conectado como otra.cuenta@gmail.com')).toBeVisible();
    await page.getByRole('button', { name: /^Generar \d+ certificados?$/ }).click();

    await expect(page.locator('text=certificados generados')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('link', { name: 'Abrir carpeta' })).toBeVisible({ timeout: 15000 });
    expect(mock.folders).toHaveLength(1);
    expect(mock.uploads.length).toBeGreaterThan(0);
    expect(mock.uploads.every((u) => u.token === 'Bearer token-2')).toBe(true);
  });
});
