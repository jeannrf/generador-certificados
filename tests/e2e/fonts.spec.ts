import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';

async function embeddedFontNames(bytes: Buffer): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  const names: string[] = [];
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (object instanceof PDFDict && object.get(PDFName.of('Subtype')) === PDFName.of('Type0')) {
      names.push(String(object.get(PDFName.of('BaseFont'))));
    }
  }
  return names;
}

test('busca una fuente, respeta sus estilos disponibles y la incrusta en el PDF', async ({ page }) => {
  // El CDN de fuentes se sirve desde tests/fixtures/fonts (sin depender de internet)
  await page.route('https://cdn.jsdelivr.net/fontsource/fonts/**', (route) => {
    const match = route.request().url().match(/fonts\/([^@]+)@latest\/latin-(\d+)-(normal|italic)\.ttf$/);
    const file = match && path.resolve(process.cwd(), 'tests/fixtures/fonts', `${match[1]}-${match[2]}-${match[3]}.ttf`);
    if (!file || !existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      status: 200,
      contentType: 'font/ttf',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: readFileSync(file),
    });
  });

  await page.goto('/#certificados');
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/page1.jpg'));
  await page.locator('button:has-text("Continuar al siguiente paso")').click();

  // Abrir el selector y buscar
  await page.getByRole('button', { name: /^Fuente: / }).click();
  await page.getByRole('searchbox', { name: 'Buscar fuente' }).fill('vibes');
  await expect(page.getByRole('listbox', { name: 'Fuentes' }).getByRole('option')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/font-picker.png', fullPage: true });

  // Filtrar por categoría
  await page.getByRole('searchbox', { name: 'Buscar fuente' }).fill('');
  await page.getByRole('group', { name: 'Categoría' }).getByRole('button', { name: 'Manuscrita' }).click();
  expect(await page.getByRole('listbox', { name: 'Fuentes' }).getByRole('option').count()).toBeGreaterThanOrEqual(20);

  // Elegir con Enter el primer resultado de la búsqueda
  await page.getByRole('searchbox', { name: 'Buscar fuente' }).fill('great vibes');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fuente: Great Vibes' })).toBeVisible();

  // Great Vibes no tiene negrita ni cursiva: los botones se desactivan
  await expect(page.getByRole('button', { name: 'B', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'I', exact: true })).toBeDisabled();

  await page.locator('button:has-text("Guardar y Continuar")').click();
  await page.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/destinatarios.csv'));
  await expect(page.locator('text=registros detectados')).toBeVisible({ timeout: 10000 });
  await page.locator('button:has-text("Revisar Destinatarios")').click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('button:has-text("Descargar PDF")').first().click(),
  ]);
  const fonts = await embeddedFontNames(readFileSync((await download.path())!));
  expect(fonts.some((name) => name.includes('GreatVibes-Regular'))).toBe(true);
});
