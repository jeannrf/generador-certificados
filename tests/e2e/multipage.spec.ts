import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';

const fixture = (name: string) => path.resolve(process.cwd(), 'tests/fixtures', name);

async function uploadTemplatePage(page: Page, file: string) {
  // El primer input de archivo es el de la zona de carga; los demás son para reemplazar
  await page.locator('input[type="file"]').first().setInputFiles(fixture(file));
}

async function downloadPdf(page: Page, buttonText: string): Promise<PDFDocument> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator(`button:has-text("${buttonText}")`).first().click(),
  ]);
  return PDFDocument.load(readFileSync(await download.path()));
}

test.describe('Plantillas multipágina', () => {
  test('arma una plantilla JPG + PNG + PDF, ubica campos por página y genera un PDF por persona', async ({ page }) => {
    await page.goto('/#certificados');

    // 1. PASO 1: tres páginas en formatos distintos
    await uploadTemplatePage(page, 'page1.jpg');
    await expect(page.locator('text=1 / 5 páginas')).toBeVisible();
    await uploadTemplatePage(page, 'page2.png');
    await uploadTemplatePage(page, 'page3.pdf');
    await expect(page.locator('text=3 / 5 páginas')).toBeVisible();

    // Un PDF de 6 páginas supera el límite con un error claro y no cambia la plantilla
    await uploadTemplatePage(page, 'six-pages.pdf');
    await expect(page.getByRole('alert')).toContainText('"six-pages.pdf" aporta 6 páginas y solo quedan 2 lugares');
    await expect(page.locator('text=3 / 5 páginas')).toBeVisible();

    // Un archivo con extensión válida pero contenido falso se rechaza
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'falso.png',
      mimeType: 'image/png',
      buffer: Buffer.from('esto no es una imagen'),
    });
    await expect(page.getByRole('alert')).toContainText('"falso.png" no es un PDF, PNG ni JPG válido');

    // Reordenar: bajar la página 1 y volver a subirla
    const pageList = page.getByRole('list', { name: 'Orden de las páginas' });
    await page.getByRole('button', { name: 'Bajar página 1' }).click();
    await expect(pageList.locator('li').first()).toContainText('page2.png');
    await page.getByRole('button', { name: 'Subir página 2' }).click();
    await expect(pageList.locator('li').first()).toContainText('page1.jpg');
    await page.screenshot({ path: 'test-results/multipage-step1.png', fullPage: true });

    await page.locator('button:has-text("Continuar al siguiente paso")').click();

    // 2. PASO 2: el nombre queda en la página 1; la página 3 empieza vacía
    await expect(page.locator('text=Define la ubicación y el estilo de los campos')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Pág\. 1/ })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: /Pág\. 3/ }).click();
    await expect(page.locator('text=Esta página no tiene campos')).toBeVisible();

    // Campo de columna "Curso" en la página 2
    await page.getByRole('tab', { name: /Pág\. 2/ }).click();
    await page.locator('button:has-text("Agregar un campo aquí")').click();
    await page.getByRole('textbox', { name: 'Nombre del campo' }).fill('Curso');
    await page.getByRole('radio', { name: 'Columna de la lista' }).click();
    // Sin lista cargada todavía, la columna se elige en el Paso 3
    await expect(page.locator('text=Elegirás qué columna usar cuando subas tu lista en el Paso 3.')).toBeVisible();
    await page.screenshot({ path: 'test-results/multipage-step2.png', fullPage: true });

    // La página 3 queda sin campos (reverso fijo)
    await page.locator('button:has-text("Guardar y Continuar")').click();

    // 3. PASO 3: lista
    await page.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/destinatarios.csv'));
    await expect(page.locator('text=registros detectados')).toBeVisible({ timeout: 10000 });
    // El campo "Curso" se asignó solo a la columna "Curso" de la lista
    await expect(page.getByRole('combobox', { name: 'Columna para Curso' })).toHaveValue('Curso');
    await page.locator('button:has-text("Revisar Destinatarios")').click();

    // 4. PASO 4: la vista previa navega por páginas y muestra el curso en la página 2
    await expect(page.locator('text=Revisión y validación de datos')).toBeVisible();
    await page.getByRole('tab', { name: /Pág\. 2/ }).click();
    await expect(page.locator('text=Inteligencia Artificial Aplicada').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/multipage-step4.png', fullPage: true });

    const sample = await downloadPdf(page, 'Descargar PDF');
    expect(sample.getPageCount()).toBe(3);
    expect(sample.getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())])).toEqual([
      [900, 636],
      [638, 825],
      [842, 595],
    ]);

    // 5. PASO 5: generación masiva
    await page.locator('button:has-text("Continuar a Generación")').click();
    await page.locator('button:has-text("Comenzar Generación")').click();
    await expect(page.locator('text=Certificados generados con éxito')).toBeVisible({ timeout: 30000 });

    // El ZIP trae un PDF de 3 páginas por persona
    const generated = Number((await page.locator('h2:has-text("generados con éxito")').textContent())!.match(/\d+/)![0]);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button:has-text("Descargar Archivo ZIP")').click(),
    ]);
    const files = Object.values(unzipSync(readFileSync(await download.path())));
    expect(files).toHaveLength(generated);
    expect(generated).toBeGreaterThanOrEqual(5);
    for (const file of files.slice(0, 3)) {
      expect((await PDFDocument.load(file)).getPageCount()).toBe(3);
    }
  });

  test('el paso 1 se ve bien en 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/#certificados');
    await uploadTemplatePage(page, 'page1.jpg');
    await uploadTemplatePage(page, 'page3.pdf');
    await expect(page.locator('text=2 / 5 páginas')).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(360);
    await page.screenshot({ path: 'test-results/multipage-mobile.png', fullPage: true });
  });
});
