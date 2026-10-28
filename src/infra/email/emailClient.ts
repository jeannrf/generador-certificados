import { EmailConfig } from '../../domain/types';

const SEND_EMAIL_ENDPOINT = '/api/send-email';
const STORAGE_KEY = 'cert_email_config_v2';
const OLD_STORAGE_KEY = 'cert_email_config_v1';
const MAIL_STORAGE_KEY = 'mail_email_config_v1';

/** Servicio que usa la configuración: correos con certificado adjunto o correos simples */
export type EmailConfigVariant = 'certificates' | 'mail';

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  senderName: 'Emisión de Certificados',
  subject: 'Tu Certificado — {nombre}',
  htmlBody: `Hola {nombre},

¡Felicitaciones! Adjuntamos tu certificado oficial en formato PDF.

Saludos cordiales,
Comité Organizador`,
};

export const DEFAULT_MAIL_CONFIG: EmailConfig = {
  senderName: 'Uniautomate',
  subject: 'Hola {nombre}, tenemos novedades para ti',
  htmlBody: `Hola {nombre},

Te escribimos para compartirte información importante.

Saludos cordiales,
El equipo`,
};

/**
 * Convierte un Uint8Array (bytes del PDF) a base64 de manera segura y eficiente
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32768
  let index = 0;
  const length = bytes.length;
  let result = '';
  while (index < length) {
    const slice = bytes.subarray(index, Math.min(index + CHUNK_SIZE, length));
    result += String.fromCharCode.apply(null, slice as unknown as number[]);
    index += CHUNK_SIZE;
  }
  return btoa(result);
}

/**
 * Guarda la configuración de correo en localStorage para no perderla
 */
export function saveEmailConfigToStorage(
  config: EmailConfig,
  variant: EmailConfigVariant = 'certificates'
): void {
  try {
    localStorage.setItem(variant === 'mail' ? MAIL_STORAGE_KEY : STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('No se pudo guardar la configuración de correo en localStorage:', err);
  }
}

/**
 * Carga la configuración de correo guardada en localStorage o devuelve la por defecto
 */
export function loadEmailConfigFromStorage(variant: EmailConfigVariant = 'certificates'): EmailConfig {
  if (variant === 'mail') {
    try {
      const raw = localStorage.getItem(MAIL_STORAGE_KEY);
      if (raw) return { ...DEFAULT_MAIL_CONFIG, ...JSON.parse(raw) };
    } catch (err) {
      console.warn('Error leyendo configuración de correo desde localStorage:', err);
    }
    return DEFAULT_MAIL_CONFIG;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_EMAIL_CONFIG, ...parsed };
    }

    // Migración desde v1 si existía:
    const oldRaw = localStorage.getItem(OLD_STORAGE_KEY);
    if (oldRaw) {
      const oldParsed = JSON.parse(oldRaw);
      // Si el htmlBody anterior contenía el viejo default HTML rígido, reemplazarlo por el texto limpio
      const isOldDefaultHtml =
        oldParsed.htmlBody &&
        oldParsed.htmlBody.includes('<p>Hola <strong>{nombre}</strong>,</p>') &&
        oldParsed.htmlBody.includes('Comité Organizador</p>');

      const migrated = {
        ...DEFAULT_EMAIL_CONFIG,
        ...oldParsed,
        htmlBody: isOldDefaultHtml ? DEFAULT_EMAIL_CONFIG.htmlBody : oldParsed.htmlBody,
      };
      saveEmailConfigToStorage(migrated);
      return migrated;
    }
  } catch (err) {
    console.warn('Error leyendo configuración de correo desde localStorage:', err);
  }
  return DEFAULT_EMAIL_CONFIG;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  senderName?: string;
  attachment?: {
    filename: string;
    base64: string;
  };
}

/**
 * Envía un correo (con el certificado adjunto si lo hay) a través de la función /api/send-email de Vercel
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<{ ok: boolean; remainingQuota?: number; error?: string }> {
  try {
    const response = await fetch(SEND_EMAIL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send',
        to: params.to.trim(),
        subject: params.subject,
        html: params.htmlBody,
        htmlBody: params.htmlBody,
        senderName: params.senderName || 'Emisión de Certificados',
        attachment: params.attachment,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return {
        ok: false,
        error: errorData?.error || `Error HTTP ${response.status} al enviar correo a ${params.to}.`,
      };
    }

    const data = await response.json();
    if (!data.ok) {
      return {
        ok: false,
        remainingQuota: data.remainingQuota,
        error: data.error || data.message || 'Error al enviar correo.',
      };
    }

    return {
      ok: true,
      remainingQuota: data.remainingQuota,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || `Fallo de red al enviar correo a ${params.to}.`,
    };
  }
}
