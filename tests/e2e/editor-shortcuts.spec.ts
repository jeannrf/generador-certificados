import { test, expect } from '@playwright/test';
import path from 'path';


test('Supr borra el campo seleccionado y Ctrl+Z / Ctrl+Shift+Z lo deshacen y rehacen', async ({ page }) => {
  await page.goto('/#certificados');
  await page.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/page1.jpg'));
  await page.locator('button:has-text("Continuar al siguiente paso")').click();
  await expect(page.getByRole('heading', { name: 'Agregar campos' })).toBeVisible();

  const campo = page.getByRole('button', { name: /^Campo 1/ });
  await page.getByRole('button', { name: 'Texto', exact: true }).click();
  await expect(campo).toBeVisible();

  // Supr borra el campo de texto seleccionado
  await page.keyboard.press('Delete');
  await expect(campo).toHaveCount(0);

  // Ctrl+Z lo devuelve, Ctrl+Shift+Z lo vuelve a quitar, y el botón Deshacer también funciona
  await page.keyboard.press('Control+z');
  await expect(campo).toBeVisible();
  await page.keyboard.press('Control+Shift+z');
  await expect(campo).toHaveCount(0);
  await page.getByRole('button', { name: 'Deshacer' }).click();
  await expect(campo).toBeVisible();

  // Retroceso dentro de un cuadro de texto borra letras, no el campo
  await campo.click();
  const nameInput = page.getByRole('textbox', { name: 'Nombre del campo' });
  await nameInput.click();
  await nameInput.press('End');
  await nameInput.press('Backspace');
  await expect(nameInput).toHaveValue('Campo ');
  await expect(page.getByRole('button', { name: /^Campo/ })).toHaveCount(1);

  // El nombre del destinatario es obligatorio: Supr no lo borra
  await page.getByRole('button', { name: /^Nombre del Destinatario/ }).click();
  await page.keyboard.press('Delete');
  await expect(page.getByRole('button', { name: /^Nombre del Destinatario/ })).toBeVisible();

  // Varias flechas seguidas se deshacen en un solo paso
  const box = page.locator('div.cursor-move').first();
  const before = await box.getAttribute('style');
  for (let i = 0; i < 5; i++) await page.keyboard.press('Shift+ArrowRight');
  await expect(box).not.toHaveAttribute('style', before!);
  await page.keyboard.press('Control+z');
  await expect(box).toHaveAttribute('style', before!);
});
