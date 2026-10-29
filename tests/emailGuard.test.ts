import { describe, it, expect } from 'vitest';
import { clientIp, createRateLimiter, isAllowedOrigin, validateEmailRequest } from '../api/_lib/emailGuard';

const PDF_BASE64 = Buffer.from('%PDF-1.7\n%fake').toString('base64');
const valid = { to: 'ana@example.com', subject: 'Tu certificado', html: '<p>Hola</p>', senderName: 'Equipo' };

describe('isAllowedOrigin', () => {
  it('acepta el mismo host (producción y previews)', () => {
    expect(isAllowedOrigin('https://uniautomate.vercel.app', 'uniautomate.vercel.app', { production: true })).toBe(true);
  });
  it('rechaza otros sitios y peticiones sin Origin', () => {
    expect(isAllowedOrigin('https://evil.example', 'uniautomate.vercel.app', { production: true })).toBe(false);
    expect(isAllowedOrigin(undefined, 'uniautomate.vercel.app', { production: true })).toBe(false);
  });
  it('localhost solo fuera de producción', () => {
    expect(isAllowedOrigin('http://localhost:5173', 'x.vercel.app', { production: false })).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173', 'x.vercel.app', { production: true })).toBe(false);
  });
  it('acepta los orígenes de ALLOWED_ORIGINS', () => {
    expect(isAllowedOrigin('https://certificados.uni.pe', 'x.vercel.app', { allowed: 'https://certificados.uni.pe', production: true })).toBe(true);
  });
});

describe('validateEmailRequest', () => {
  it('acepta un correo válido con PDF adjunto', () => {
    const r = validateEmailRequest({ ...valid, attachment: { filename: 'Ana.pdf', base64: PDF_BASE64 } }, 'Def');
    expect(r.ok).toBe(true);
  });
  it('rechaza varios destinatarios', () => {
    expect(validateEmailRequest({ ...valid, to: 'a@x.com, b@x.com' }, 'Def').ok).toBe(false);
    expect(validateEmailRequest({ ...valid, to: 'a@x.com;b@x.com' }, 'Def').ok).toBe(false);
  });
  it('rechaza saltos de línea en el asunto', () => {
    expect(validateEmailRequest({ ...valid, subject: 'Hola\r\nBcc: otro@x.com' }, 'Def').ok).toBe(false);
  });
  it('rechaza adjuntos que no son PDF', () => {
    const notPdf = Buffer.from('MZ ejecutable').toString('base64');
    expect(validateEmailRequest({ ...valid, attachment: { filename: 'a.pdf', base64: notPdf } }, 'Def').ok).toBe(false);
    expect(validateEmailRequest({ ...valid, attachment: { filename: 'a.exe', base64: PDF_BASE64 } }, 'Def').ok).toBe(false);
  });
  it('limpia el remitente y usa el de respaldo si queda vacío', () => {
    const r = validateEmailRequest({ ...valid, senderName: '"<>' }, 'Def');
    expect(r.ok && r.value.senderName).toBe('Def');
  });
});

describe('createRateLimiter', () => {
  it('bloquea al pasar el máximo de la ventana y libera después', () => {
    const check = createRateLimiter([{ windowMs: 1000, max: 2 }]);
    expect(check('ip', 0).ok).toBe(true);
    expect(check('ip', 10).ok).toBe(true);
    const blocked = check('ip', 20);
    expect(blocked.ok).toBe(false);
    expect(check('otra-ip', 20).ok).toBe(true);
    expect(check('ip', 1001).ok).toBe(true);
  });
});

describe('clientIp', () => {
  it('usa la primera IP de x-forwarded-for', () => {
    expect(clientIp({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' })).toBe('1.2.3.4');
  });
});
