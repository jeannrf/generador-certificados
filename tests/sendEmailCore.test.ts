import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Gmail se simula: se verifica qué recibiría nodemailer sin enviar nada
const { sendMail, createTransport } = vi.hoisted(() => {
  const sendMail = vi.fn();
  return { sendMail, createTransport: vi.fn(() => ({ sendMail })) };
});
vi.mock('nodemailer', () => ({ default: { createTransport } }));

import { processSendEmail, SendEmailInput } from '../api/_lib/sendEmailCore';

const HOST = 'uniautomate.vercel.app';
const PDF_BASE64 = Buffer.from('%PDF-1.7\n%certificado').toString('base64');
const body = { to: 'ana@uni.pe', subject: 'Tu certificado', html: '<p>Hola Ana</p>', senderName: 'Equipo UNI' };

let nextIp = 0;
/** Cada petición usa una IP nueva salvo que se indique, para no compartir el límite entre pruebas. */
function request(overrides: Partial<SendEmailInput> = {}): SendEmailInput {
  return {
    method: 'POST',
    origin: `https://${HOST}`,
    host: HOST,
    ip: `10.0.0.${nextIp++}`,
    body,
    env: { user: 'app@gmail.com', pass: 'clave-de-app', production: true },
    ...overrides,
  };
}

beforeEach(() => {
  sendMail.mockReset().mockResolvedValue({ messageId: '<id-1@gmail.com>' });
  createTransport.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe('/api/send-email - flujo completo', () => {
  it('envía el correo con remitente, destinatario y PDF adjunto', async () => {
    const result = await processSendEmail(
      request({ body: { ...body, attachment: { filename: 'Ana - Certificado.pdf', base64: PDF_BASE64 } } })
    );

    expect(result).toEqual({ status: 200, json: { ok: true, messageId: '<id-1@gmail.com>' } });
    expect(createTransport).toHaveBeenCalledWith({ service: 'gmail', auth: { user: 'app@gmail.com', pass: 'clave-de-app' } });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0];
    expect(mail).toMatchObject({
      from: { name: 'Equipo UNI', address: 'app@gmail.com' },
      to: 'ana@uni.pe',
      subject: 'Tu certificado',
      html: '<p>Hola Ana</p>',
    });
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0]).toMatchObject({ filename: 'Ana - Certificado.pdf', contentType: 'application/pdf' });
    expect(mail.attachments[0].content.toString('latin1')).toBe('%PDF-1.7\n%certificado');
  });

  it('sin adjunto no manda la lista de adjuntos y usa el remitente por defecto', async () => {
    await processSendEmail(request({ body: { to: 'ana@uni.pe', subject: 'Hola', html: '<p>x</p>' } }));
    const mail = sendMail.mock.calls[0][0];
    expect(mail.attachments).toBeUndefined();
    expect(mail.from.name).toBe('Equipo de capacitación');
  });

  it('acepta el cuerpo en "htmlBody" (clientes anteriores)', async () => {
    await processSendEmail(request({ body: { to: 'ana@uni.pe', subject: 'Hola', htmlBody: '<p>viejo</p>' } }));
    expect(sendMail.mock.calls[0][0].html).toBe('<p>viejo</p>');
  });

  it('solo acepta POST', async () => {
    const result = await processSendEmail(request({ method: 'GET' }));
    expect(result.status).toBe(405);
    expect(result.headers).toEqual({ Allow: 'POST' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rechaza otros orígenes, peticiones sin Origin y localhost en producción', async () => {
    for (const origin of ['https://evil.example', undefined, 'http://localhost:5173', `https://${HOST}.evil.example`]) {
      expect((await processSendEmail(request({ origin }))).status).toBe(403);
    }
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('acepta localhost en desarrollo y los orígenes de ALLOWED_ORIGINS', async () => {
    const dev = request({ origin: 'http://localhost:5173', host: 'localhost:5173' });
    dev.env.production = false;
    expect((await processSendEmail(dev)).status).toBe(200);

    const custom = request({ origin: 'https://certificados.uni.pe' });
    custom.env.allowedOrigins = 'https://otro.pe, https://certificados.uni.pe';
    expect((await processSendEmail(custom)).status).toBe(200);
  });

  it('avisa que no está configurado si faltan las credenciales, sin decir cuáles', async () => {
    for (const env of [{ user: undefined, pass: 'x' }, { user: 'app@gmail.com', pass: '' }]) {
      const result = await processSendEmail(request({ env: { ...env, production: true } }));
      expect(result).toEqual({ status: 503, json: { ok: false, error: 'El servicio de correo no está configurado.' } });
    }
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('rechaza con 400 las peticiones inválidas antes de tocar Gmail', async () => {
    const invalid = [
      null,
      'texto',
      {},
      { ...body, to: 'a@uni.pe, b@uni.pe' },
      { ...body, subject: 'Hola\r\nBcc: otro@x.com' },
      { ...body, subject: 'x'.repeat(201) },
      { ...body, html: '   ' },
      { ...body, html: 'x'.repeat(100_001) },
      { ...body, attachment: { filename: 'virus.exe', base64: PDF_BASE64 } },
      { ...body, attachment: { filename: 'a.pdf', base64: Buffer.from('MZ no es pdf').toString('base64') } },
      { ...body, attachment: { filename: 'a.pdf', base64: 'A'.repeat(4 * 1024 * 1024 + 8) } },
      { ...body, attachment: 'no es un objeto' },
    ];
    for (const invalidBody of invalid) {
      const result = await processSendEmail(request({ body: invalidBody }));
      expect(result.status).toBe(400);
      expect(result.json.ok).toBe(false);
      expect(typeof result.json.error).toBe('string');
    }
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('acepta un adjunto en el límite de 3 MB', async () => {
    const pdf = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(3 * 1024 * 1024 - 5, 0x20)]);
    const result = await processSendEmail(
      request({ body: { ...body, attachment: { filename: 'grande.pdf', base64: pdf.toString('base64') } } })
    );
    expect(result.status).toBe(200);
    expect(sendMail.mock.calls[0][0].attachments[0].content).toHaveLength(3 * 1024 * 1024);
  });

  it('si Gmail falla responde 502 con un mensaje genérico y deja el detalle solo en los logs', async () => {
    sendMail.mockRejectedValue(new Error('535-5.7.8 Username and Password not accepted for app@gmail.com'));
    const result = await processSendEmail(request());
    expect(result.status).toBe(502);
    expect(JSON.stringify(result.json)).not.toMatch(/535|Password|app@gmail\.com/);
    expect(console.error).toHaveBeenCalled();
  });

  it('corta con 429 y Retry-After al pasar de 60 envíos por minuto desde la misma IP', async () => {
    const ip = '203.0.113.7';
    for (let i = 0; i < 60; i++) {
      expect((await processSendEmail(request({ ip }))).status).toBe(200);
    }
    const blocked = await processSendEmail(request({ ip }));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers?.['Retry-After'])).toBeGreaterThan(0);
    expect(Number(blocked.headers?.['Retry-After'])).toBeLessThanOrEqual(60);
    expect(sendMail).toHaveBeenCalledTimes(60);

    // Otra IP no se ve afectada
    expect((await processSendEmail(request())).status).toBe(200);
  });
});
