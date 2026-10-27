import { test, expect } from '@playwright/test';
import path from 'path';

test('un QR de columna sin coincidencia se asigna en el Paso 3 antes de continuar', async ({ page }) => {
  await page.goto('/#certificados');
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/page1.jpg'));
  await page.locator('button:has-text("Continuar al siguiente paso")').click();

  await page.getByRole('button', { name: 'QR', exact: true }).click();
  await page.getByRole('radio', { name: 'Columna' }).click();
  await expect(page.locator('text=Elegirás qué columna usar cuando subas tu lista en el Paso 3.')).toBeVisible();
  await page.locator('button:has-text("Guardar y Continuar")').click();

  await page.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/destinatarios.csv'));
  await expect(page.locator('text=registros detectados')).toBeVisible({ timeout: 10000 });

  // "Código QR" no coincide con ninguna columna: hay que elegirla y mientras tanto no se puede seguir
  const select = page.getByRole('combobox', { name: 'Columna para Código QR' });
  await expect(select).toHaveValue('');
  await expect(page.getByRole('alert').filter({ hasText: 'Elige la columna de "Código QR" para continuar.' })).toBeVisible();
  await expect(page.locator('button:has-text("Revisar Destinatarios")')).toBeDisabled();
  await page.screenshot({ path: 'test-results/paso3-columnas.png', fullPage: true });

  await select.selectOption('Correo');
  await expect(page.locator('button:has-text("Revisar Destinatarios")')).toBeEnabled();

  // De vuelta en el Paso 2 la columna aparece en un menú con las columnas reales
  await page.locator('button:has-text("Atrás")').click();
  await page.getByRole('button', { name: /^Código QR/ }).click();
  await expect(page.getByRole('combobox', { name: 'Columna de la lista' })).toHaveValue('Correo');
});
