import { test, expect } from '@playwright/test';
import path from 'path';

test('al recargar a mitad del asistente se recupera la plantilla, la lista y el paso', async ({ page }) => {
  await page.goto('/#certificados');
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/page1.jpg'));
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Ubica los datos en tu diseño')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();

  await page.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/destinatarios.csv'));
  await expect(page.getByText('personas en la lista')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect(page.getByText('Revisa los nombres')).toBeVisible();

  // La sesión se guarda en IndexedDB medio segundo después del último cambio
  await page.waitForTimeout(1200);
  page.on('dialog', (dialog) => dialog.accept());
  await page.reload();

  // Vuelve al mismo paso, con las mismas personas
  await expect(page.getByText('Revisa los nombres')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Ana María Pérez Rodríguez · fila 1')).toBeVisible();
  // En la tabla cada nombre es un campo editable
  const row = page.getByRole('row').filter({ hasText: 'inigo.pena@instituto.edu' });
  await expect(row.locator('input').first()).toHaveValue('Íñigo Peña Nuñez');

  // Y la plantilla sigue ahí: se puede generar sin volver a subir nada
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.getByRole('button', { name: /^Generar 10 certificados$/ }).click();
  await expect(page.getByRole('heading', { name: '10 certificados generados' })).toBeVisible({ timeout: 30000 });
});
