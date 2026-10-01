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
 * Verifica la conectividad con la Web App de Google Apps Script y consulta la cuota restante
 */
export async function pingAppsScript(
  webAppUrl: string,
  token?: string
): Promise<{ ok: boolean; remainingQuota?: number; message?: string; error?: string }> {
  const trimmedUrl = webAppUrl.trim();
  if (!trimmedUrl) {
    return { ok: false, error: 'Por favor ingresa la URL de la Web App.' };
  }

  try {
    // Usamos text/plain;charset=utf-8 para evitar preflight CORS (OPTIONS)
    const response = await fetch(trimmedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'ping',
        token: token ? token.trim() : '',
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `El servidor respondió con código HTTP ${response.status} (${response.statusText}).`,
      };
    }

    const data = await response.json();
    if (!data.ok) {
      return {
        ok: false,
        error: data.message || 'Error de autenticación o en la ejecución del script.',
      };
    }

    return {
      ok: true,
      remainingQuota: typeof data.remainingQuota === 'number' ? data.remainingQuota : undefined,
      message: data.message || 'Conexión exitosa',
    };
  } catch (err: any) {
    console.error('Error conectando con Google Apps Script:', err);
    return {
      ok: false,
      error:
        'No se pudo conectar con la Web App. Asegúrate de que la implementación tenga acceso "Cualquier persona" (Anyone) y la URL sea la versión /exec.',
    };
  }
}

export interface SendEmailParams {
  webAppUrl: string;
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
 * Envía un correo con certificado a través de Google Apps Script
 */
export async function sendEmailViaScript(
  params: SendEmailParams
): Promise<{ ok: boolean; remainingQuota?: number; error?: string }> {
  try {
    const response = await fetch(params.webAppUrl.trim(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'send',
        token: params.token ? params.token.trim() : '',
        to: params.to.trim(),
        subject: params.subject,
        htmlBody: params.htmlBody,
        senderName: params.senderName || 'Emisión de Certificados',
        attachment: params.attachment,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Error HTTP ${response.status} al enviar correo a ${params.to}.`,
      };
    }

    const data = await response.json();
    if (!data.ok) {
      return {
        ok: false,
        remainingQuota: data.remainingQuota,
        error: data.message || 'Error devuelto por Google Apps Script.',
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
