import { describe, it, expect, afterEach, vi } from 'vitest';
import { sendEmail, uint8ArrayToBase64 } from '../src/infra/email/emailClient';

const params = { to: '  ana@uni.pe ', subject: 'Tu certificado', htmlBody: '<p>Hola</p>', senderName: 'Equipo UNI' };

function mockFetch(response: { status?: number; body?: unknown; text?: string } | Error) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => {
    if (response instanceof Error) throw response;
    const text = response.text ?? JSON.stringify(response.body);
    return new Response(text, { status: response.status ?? 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('sendEmail (navegador → /api/send-email)', () => {
  it('manda un POST JSON con el destinatario sin espacios y el adjunto', async () => {
    const fetchMock = mockFetch({ body: { ok: true } });
    const attachment = { filename: 'Ana.pdf', base64: 'JVBERi0=' };

    expect(await sendEmail({ ...params, attachment })).toEqual({ ok: true, remainingQuota: undefined });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/send-email');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toMatchObject({
      to: 'ana@uni.pe',
      subject: 'Tu certificado',
      html: '<p>Hola</p>',
      senderName: 'Equipo UNI',
      attachment,
    });
  });

  it('usa el remitente por defecto si no se indica', async () => {
    const fetchMock = mockFetch({ body: { ok: true } });
    await sendEmail({ to: 'a@uni.pe', subject: 'S', htmlBody: 'x' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).senderName).toBe('Equipo de capacitación');
  });

  it('devuelve el mensaje de error del servidor (límite, validación, Gmail)', async () => {
    mockFetch({ status: 429, body: { ok: false, error: 'Demasiados envíos seguidos. Intenta de nuevo en 30 s.' } });
    expect(await sendEmail(params)).toEqual({ ok: false, error: 'Demasiados envíos seguidos. Intenta de nuevo en 30 s.' });
  });

  it('si el error no trae JSON (p. ej. un 500 de la plataforma) informa el código HTTP', async () => {
    mockFetch({ status: 500, text: '<html>Internal Server Error</html>' });
    const result = await sendEmail(params);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Error HTTP 500');
  });

  it('un 200 con ok:false cuenta como fallo', async () => {
    mockFetch({ body: { ok: false, message: 'Rechazado' } });
    expect(await sendEmail(params)).toMatchObject({ ok: false, error: 'Rechazado' });
  });

  it('un 200 que no es JSON cuenta como fallo y no como enviado', async () => {
    mockFetch({ text: '<html>página de mantenimiento</html>' });
    expect((await sendEmail(params)).ok).toBe(false);
  });

  it('sin conexión devuelve el fallo en vez de lanzar', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    expect(await sendEmail(params)).toEqual({ ok: false, error: 'Failed to fetch' });
  });
});

describe('uint8ArrayToBase64', () => {
  it('codifica igual que Buffer en archivos más grandes que un bloque (32 KB)', () => {
    const bytes = new Uint8Array(100_003).map((_, i) => (i * 31) % 256);
    expect(uint8ArrayToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });

  it('un arreglo vacío da una cadena vacía', () => {
    expect(uint8ArrayToBase64(new Uint8Array())).toBe('');
  });
});
