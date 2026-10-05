import { describe, it, expect } from 'vitest';
import {
  interpolateEmailVariables,
  validateEmailConfig,
  buildDeliveryReportCsv,
  ensureHtmlEmailBody,
} from '../src/domain/email';
import { uint8ArrayToBase64 } from '../src/infra/email/googleAppsScript';
import { Recipient, EmailDeliveryRecord } from '../src/domain/types';

describe('Domain - Email Interpolation & Validation', () => {
  const sampleRecipient: Recipient = {
    id: 'rec_1',
    rowNumber: 1,
    name: 'Ana María Pérez Rodríguez',
    email: 'ana.perez@universidad.edu',
    extra: {
      Curso: 'Inteligencia Artificial',
      Horas: '40',
    },
    issues: [],
  };

  it('should interpolate variables with curly and square brackets', () => {
    const template = 'Hola {nombre}, tu certificado de [Curso] ({Horas} horas) ha sido emitido.';
    const result = interpolateEmailVariables(template, sampleRecipient);
    expect(result).toBe('Hola Ana María Pérez Rodríguez, tu certificado de Inteligencia Artificial (40 horas) ha sido emitido.');
  });

  it('should escape HTML when option is specified', () => {
    const dangerousRecipient: Recipient = {
      id: 'rec_2',
      rowNumber: 2,
      name: '<script>alert("hack")</script>',
      email: 'test@correo.com',
      extra: {},
      issues: [],
    };
    const template = '<p>Estimado {nombre}:</p>';
    const result = interpolateEmailVariables(template, dangerousRecipient, { escapeForHtml: true });
    expect(result).toBe('<p>Estimado &lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;:</p>');
  });

  it('should validate EmailConfig correctly', () => {
    const invalidConfig = { webAppUrl: 'https://other-site.com', subject: '' };
    const validation1 = validateEmailConfig(invalidConfig);
    expect(validation1.isValid).toBe(false);
    expect(validation1.errors.length).toBeGreaterThan(0);

    const validConfig = {
      webAppUrl: 'https://script.google.com/macros/s/AKfycbx123/exec',
      subject: 'Certificado de Asistencia',
    };
    const validation2 = validateEmailConfig(validConfig);
    expect(validation2.isValid).toBe(true);
    expect(validation2.errors.length).toBe(0);
  });

  it('should generate properly formatted delivery CSV report', () => {
    const records: EmailDeliveryRecord[] = [
      {
        recipientId: 'rec_1',
        name: 'Ana María',
        email: 'ana@correo.com',
        status: 'sent',
        sentAt: '2026-10-01T17:00:00Z',
      },
      {
        recipientId: 'rec_2',
        name: 'Carlos Mendoza',
        email: 'carlos@correo.com',
        status: 'error',
        errorMessage: 'Cuota agotada',
        sentAt: '2026-10-01T17:01:00Z',
      },
    ];

    const csv = buildDeliveryReportCsv(records);
    expect(csv).toContain('ID,Nombre,Correo,Estado,Error,Fecha y Hora');
    expect(csv).toContain('"Ana María","ana@correo.com",sent,"",2026-10-01T17:00:00Z');
    expect(csv).toContain('"Carlos Mendoza","carlos@correo.com",error,"Cuota agotada",2026-10-01T17:01:00Z');
  });

  it('should encode Uint8Array to base64 correctly', () => {
    const testBytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const b64 = uint8ArrayToBase64(testBytes);
    expect(b64).toBe(btoa('Hello'));
  });

  it('should convert plain text to elegant HTML paragraphs without requiring HTML knowledge', () => {
    const plainText = `Hola Juan,\n\nAdjuntamos tu certificado.\n\nSaludos cordiales,\nComité`;
    const html = ensureHtmlEmailBody(plainText);
    expect(html).toContain('<p style="');
    expect(html).toContain('Hola Juan,');
    expect(html).toContain('Saludos cordiales,<br/>Comité');
  });

  it('should preserve custom HTML if user provided it', () => {
    const customHtml = '<div class="banner"><h1>Bienvenido</h1><p>Texto</p></div>';
    const html = ensureHtmlEmailBody(customHtml);
    expect(html).toBe(customHtml);
  });
});
