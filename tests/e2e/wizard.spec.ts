import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Generador de Certificados — Flujo E2E Completo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#certificados');
  });

  test('debe cargar la aplicación con el encabezado y el paso 1 activo', async ({ page }) => {
    await expect(page.locator('text=Uniautomate').first()).toBeVisible();
    await expect(page.locator('text=Sube la plantilla de tu certificado')).toBeVisible();
    await expect(page.locator('text=Plantilla').first()).toBeVisible();
  });

  test('debe completar el flujo completo desde la plantilla hasta la generación y el módulo de correos', async ({ page }) => {
    // 1. PASO 1: Subir una plantilla de 1 página
    await page.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), 'tests/fixtures/page1.jpg'));
    await expect(page.locator('text=page1.jpg').first()).toBeVisible();

    // El botón Continuar debe activarse
    const continueBtnStep1 = page.locator('button:has-text("Continuar al siguiente paso")');
    await expect(continueBtnStep1).toBeEnabled();
    await continueBtnStep1.click();

    // 2. PASO 2: Editor de campo
    await expect(page.locator('text=Define la ubicación y el estilo de los campos')).toBeVisible();

    const continueBtnStep2 = page.locator('button:has-text("Guardar y Continuar")');
    await expect(continueBtnStep2).toBeVisible();
    await continueBtnStep2.click();

    // 3. PASO 3: Carga de lista de destinatarios
    await expect(page.locator('text=Carga la lista de destinatarios')).toBeVisible();

    // Subir archivo CSV de prueba mediante el input de archivo
    const csvPath = path.resolve(process.cwd(), 'tests/fixtures/destinatarios.csv');
    await page.locator('input[type="file"]').setInputFiles(csvPath);

    // Debe detectar los registros cargados
    await expect(page.locator('text=registros detectados')).toBeVisible({ timeout: 10000 });
    const continueBtnStep3 = page.locator('button:has-text("Revisar Destinatarios")');
    await expect(continueBtnStep3).toBeEnabled();
    await continueBtnStep3.click();

    // 4. PASO 4: Revisión de destinatarios
    await expect(page.locator('text=Revisión y validación de datos')).toBeVisible();
    await expect(page.locator('text=Ana María Pérez Rodríguez').first()).toBeVisible();

    const continueBtnStep4 = page.locator('button:has-text("Continuar a Generación")');
    await expect(continueBtnStep4).toBeVisible();
    await continueBtnStep4.click();

    // 5. PASO 5: Generación y Distribución
    await expect(page.locator('text=Generar Certificados')).toBeVisible();

    // Iniciar generación masiva de prueba
    const startGenBtn = page.locator('button:has-text("Comenzar Generación")');
    await expect(startGenBtn).toBeVisible();
    await startGenBtn.click();

    // Esperar a que se complete la generación
    await expect(page.locator('text=Certificados generados con éxito')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('button:has-text("Descargar Archivo ZIP")')).toBeVisible();
    await expect(page.locator('button:has-text("Descargar PDF Único")')).toHaveCount(0);

    // Sección de envío por correo, disponible tras generar
    await expect(page.locator('text=Asunto del Correo')).toBeVisible();
    await expect(page.locator('input[placeholder="tu.correo@ejemplo.com"]')).toBeVisible();
    await expect(page.locator('button:has-text("Enviar prueba")')).toBeVisible();
  });
});
