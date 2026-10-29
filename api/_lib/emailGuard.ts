/**
 * Reglas de seguridad de /api/send-email, separadas del handler para probarlas sin Gmail.
 * La carpeta empieza con "_" para que Vercel no la publique como ruta.
 */

export const LIMITS = {
  subject: 200,
  html: 100_000,
  senderName: 80,
  filename: 150,
  /** Bytes del PDF ya decodificado; el cuerpo de una función de Vercel no puede pasar de 4.5 MB */
  attachmentBytes: 3 * 1024 * 1024,
};

/** Envíos permitidos por IP. El cliente espera 1.5 s entre correos (~40 por minuto). */
export const RATE_LIMITS = [
  { windowMs: 60_000, max: 60 },
  { windowMs: 24 * 60 * 60_000, max: 600 },
];

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Solo la propia app puede pedir envíos: el Origin debe coincidir con el host que atiende la petición
 * (producción y previews), estar en ALLOWED_ORIGINS o ser localhost fuera de producción.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  host: string | undefined,
  options: { allowed?: string; production?: boolean } = {}
): boolean {
  if (!origin) return false;
  const originHost = hostOf(origin);
  if (!originHost) return false;
  if (host && originHost === host.toLowerCase()) return true;
  const allowed = (options.allowed ?? '')
    .split(',')
    .map((o) => hostOf(o.trim()))
    .filter(Boolean);
  if (allowed.includes(originHost)) return true;
  if (!options.production && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(originHost)) return true;
  return false;
}

export interface ValidEmailRequest {
  to: string;
  subject: string;
  html: string;
  senderName: string;
  attachment?: { filename: string; content: Buffer };
}

export type ValidationResult = { ok: true; value: ValidEmailRequest } | { ok: false; error: string };

export function validateEmailRequest(body: unknown, defaultSender: string): ValidationResult {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const to = typeof b.to === 'string' ? b.to.trim() : '';
  const subject = typeof b.subject === 'string' ? b.subject : '';
  const htmlRaw = typeof b.html === 'string' ? b.html : b.htmlBody;
  const html = typeof htmlRaw === 'string' ? htmlRaw : '';

  // Un solo destinatario: sin comas ni punto y coma no se puede convertir en un envío masivo
  if (!to || to.length > 254 || !EMAIL_RE.test(to)) {
    return { ok: false, error: 'El destinatario debe ser una sola dirección de correo válida.' };
  }
  if (!subject.trim() || subject.length > LIMITS.subject || /[\r\n]/.test(subject)) {
    return { ok: false, error: `El asunto es obligatorio, de una línea y hasta ${LIMITS.subject} caracteres.` };
  }
  if (!html.trim() || html.length > LIMITS.html) {
    return { ok: false, error: 'El mensaje está vacío o es demasiado largo.' };
  }

  const senderName =
    (typeof b.senderName === 'string' ? b.senderName : '')
      .replace(/[<>"'\r\n]/g, '')
      .trim()
      .slice(0, LIMITS.senderName) || defaultSender;

  let attachment: ValidEmailRequest['attachment'];
  if (b.attachment !== undefined && b.attachment !== null) {
    const a = b.attachment as Record<string, unknown>;
    const filename = typeof a.filename === 'string' ? a.filename.replace(/[\r\n/\\]/g, '').trim() : '';
    const base64 = typeof a.base64 === 'string' ? a.base64 : '';
    if (!filename || filename.length > LIMITS.filename || !/\.pdf$/i.test(filename)) {
      return { ok: false, error: 'El adjunto debe ser un archivo .pdf.' };
    }
    // Comprobar el tamaño antes de decodificar: 4 caracteres base64 son 3 bytes
    if (!base64 || (base64.length * 3) / 4 > LIMITS.attachmentBytes + 3) {
      return { ok: false, error: 'El adjunto supera los 3 MB.' };
    }
    const content = Buffer.from(base64, 'base64');
    if (content.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return { ok: false, error: 'El adjunto no es un PDF válido.' };
    }
    attachment = { filename, content };
  }

  return { ok: true, value: { to, subject, html, senderName, attachment } };
}

/**
 * Límite por IP en memoria. En Vercel cada instancia lleva su propia cuenta, así que es un freno
 * de mejor esfuerzo contra abusos, no un contador global exacto.
 */
export function createRateLimiter(limits = RATE_LIMITS) {
  const hits = new Map<string, number[]>();
  const longest = Math.max(...limits.map((l) => l.windowMs));

  return function check(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < longest);
    for (const { windowMs, max } of limits) {
      const inWindow = recent.filter((t) => now - t < windowMs);
      if (inWindow.length >= max) {
        hits.set(key, recent);
        return { ok: false, retryAfterSec: Math.ceil((inWindow[0] + windowMs - now) / 1000) };
      }
    }
    recent.push(now);
    hits.set(key, recent);
    // Evitar que el mapa crezca sin límite con IPs que ya no envían
    if (hits.size > 5000) {
      for (const [k, times] of hits) {
        if (!times.some((t) => now - t < longest)) hits.delete(k);
      }
    }
    return { ok: true };
  };
}

export function clientIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  const realIp = headers['x-real-ip'];
  return first || (Array.isArray(realIp) ? realIp[0] : realIp) || 'unknown';
}
