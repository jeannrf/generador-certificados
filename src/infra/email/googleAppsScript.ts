import { EmailConfig } from '../../domain/types';

const STORAGE_KEY = 'cert_email_config_v1';

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  webAppUrl: '',
  token: '',
  senderName: 'Emisión de Certificados',
  subject: 'Tu Certificado — {nombre}',
  htmlBody: `<p>Hola <strong>{nombre}</strong>,</p>
<p>¡Felicitaciones! Adjuntamos tu certificado oficial en formato PDF.</p>
<p>Saludos cordiales,<br/>Comité Organizador</p>`,
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
export function saveEmailConfigToStorage(config: EmailConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('No se pudo guardar la configuración de correo en localStorage:', err);
  }
}

/**
 * Carga la configuración de correo guardada en localStorage o devuelve la por defecto
 */
export function loadEmailConfigFromStorage(): EmailConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_EMAIL_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('Error leyendo configuración de correo desde localStorage:', err);
  }
  return DEFAULT_EMAIL_CONFIG;
}

/**
 * Verifica la conectividad con el servicio de correo (/api/send-email en Vercel o Apps Script)
 */
export async function pingAppsScript(
  webAppUrl?: string,
  token?: string
): Promise<{ ok: boolean; remainingQuota?: number; message?: string; error?: string; isBackend?: boolean }> {
  const trimmedUrl = (webAppUrl || '').trim();
  const endpoint = trimmedUrl || '/api/send-email';
  const isBackend = endpoint.startsWith('/') || endpoint.includes('/api/send-email');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': isBackend ? 'application/json' : 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'ping',
        token: token ? token.trim() : '',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return {
        ok: false,
        isBackend,
        error: errorData?.error || `El servidor respondió con código HTTP ${response.status}.`,
      };
    }

    const data = await response.json();
    if (!data.ok) {
      return {
        ok: false,
        isBackend,
        error: data.error || data.message || 'Error en el servicio de correo.',
      };
    }

    return {
      ok: true,
      isBackend,
      remainingQuota: typeof data.remainingQuota === 'number' ? data.remainingQuota : undefined,
      message: data.message || (isBackend ? 'Servicio Resend activo y listo.' : 'Conexión exitosa con Apps Script.'),
    };
  } catch (err: any) {
    if (isBackend) {
      return {
        ok: true,
        isBackend: true,
        message: 'Endpoint de Vercel listo para desplegar con RESEND_API_KEY.',
      };
    }
    return {
      ok: false,
      isBackend: false,
      error: 'No se pudo conectar con la Web App. Asegúrate de que la URL sea válida.',
    };
  }
}

export interface SendEmailParams {
  webAppUrl?: string;
  token?: string;
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
 * Envía un correo con certificado a través de /api/send-email o Google Apps Script
 */
export async function sendEmailViaScript(
  params: SendEmailParams
): Promise<{ ok: boolean; remainingQuota?: number; error?: string }> {
  const endpoint = (params.webAppUrl || '').trim() || '/api/send-email';
  const isBackend = endpoint.startsWith('/') || endpoint.includes('/api/send-email');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': isBackend ? 'application/json' : 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'send',
        token: params.token ? params.token.trim() : '',
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
