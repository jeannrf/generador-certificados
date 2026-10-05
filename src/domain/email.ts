import { EmailConfig, EmailDeliveryRecord, Recipient } from './types';

/**
 * Escapa caracteres HTML para evitar inyecciones al interpolar variables en el correo
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Interpola variables como {nombre}, {correo} o cualquier columna de extra {curso}
 * en el texto de asunto o cuerpo de correo.
 */
export function interpolateEmailVariables(
  templateText: string,
  recipient: Recipient,
  options: { escapeForHtml?: boolean } = {}
): string {
  let result = templateText;

  const replaceVar = (key: string, val: string) => {
    const finalVal = options.escapeForHtml ? escapeHtml(val) : val;
    const regexCurly = new RegExp(`\\{${key}\\}`, 'gi');
    const regexSquare = new RegExp(`\\[${key}\\]`, 'gi');
    result = result.replace(regexCurly, finalVal).replace(regexSquare, finalVal);
  };

  replaceVar('nombre', recipient.name || '');
  replaceVar('correo', recipient.email || '');

  if (recipient.extra) {
    for (const [key, value] of Object.entries(recipient.extra)) {
      replaceVar(key, String(value ?? ''));
    }
  }

  return result;
}

/**
 * Convierte texto normal a HTML de correo electrónico automáticamente.
 * Si el usuario ya usó etiquetas HTML (como <p>, <br>, <strong>), las respeta intactas.
 * Si escribió texto plano con saltos de línea, los transforma en párrafos y espaciados limpios.
 */
export function ensureHtmlEmailBody(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '<p></p>';

  // Si contiene etiquetas HTML conocidas, se respeta tal cual
  const hasHtml = /<\/?(p|div|br|strong|b|em|i|ul|ol|li|span|h[1-6]|table|a)\b/i.test(trimmed);
  if (hasHtml) {
    return trimmed;
  }

  // Convertir saltos dobles en párrafos y saltos simples en <br/>
  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p style="margin: 0 0 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${p.replace(/\n/g, '<br/>')}</p>`
    )
    .join('');

  return paragraphs;
}

/**
 * Valida la configuración de la conexión antes de enviar correos
 */
export function validateEmailConfig(config: Partial<EmailConfig>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (config.webAppUrl && config.webAppUrl.trim()) {
    const url = config.webAppUrl.trim();
    if (!url.startsWith('https://script.google.com/macros/s/') && !url.startsWith('/api/')) {
      errors.push('La URL debe ser de Google Apps Script (https://script.google.com/macros/s/...) o una ruta de API local.');
    }
  }

  if (!config.subject || !config.subject.trim()) {
    errors.push('El asunto del correo no puede estar vacío.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Genera el contenido CSV del reporte de entregas para auditoría
 */
export function buildDeliveryReportCsv(records: EmailDeliveryRecord[]): string {
  const headers = ['ID', 'Nombre', 'Correo', 'Estado', 'Error', 'Fecha y Hora'];
  const rows = records.map((rec) => [
    rec.recipientId,
    `"${rec.name.replace(/"/g, '""')}"`,
    `"${rec.email.replace(/"/g, '""')}"`,
    rec.status,
    `"${(rec.errorMessage || '').replace(/"/g, '""')}"`,
    rec.sentAt || '',
  ]);

  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
