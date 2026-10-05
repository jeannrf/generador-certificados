import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedTableData {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parsea un archivo Excel (.xlsx, .xls) desde un Blob/File
 */
export async function parseExcel(file: File): Promise<ParsedTableData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 });

  if (!jsonData || jsonData.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawHeaders = (jsonData[0] as unknown[]) || [];
  const headers = rawHeaders.map((h, i) => (h ? String(h).trim() : `Columna ${i + 1}`));

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < jsonData.length; i++) {
    const row = (jsonData[i] as unknown[]) || [];
    if (!row || row.length === 0) continue;
    const rowObj: Record<string, string> = {};
    let hasVal = false;
    headers.forEach((header, colIdx) => {
      const val = row[colIdx];
      const strVal = val !== null && val !== undefined ? String(val).trim() : '';
      if (strVal) hasVal = true;
      rowObj[header] = strVal;
    });
    if (hasVal) {
      rows.push(rowObj);
    }
  }

  return { headers, rows };
}

/**
 * Parsea contenido CSV autodetectando delimitadores (coma, punto y coma, tabulador)
 */
export function parseCSV(fileContent: string): ParsedTableData {
  const result = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
  });

  const headers = result.meta.fields || [];
  const rows = result.data.filter((row) =>
    Object.values(row).some((val) => val && val.toString().trim().length > 0)
  );

  return { headers, rows };
}

/**
 * Parsea un archivo TXT simple (un nombre por línea o nombre,correo)
 */
export function parseTXT(fileContent: string): ParsedTableData {
  const lines = fileContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { headers: ['Nombre'], rows: [] };
  }

  // Detectar si alguna línea contiene comas o punto y coma
  const hasDelimiter = lines.some((l) => l.includes(',') || l.includes(';'));

  if (hasDelimiter) {
    const headers = ['Nombre', 'Correo'];
    const rows = lines.map((line) => {
      const parts = line.split(/[,;]/).map((p) => p.trim());
      return {
        Nombre: parts[0] || '',
        Correo: parts[1] || '',
      };
    });
    return { headers, rows };
  }

  const headers = ['Nombre'];
  const rows = lines.map((line) => ({ Nombre: line }));
  return { headers, rows };
}

/**
 * Sugiere automáticamente qué columnas corresponden al nombre y al correo.
 */
export function detectColumns(
  headers: string[],
  rows?: Record<string, string>[]
): { nameCol?: string; emailCol?: string } {
  const nameKeywords = ['nombre', 'name', 'participante', 'destinatario', 'alumno', 'asistente', 'estudiante', 'full name', 'persona'];
  const emailKeywords = ['correo', 'email', 'e-mail', 'mail', 'correo electronico', 'dirección de correo'];

  let nameCol: string | undefined;
  let emailCol: string | undefined;

  for (const h of headers) {
    const lower = h.toLowerCase().trim();
    if (!nameCol && nameKeywords.some((kw) => lower.includes(kw))) {
      nameCol = h;
    }
    if (!emailCol && emailKeywords.some((kw) => lower.includes(kw))) {
      emailCol = h;
    }
  }

  // Si no se encontró columna de correo por palabra clave en cabeceras, inspeccionar contenido de filas
  if (!emailCol && rows && rows.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const h of headers) {
      if (h === nameCol) continue;
      const values = rows.map((r) => r[h]?.trim()).filter((v): v is string => Boolean(v));
      if (values.length > 0) {
        const matches = values.filter((v) => emailRegex.test(v)).length;
        if (matches / values.length >= 0.4) {
          emailCol = h;
          break;
        }
      }
    }
  }

  // Si no se encontró por palabra clave, usar la primera columna como nombre
  if (!nameCol && headers.length > 0) {
    nameCol = headers[0];
  }

  return { nameCol, emailCol };
}
