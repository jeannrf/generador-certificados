import { test, expect, Page, Locator } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// El nombre debe caer a la misma altura en el editor, en la vista previa y en el PDF
test('el nombre queda a la misma altura en el editor, la vista previa y el PDF', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/fontsource/fonts/**', (route) => {
    const match = route.request().url().match(/fonts\/([^@]+)@latest\/latin-(\d+)-(normal|italic)\.ttf$/);
    const file = match && path.resolve(process.cwd(), 'tests/fixtures/fonts', `${match[1]}-${match[2]}-${match[3]}.ttf`);
    if (!file || !existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, contentType: 'font/ttf', headers: { 'Access-Control-Allow-Origin': '*' }, body: readFileSync(file) });
  });

  await page.goto('/#certificados');
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/page1.jpg'));
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/destinatarios.csv'));
  await expect(page.locator('text=personas en la lista')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.locator('text=Revisa los nombres')).toBeVisible();

  const name = 'Ana María Pérez Rodríguez';
  const review = await baselineInBox(page, page.locator('div.absolute').filter({ has: page.getByText(name, { exact: true }) }).last());

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar PDF de muestra' }).click(),
  ]);
  const pdf = await getDocument({ data: new Uint8Array(readFileSync(await download.path())), verbosity: 0 }).promise;
  const pdfPage = await pdf.getPage(1);
  const { height: pageHeight } = pdfPage.getViewport({ scale: 1 });
  const item = (await pdfPage.getTextContent()).items.find((i) => 'str' in i && i.str === name) as { transform: number[] };
  const pdfBaseline = (pageHeight - item.transform[5]) / pageHeight;

  // Editor, con el mismo nombre como texto de prueba (el tamaño de letra depende del largo)
  await page.getByRole('button', { name: 'Atrás' }).click();
  await page.getByRole('button', { name: 'Atrás' }).click();
  await expect(page.locator('text=Ubica los datos en tu diseño')).toBeVisible();
  await page.getByLabel('Texto de prueba').fill(name);
  const editorBox = page.locator('div.cursor-move').filter({ has: page.getByText(name, { exact: true }) });
  const editor = await baselineInBox(page, editorBox);

  const pdfInBox = (pdfBaseline - editor.boxTop) / editor.boxHeight;
  // Margen: el navegador redondea la línea base al píxel. El desfase anterior del PDF era de ~0,09
  expect(Math.abs(editor.ratio - review.ratio)).toBeLessThan(0.025);
  expect(Math.abs(pdfInBox - review.ratio)).toBeLessThan(0.025);
});

/** Línea base del texto dentro de su caja (0 = arriba, 1 = abajo) y la caja relativa a la página */
async function baselineInBox(page: Page, box: Locator) {
  await page.evaluate(() => document.fonts.ready);
  return box.evaluate(async (el) => {
    const span = el.querySelector('span')!;
    // El tamaño de letra tiene transición: se mide cuando termina
    await Promise.all(span.getAnimations().map((a) => a.finished));
    const marker = document.createElement('i');
    marker.style.cssText = 'display:inline-block;width:0;height:0';
    span.appendChild(marker);
    const baseline = marker.getBoundingClientRect().bottom;
    marker.remove();
    const rect = el.getBoundingClientRect();
    const img = el.parentElement!.querySelector('img')!.getBoundingClientRect();
    return {
      ratio: (baseline - rect.top) / rect.height,
      boxTop: (rect.top - img.top) / img.height,
      boxHeight: rect.height / img.height,
    };
  });
}
