import { test, expect } from '@playwright/test';
import path from 'path';

// Cada control de la revisión debe responder al primer clic, aunque haya un campo con el foco
test.describe('Revisión — un solo clic', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#certificados');
    await page.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/page1.jpg'));
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/destinatarios.csv'));
    await expect(page.locator('text=personas en la lista')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.locator('text=Revisa los nombres')).toBeVisible();
  });

  test('filas, filtros y atajos de vista previa cambian con un clic', async ({ page }) => {
    const reactErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') reactErrors.push(m.text());
    });
    const preview = page.locator('h3:has-text("Vista previa") + p');
    const rows = page.locator('tbody tr');

    // Con el foco dentro de un nombre, un clic en otra zona de otra fila la selecciona
    await rows.nth(0).getByRole('textbox').click();
    await rows.nth(3).locator('td').first().click();
    await expect(preview).toContainText('fila 4');
    await rows.nth(1).getByRole('textbox').click();
    await expect(preview).toContainText('fila 2');

    // Escribir y luego usar los atajos de la vista previa
    await page.keyboard.type(' Jr');
    await page.getByRole('button', { name: 'Nombre más largo' }).click();
    await expect(page.getByRole('button', { name: 'Nombre más largo' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Primera fila' }).click();
    await expect(preview).toContainText('fila 1');

    // Abrir y cerrar el ajuste individual no deja la página sin responder
    await rows.nth(2).getByRole('button', { name: /^Ajustar/ }).click();
    await expect(page.getByRole('button', { name: 'Restablecer a global' })).toBeVisible();
    await page.keyboard.press('Escape');
    await rows.nth(4).locator('td').first().click();
    await expect(preview).toContainText('fila 5');

    await rows.nth(0).getByRole('textbox').click();
    const listos = page.getByRole('button', { name: /^Listos/ });
    await listos.click();
    await expect(listos).toHaveAttribute('aria-pressed', 'true');

    expect(reactErrors.filter((t) => /React/.test(t))).toEqual([]);
  });
});
