import { Recipient, Issue, FieldBox } from './types';
import { cleanString, transformTextCase } from './normalization';
import { measureBrowserTextWidth, calculateOptimalFontSize } from './layout';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationOptions {
  field?: FieldBox;
  templateWidthPt?: number;
}

/**
 * Valida y genera los issues correspondientes para una lista de filas de destinatarios.
 */
export function validateRecipients(
  rawRows: Array<{
    id?: string;
    name: string;
    email?: string;
    extra?: Record<string, string>;
    customField?: Partial<FieldBox>;
  }>,
  options?: ValidationOptions
): Recipient[] {
  const seenNames = new Set<string>();
  const seenEmails = new Set<string>();

  const baseField = options?.field;
  const templateWidthPt = options?.templateWidthPt || 841.89;

  return rawRows.map((row, index) => {
    const rowNumber = index + 1;
    const issues: Issue[] = [];
    const cleanedName = cleanString(row.name || '');
    const cleanedEmail = row.email ? cleanString(row.email) : undefined;
    const field = baseField
      ? (row.customField ? { ...baseField, ...row.customField } : baseField)
      : undefined;

    // 1. Validación de nombre
    if (!cleanedName) {
      issues.push({
        severity: 'error',
        code: 'EMPTY_NAME',
        message: 'El nombre está vacío',
      });
    } else {
      // Advertencia si el nombre no cabe en el recuadro delimitado
      if (field) {
        const transformedText = transformTextCase(cleanedName, field.textCase);
        const boxWidthPt = field.width * templateWidthPt;
        const targetWidthPt = Math.max(10, boxWidthPt - 8);

        const fontWeight = field.isBold ? 700 : 400;
        const fontStyle = field.isItalic ? 'italic' : 'normal';
        const textWidthAtSize = measureBrowserTextWidth(
          transformedText,
          field.maxFontSize,
          field.fontFamily,
          fontWeight,
          fontStyle
        );

        if (textWidthAtSize > targetWidthPt) {
          const optimal = calculateOptimalFontSize(
            transformedText,
            field.maxFontSize,
            field.minFontSize || 14,
            targetWidthPt,
            (t, sz) => measureBrowserTextWidth(t, sz, field.fontFamily, fontWeight, fontStyle)
          );

          if (!optimal.fits) {
            issues.push({
              severity: 'warning',
              code: 'TEXT_OVERFLOW',
              message: `El nombre es muy largo y desborda el marco delimitado (incluso al tamaño mínimo de ${field.minFontSize || 14} pt)`,
            });
          } else {
            issues.push({
              severity: 'warning',
              code: 'TEXT_OVERFLOW',
              message: `Nombre largo: desborda ${field.maxFontSize} pt (se ajusta automáticamente a ${optimal.fontSize} pt)`,
            });
          }
        }
      }

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
      id: row.id || `rec_${rowNumber}_${index}`,
      rowNumber,
      name: row.name !== undefined ? row.name : cleanedName,
      email: row.email !== undefined ? row.email : cleanedEmail,
      extra: row.extra || {},
      issues,
      customField: row.customField,
    };
  });
}

/**
 * Genera un nombre de archivo seguro para el certificado PDF según un patrón personalizable.
 * Ejemplo: "{nombre} - Certificado UNI.pdf" o "[nombre] - Certificado 2026.pdf"
 */
export function formatCertificateFileName(
  pattern: string,
  name: string,
  extra?: Record<string, string>
): string {
  let formatted = pattern?.trim() || '{nombre} - Certificado';
  const safeName = cleanString(name) || 'Sin Nombre';

  // Reemplazar tokens {nombre}, [nombre], {name}, [name]
  formatted = formatted.replace(/\{nombre\}|\{name\}|\[nombre\]|\[name\]/gi, safeName);

  // Reemplazar variables adicionales del archivo si existen
  if (extra) {
    for (const [key, val] of Object.entries(extra)) {
      if (val) {
        const regex = new RegExp(`\\{${key}\\}|\\[${key}\\]`, 'gi');
        formatted = formatted.replace(regex, cleanString(val));
      }
    }
  }

  const sanitized = formatted
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\.pdf$/i, '')
    .trim()
    .slice(0, 100);

  return `${sanitized || safeName}.pdf`;
}

/**
 * Genera un nombre de archivo seguro para el certificado PDF.
 * Ejemplo: "Certificado - Juan Perez.pdf"
 */
export function generateSafeFileName(name: string, prefix = 'Certificado - '): string {
  return formatCertificateFileName(`${prefix}{nombre}`, name);
}
