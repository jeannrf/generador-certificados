import { Recipient, Issue } from './types';
import { cleanString } from './normalization';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida y genera los issues correspondientes para una lista de filas de destinatarios.
 */
export function validateRecipients(
  rawRows: Array<{ name: string; email?: string; extra?: Record<string, string> }>
): Recipient[] {
  const seenNames = new Set<string>();
  const seenEmails = new Set<string>();

  return rawRows.map((row, index) => {
    const rowNumber = index + 1;
    const issues: Issue[] = [];
    const cleanedName = cleanString(row.name || '');
    const cleanedEmail = row.email ? cleanString(row.email) : undefined;

    // 1. Validación de nombre
    if (!cleanedName) {
      issues.push({
        severity: 'error',
        code: 'EMPTY_NAME',
        message: 'El nombre está vacío',
      });
    } else {
      const lowerName = cleanedName.toLocaleLowerCase('es');
      if (seenNames.has(lowerName)) {
        issues.push({
          severity: 'warning',
          code: 'DUPLICATE',
          message: 'Nombre duplicado en la lista',
        });
      } else {
        seenNames.add(lowerName);
      }
    }

    // 2. Validación de correo (si está presente)
    if (cleanedEmail) {
      if (!EMAIL_REGEX.test(cleanedEmail)) {
        issues.push({
          severity: 'error',
          code: 'INVALID_EMAIL',
          message: 'Formato de correo electrónico inválido',
        });
      } else {
        const lowerEmail = cleanedEmail.toLowerCase();
        if (seenEmails.has(lowerEmail)) {
          issues.push({
            severity: 'warning',
            code: 'DUPLICATE',
            message: 'Correo duplicado en la lista',
          });
        } else {
          seenEmails.add(lowerEmail);
        }
      }
    }

    return {
      id: `rec_${rowNumber}_${Math.random().toString(36).substring(2, 7)}`,
      rowNumber,
      name: cleanedName,
      email: cleanedEmail,
      extra: row.extra || {},
      issues,
    };
  });
}

/**
 * Genera un nombre de archivo seguro para el certificado PDF.
 * Ejemplo: "Certificado - Juan Perez.pdf"
 */
export function generateSafeFileName(name: string, prefix = 'Certificado - '): string {
  const safeName = cleanString(name)
    // Reemplazar caracteres no permitidos en nombres de archivo (/ \ : * ? " < > |)
    .replace(/[/\\:*?"<>|]/g, '')
    // Recortar a máx 80 caracteres
    .slice(0, 80);

  return `${prefix}${safeName || 'Sin Nombre'}.pdf`;
}
