import { test, expect, Page, Route } from '@playwright/test';

/**
 * Envío de correos de punta a punta en el servicio "Correos" (sin PDF, para que sea rápido).
 * /api/send-email se simula: cada petición queda registrada para verificar qué saldría hacia Gmail.
 */

interface SentEmail {
  to: string;
  subject: string;
  html: string;
  senderName: string;
}

// Encabezados y datos con caracteres que antes rompían la interpolación o el HTML del correo
const CONTACTS = [
  'Nombre,Correo,C++,Nota (final',
  'Ana <Pérez>,ana@uni.pe,Avanzado,18',
  'Luis Soto,luis@uni.pe,Básico,US$& 15',
  "Sofía O'Connor,sofia@uni.pe,Intermedio,20",
].join('\n');

async function mockSendEmail(page: Page, respond: (email: SentEmail) => { status: number; body: unknown }) {
  const sent: SentEmail[] = [];
  await page.unroute('**/api/send-email');
  await page.route('**/api/send-email', (route: Route) => {
    const email = route.request().postDataJSON() as SentEmail;
    sent.push(email);
    const { status, body } = respond(email);
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return sent;
}

async function loadContacts(page: Page, csv = CONTACTS) {
  await page.goto('/#correos');
  await expect(page.getByRole('heading', { name: 'Carga tus contactos' })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: 'contactos.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByText('personas en la lista')).toBeVisible({ timeout: 10000 });
}

async function writeMessage(page: Page) {
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Redacta y envía tus correos' })).toBeVisible();
  await page.getByLabel('Asunto', { exact: true }).fill('[{C++}] Hola {nombre}');
  await page.locator('#email-body').fill('Hola {nombre},\n\nTu nota en {C++} es {Nota (final}.');
}

async function confirmSend(page: Page, people: number) {
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: `Enviar a ${people} ${people === 1 ? 'persona' : 'personas'}` }).click();
  await expect(dialog).toHaveCount(0);
}

test.describe('Envío de correos', () => {
  test('envía una prueba y luego un correo propio a cada persona de la lista', async ({ page }) => {
    const sent = await mockSendEmail(page, () => ({ status: 200, body: { ok: true } }));
    await loadContacts(page);
    await writeMessage(page);

    // La prueba llega al correo indicado con los datos de la primera persona
    await page.getByPlaceholder('tu.correo@ejemplo.com').fill('organizador@uni.pe');
    await page.getByRole('button', { name: 'Enviar prueba' }).click();
    await expect(page.getByText('Prueba enviada a organizador@uni.pe')).toBeVisible();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('organizador@uni.pe');
    expect(sent[0].subject).toBe('[Avanzado] Hola Ana <Pérez>');

    await page.getByRole('button', { name: 'Revisar y enviar a 3 personas' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText('Ya te enviaste una prueba a organizador@uni.pe.')).toBeVisible();
    await expect(dialog.getByText('[Avanzado] Hola Ana <Pérez>')).toBeVisible();
    await expect(dialog.getByText('Tu nota en Avanzado es 18.')).toBeVisible();
    await confirmSend(page, 3);

    await expect(page.getByRole('heading', { name: '¡Envío completado!' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('3 de 3 enviados')).toBeVisible();

    const mass = sent.slice(1);
    expect(mass.map((m) => m.to)).toEqual(['ana@uni.pe', 'luis@uni.pe', 'sofia@uni.pe']);
    expect(mass.map((m) => m.subject)).toEqual([
      '[Avanzado] Hola Ana <Pérez>',
      '[Básico] Hola Luis Soto',
      "[Intermedio] Hola Sofía O'Connor",
    ]);
    // En el HTML los datos de la lista van escapados; en el asunto (texto) van tal cual
    expect(mass[0].html).toContain('Hola Ana &lt;Pérez&gt;,');
    expect(mass[0].html).not.toContain('<Pérez>');
    expect(mass[1].html).toContain('Tu nota en Básico es US$&amp; 15.');
    expect(mass[2].html).toContain('Hola Sofía O&#039;Connor,');
    // La prueba y el envío real llevan el mismo cuerpo para la misma persona
    expect(sent[0].html).toBe(mass[0].html);
  });

  test('reintenta el que falla, lo deja como fallido y tras recargar envía solo a quien falta', async ({ page }) => {
    let sent = await mockSendEmail(page, (email) =>
      email.to === 'luis@uni.pe'
        ? { status: 502, body: { ok: false, error: 'Gmail no aceptó el correo. Intenta de nuevo en unos minutos.' } }
        : { status: 200, body: { ok: true } }
    );
    await loadContacts(page);
    await writeMessage(page);

    await page.getByRole('button', { name: 'Revisar y enviar a 3 personas' }).click();
    await expect(page.getByRole('alertdialog').getByText('Aún no te enviaste una prueba con este mensaje.')).toBeVisible();
    await confirmSend(page, 3);

    await expect(page.getByRole('heading', { name: 'Envío incompleto' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('2 de 3 enviados')).toBeVisible();
    // Un fallo se reintenta una vez antes de darlo por fallido; los demás no se repiten
    expect(sent.map((m) => m.to)).toEqual(['ana@uni.pe', 'luis@uni.pe', 'luis@uni.pe', 'sofia@uni.pe']);
    const failedRow = page.getByRole('row').filter({ hasText: 'luis@uni.pe' });
    await expect(failedRow).toContainText('Falló');
    await expect(failedRow).toContainText('Gmail no aceptó el correo');

    // Recargar: la lista ya no está, pero el envío guardado permite seguir donde quedó
    page.on('dialog', (dialog) => dialog.accept());
    await page.reload();
    sent = await mockSendEmail(page, () => ({ status: 200, body: { ok: true } }));
    await expect(page.getByText('Tienes un envío guardado')).toBeVisible();
    await expect(page.getByText('2 de 3 enviados, faltan 1')).toBeVisible();
    await page.getByRole('button', { name: 'Ver envío' }).click();
    await expect(page.getByText('Recuperamos tu envío anterior')).toBeVisible();

    await page.getByRole('button', { name: 'Enviar a los 1 que faltan' }).click();
    await expect(page.getByRole('alertdialog').getByRole('heading', { name: '¿Enviar a 1 persona?' })).toBeVisible();
    await confirmSend(page, 1);

    await expect(page.getByRole('heading', { name: '¡Envío completado!' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('3 de 3 enviados')).toBeVisible();
    // Nadie que ya lo recibió vuelve a recibirlo
    expect(sent.map((m) => m.to)).toEqual(['luis@uni.pe']);
    expect(sent[0].subject).toBe('[Básico] Hola Luis Soto');
  });

  test('no envía a las filas sin correo o con correo inválido', async ({ page }) => {
    const sent = await mockSendEmail(page, () => ({ status: 200, body: { ok: true } }));
    await loadContacts(
      page,
      ['Nombre,Correo', 'Ana Pérez,ana@uni.pe', 'Sin Correo,', 'Correo Malo,no-es-correo', 'Dos Correos,a@uni.pe;b@uni.pe'].join('\n')
    );
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Redacta y envía tus correos' })).toBeVisible();

    await page.getByRole('button', { name: 'Revisar y enviar a 1 persona' }).click();
    await confirmSend(page, 1);
    await expect(page.getByRole('heading', { name: '¡Envío completado!' })).toBeVisible({ timeout: 20000 });
    expect(sent.map((m) => m.to)).toEqual(['ana@uni.pe']);
  });
});
