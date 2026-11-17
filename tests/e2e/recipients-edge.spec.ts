import { test, expect } from '@playwright/test';
import path from 'path';

// Columnas con símbolos de expresión regular: antes rompían el nombre de archivo y la sección de correo
const LIST = [
  'Nombre,Correo,C++,Nota (final',
  'Ana Pérez,ana@uni.pe,Avanzado,18',
  "maría elena o'connor-pérez,maria@uni.pe,Básico,US$& 15",
  'Ana Pérez,ana2@uni.pe,Intermedio,20',
].join('\n');

test('una lista con columnas "C++" y "Nota (final" genera los certificados y deja lista la sección de correo', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/#certificados');
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/page1.jpg'));
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Ubica los datos en tu diseño')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  await page.locator('input[type="file"]').setInputFiles({ name: 'lista.csv', mimeType: 'text/csv', buffer: Buffer.from(LIST) });
  await expect(page.getByText('personas en la lista')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  // Revisión: el apellido compuesto lleva mayúscula en cada parte y el homónimo se avisa sin bloquear
  await expect(page.getByText('Revisa los nombres')).toBeVisible();
  await expect(page.getByText('Nombre duplicado en la lista')).toBeVisible();
  await page.getByRole('button', { name: 'Nombre más largo' }).click();
  await expect(page.getByText("maría elena o'connor-pérez · fila 2")).toBeVisible();
  await expect(page.getByText("María Elena O'Connor-Pérez", { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  await expect(page.getByText('Genera los certificados')).toBeVisible();
  await page.getByRole('button', { name: 'Generar 3 certificados' }).click();
  await expect(page.getByRole('heading', { name: '3 certificados generados' })).toBeVisible({ timeout: 30000 });

  // La sección de correo interpola las columnas con símbolos sin fallar
  await page.getByLabel('Asunto', { exact: true }).fill('{C++} · {Nota (final} · {nombre}');
  await page.getByRole('button', { name: 'Revisar y enviar a 3 personas' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByText('Avanzado · 18 · Ana Pérez')).toBeVisible();
  await page.keyboard.press('Escape');

  expect(pageErrors).toEqual([]);
});
