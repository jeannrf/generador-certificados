import { describe, it, expect } from 'vitest';
import {
  interpolateEmailVariables,
  validateEmailConfig,
  buildDeliveryReportCsv,
  ensureHtmlEmailBody,
  summarizeCampaign,
  getUnsentRecipients,
  getCampaignRecords,
  summarizeDailyQuota,
  DAILY_WINDOW_MS,
} from '../src/domain/email';
import { uint8ArrayToBase64 } from '../src/infra/email/googleAppsScript';
import { Recipient, EmailDeliveryRecord, EmailCampaign } from '../src/domain/types';

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

describe('Domain - Email Campaign recovery', () => {
  const makeRecipient = (id: string, email: string): Recipient => ({
    id,
    rowNumber: 1,
    name: '',
    email,
    extra: {},
    issues: [],
  });

  const campaign: EmailCampaign = {
    id: 'camp_1',
    startedAt: '2026-10-19T10:00:00.000Z',
    updatedAt: '2026-10-19T10:05:00.000Z',
    subject: 'Hola',
    recipients: [
      makeRecipient('a', 'a@correo.com'),
      makeRecipient('b', 'b@correo.com'),
      makeRecipient('c', 'c@correo.com'),
      makeRecipient('d', 'd@correo.com'),
    ],
    records: {
      a: { recipientId: 'a', name: 'a@correo.com', email: 'a@correo.com', status: 'sent' },
      b: { recipientId: 'b', name: 'b@correo.com', email: 'b@correo.com', status: 'error', errorMessage: 'Timeout' },
      c: { recipientId: 'c', name: 'c@correo.com', email: 'c@correo.com', status: 'sending' },
    },
  };

  it('should count sent, failed, unconfirmed and pending recipients', () => {
    expect(summarizeCampaign(campaign)).toEqual({ total: 4, sent: 1, failed: 1, unconfirmed: 1, pending: 1 });
  });

  it('should return everyone not confirmed as sent for retry', () => {
    expect(getUnsentRecipients(campaign).map((r) => r.id)).toEqual(['b', 'c', 'd']);
  });

  it('should list recipients without a record as pending', () => {
    const records = getCampaignRecords(campaign);
    expect(records).toHaveLength(4);
    expect(records[3]).toMatchObject({ recipientId: 'd', email: 'd@correo.com', status: 'pending' });
  });
});

describe('Domain - Daily send quota', () => {
  const now = Date.UTC(2026, 9, 19, 15, 0, 0);
  const hoursAgo = (h: number) => now - h * 60 * 60 * 1000;

  it('should only count sends from the last 24 hours (rolling window)', () => {
    const quota = summarizeDailyQuota([hoursAgo(25), hoursAgo(23), hoursAgo(1)], now, 2000);
    expect(quota.sent).toBe(2);
    expect(quota.remaining).toBe(1998);
    expect(quota.nextReleaseAt).toBe(hoursAgo(23) + DAILY_WINDOW_MS);
  });

  it('should never report negative remaining quota', () => {
    const quota = summarizeDailyQuota([hoursAgo(1), hoursAgo(2), hoursAgo(3)], now, 2);
    expect(quota.remaining).toBe(0);
  });

  it('should have full quota and no release time when nothing was sent', () => {
    expect(summarizeDailyQuota([], now, 2000)).toEqual({ limit: 2000, sent: 0, remaining: 2000, nextReleaseAt: undefined });
  });
});
