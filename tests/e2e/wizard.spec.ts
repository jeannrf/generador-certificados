import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Generador de Certificados — Flujo E2E Completo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('debe cargar la aplicación con el encabezado y el paso 1 activo', async ({ page }) => {
    await expect(page.locator('text=Generador de Certificados').first()).toBeVisible();
    await expect(page.locator('text=Sube la plantilla de tu certificado')).toBeVisible();
    await expect(page.locator('text=Plantilla').first()).toBeVisible();
  });

  test('debe completar el flujo completo desde la plantilla hasta la generación y el módulo de correos', async ({ page }) => {
    // 1. PASO 1: Elegir plantilla demo
    const demoButton = page.locator('button:has-text("Clásico Dorado")');
    await expect(demoButton).toBeVisible();
    await demoButton.click();

    // El botón Continuar debe activarse
    const continueBtnStep1 = page.locator('button:has-text("Continuar al siguiente paso")');
    await expect(continueBtnStep1).toBeEnabled();
    await continueBtnStep1.click();

    // 2. PASO 2: Editor de campo
    await expect(page.locator('text=Define la ubicación y el estilo del nombre')).toBeVisible();

    const continueBtnStep2 = page.locator('button:has-text("Guardar y Continuar")');
    await expect(continueBtnStep2).toBeVisible();
    await continueBtnStep2.click();

    // 3. PASO 3: Carga de lista de destinatarios
    await expect(page.locator('text=Carga la lista de destinatarios')).toBeVisible();

    // Subir archivo CSV de prueba mediante el input de archivo
    const csvPath = path.resolve(process.cwd(), 'samples/destinatarios_prueba.csv');
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
    await expect(page.locator('text=Generar y Distribuir Certificados')).toBeVisible();
    await expect(page.locator('text=Descarga Local (ZIP / PDF)')).toBeVisible();
    await expect(page.locator('text=Envío por Correo (Gmail)')).toBeVisible();

    // Iniciar generación masiva de prueba
    const startGenBtn = page.locator('button:has-text("Comenzar Generación")');
    await expect(startGenBtn).toBeVisible();
    await startGenBtn.click();

    // Esperar a que se complete la generación
    await expect(page.locator('text=Certificados generados con éxito')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('button:has-text("Descargar ZIP")')).toBeVisible();
    await expect(page.locator('button:has-text("Descargar PDF Único")')).toBeVisible();

    // Cambiar a la pestaña de Envío por Correo
    const emailTabBtn = page.locator('button:has-text("Envío por Correo (Gmail)")');
    await emailTabBtn.click();

    // Verificar sección "Pon tu correo y prueba"
    await expect(page.locator('text=Pon tu correo y prueba:')).toBeVisible();
    const testEmailInput = page.locator('input[placeholder="tu.correo@ejemplo.com"]');
    await expect(testEmailInput).toBeVisible();
    const sendTestBtn = page.locator('button:has-text("Enviar prueba")');
    await expect(sendTestBtn).toBeVisible();

    // Abrir modal de script y verificar código
    const viewScriptBtn = page.locator('button:has-text("Ver Script y Guía")');
    await viewScriptBtn.click();
    await expect(page.locator('text=Código para Google Apps Script')).toBeVisible();
    await expect(page.locator('button:has-text("Copiar Código")')).toBeVisible();

    // Cerrar modal
    await page.locator('button:has-text("Entendido, volver a la app")').click();
    await expect(page.locator('text=Código para Google Apps Script')).not.toBeVisible();
  });
});
