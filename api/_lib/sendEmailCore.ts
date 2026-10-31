import nodemailer from 'nodemailer';
import { createRateLimiter, isAllowedOrigin, validateEmailRequest } from './emailGuard.js';

const DEFAULT_SENDER = 'Equipo de capacitación';
const checkRate = createRateLimiter();

export interface SendEmailInput {
  method?: string;
  origin?: string;
  host?: string;
  ip: string;
  body: unknown;
  env: { user?: string; pass?: string; allowedOrigins?: string; production: boolean };
}

export interface SendEmailOutput {
  status: number;
  headers?: Record<string, string>;
  json: Record<string, unknown>;
}

/** Lógica común de la función de Vercel y del servidor de desarrollo de Vite. */
export async function processSendEmail(input: SendEmailInput): Promise<SendEmailOutput> {
  if (input.method !== 'POST') {
    return { status: 405, headers: { Allow: 'POST' }, json: { ok: false, error: 'Método no permitido. Use POST.' } };
  }

  if (!isAllowedOrigin(input.origin, input.host, { allowed: input.env.allowedOrigins, production: input.env.production })) {
    return { status: 403, json: { ok: false, error: 'Origen no permitido.' } };
  }

  const rate = checkRate(input.ip);
  if (!rate.ok) {
    return {
      status: 429,
      headers: { 'Retry-After': String(rate.retryAfterSec) },
      json: { ok: false, error: `Demasiados envíos seguidos. Intenta de nuevo en ${rate.retryAfterSec} s.` },
    };
  }

  const { user, pass } = input.env;
  if (!user || !pass) {
    console.error('send-email: faltan GMAIL_USER o GMAIL_APP_PASSWORD');
    return { status: 503, json: { ok: false, error: 'El servicio de correo no está configurado.' } };
  }

  const parsed = validateEmailRequest(input.body, DEFAULT_SENDER);
  if (!parsed.ok) return { status: 400, json: { ok: false, error: parsed.error } };
  const { to, subject, html, senderName, attachment } = parsed.value;

  try {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    const info = await transporter.sendMail({
      from: { name: senderName, address: user },
      to,
      subject,
      html,
      attachments: attachment
        ? [{ filename: attachment.filename, content: attachment.content, contentType: 'application/pdf' }]
        : undefined,
    });
    return { status: 200, json: { ok: true, messageId: info.messageId } };
  } catch (error) {
    // El detalle queda en los logs; al navegador solo va un mensaje genérico
    console.error('send-email: error de Gmail', error);
    return { status: 502, json: { ok: false, error: 'Gmail no aceptó el correo. Intenta de nuevo en unos minutos.' } };
  }
}
