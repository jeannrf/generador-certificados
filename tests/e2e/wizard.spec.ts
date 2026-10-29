import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Generador de Certificados — Flujo E2E Completo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#certificados');
  });

  test('debe cargar la aplicación con el encabezado y el paso 1 activo', async ({ page }) => {
    await expect(page.getByRole('img', { name: 'Uniautomate' }).first()).toBeVisible();
    await expect(page.locator('text=Sube la plantilla de tu certificado')).toBeVisible();
    await expect(page.locator('text=Plantilla').first()).toBeVisible();
  });

  test('debe completar el flujo completo desde la plantilla hasta la generación y el módulo de correos', async ({ page }) => {
    // 1. PASO 1: Subir una plantilla de 1 página
    await page.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/page1.jpg'));
    await expect(page.locator('text=page1.jpg').first()).toBeVisible();

    // El botón Continuar debe activarse
    const continueBtnStep1 = page.getByRole('button', { name: 'Continuar', exact: true });
    await expect(continueBtnStep1).toBeEnabled();
    await continueBtnStep1.click();

    // 2. PASO 2: Editor de campo
    await expect(page.locator('text=Ubica los datos en tu diseño')).toBeVisible();

    const continueBtnStep2 = page.getByRole('button', { name: 'Continuar', exact: true });
    await expect(continueBtnStep2).toBeVisible();
    await continueBtnStep2.click();

    // 3. PASO 3: Carga de lista de destinatarios
    await expect(page.locator('text=Carga la lista de participantes')).toBeVisible();

    // Subir archivo CSV de prueba mediante el input de archivo
    const csvPath = path.resolve(process.cwd(), 'tests/fixtures/destinatarios.csv');
    await page.locator('input[type="file"]').setInputFiles(csvPath);

    // Debe detectar los registros cargados
    await expect(page.locator('text=personas en la lista')).toBeVisible({ timeout: 10000 });
    const continueBtnStep3 = page.getByRole('button', { name: 'Continuar', exact: true });
    await expect(continueBtnStep3).toBeEnabled();
    await continueBtnStep3.click();

    // 4. PASO 4: Revisión de destinatarios
    await expect(page.locator('text=Revisa los nombres')).toBeVisible();
    await expect(page.locator('text=Ana María Pérez Rodríguez').first()).toBeVisible();

    const continueBtnStep4 = page.getByRole('button', { name: 'Continuar', exact: true });
    await expect(continueBtnStep4).toBeVisible();
    await continueBtnStep4.click();

    // 5. PASO 5: Generación y Distribución
    await expect(page.locator('text=Genera los certificados')).toBeVisible();

    // Iniciar generación masiva de prueba
    const startGenBtn = page.getByRole('button', { name: /^Generar \d+ certificados?$/ });
    await expect(startGenBtn).toBeVisible();
    await startGenBtn.click();

    // Esperar a que se complete la generación
    await expect(page.locator('text=certificados generados')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('button:has-text("Descargar ZIP")')).toBeVisible();
    await expect(page.locator('button:has-text("Descargar PDF Único")')).toHaveCount(0);

    // Sección de envío por correo, disponible tras generar
    await expect(page.getByLabel('Asunto', { exact: true })).toBeVisible();
    await expect(page.locator('input[placeholder="tu.correo@ejemplo.com"]')).toBeVisible();
    await expect(page.locator('button:has-text("Enviar prueba")')).toBeVisible();

    // El envío masivo nunca sale con un clic: primero muestra qué se va a enviar
    let emailRequests = 0;
    await page.route('**/api/send-email', (route) => {
      emailRequests++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await page.getByRole('button', { name: /^Revisar y enviar a \d+ personas?$/ }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Aún no te enviaste una prueba con este mensaje.')).toBeVisible();
    await expect(dialog.getByText('desde el Gmail de Uniautomate')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();
    await page.screenshot({ path: 'test-results/wizard-confirm-send.png', fullPage: false });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(emailRequests).toBe(0);
  });
});
