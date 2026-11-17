import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { detectColumns, parseCSV } from '../src/infra/parsers';
import { validateRecipients } from '../src/domain/validation';
import { buildValidationOptions, createNameField, createTextField } from '../src/domain/fields';
import { imagePageSizePt, readImageInfo } from '../src/domain/templatePages';
import { composeCertificatePdf, setFontBytesLoader } from '../src/infra/pdfComposer';
import { createZipArchive, FileToZip } from '../src/infra/zipExporter';
import { interpolateEmailVariables } from '../src/domain/email';
import type { FontBytesLoader } from '../src/infra/fontLoader';
import { FieldBox, Recipient, TemplateData } from '../src/domain/types';

/**
 * Integración de los módulos que recorre una generación real, sin interfaz:
 * lista (CSV) → columnas → validación → PDF por persona → ZIP.
 */

const fixturePath = (name: string) => resolve(__dirname, 'fixtures', name);

const fixtureFontLoader: FontBytesLoader = async (font, variant) => {
  const file = fixturePath(`fonts/${font.id}-${variant.weight}-${variant.italic ? 'italic' : 'normal'}.ttf`);
  if (!existsSync(file)) throw new Error(`Fuente de prueba no disponible: ${file}`);
  return new Uint8Array(readFileSync(file));
};

beforeAll(() => setFontBytesLoader(fixtureFontLoader));
afterAll(() => setFontBytesLoader(null));

function template(): TemplateData {
  const bytes = new Uint8Array(readFileSync(fixturePath('page1.jpg')));
  return {
    id: 'tpl_1',
    name: 'page1.jpg',
    pages: [
      {
        id: 'p1',
        sourceName: 'page1.jpg',
        kind: 'image',
        bytes,
        mimeType: 'image/jpeg',
        ...imagePageSizePt(readImageInfo(bytes, 'jpeg', 'page1.jpg')),
        previewUrl: '',
      },
    ],
  };
}

function fieldsFor(tpl: TemplateData, column: string): FieldBox[] {
  const name = createNameField('p1', tpl.pages[0]);
  const extra: FieldBox = { ...createTextField('p1', [name]), name: column, source: { type: 'column', column } };
  return [name, extra];
}

/** Lista → personas validadas, como hace el asistente al cargar un archivo. */
function loadRecipients(csv: string, tpl: TemplateData, fields: FieldBox[]): Recipient[] {
  const { headers, rows } = parseCSV(csv);
  const { nameCol, emailCol } = detectColumns(headers, rows);
  const raw = rows.map((row) => ({
    name: row[nameCol!] ?? '',
    email: emailCol ? row[emailCol] : undefined,
    extra: Object.fromEntries(Object.entries(row).filter(([key]) => key !== nameCol && key !== emailCol)),
  }));
  return validateRecipients(raw, buildValidationOptions(tpl, fields));
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const doc = await getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
}

async function generate(tpl: TemplateData, fields: FieldBox[], recipients: Recipient[], pattern?: string) {
  const files: FileToZip[] = [];
  for (const rec of recipients.filter((r) => !r.issues.some((i) => i.severity === 'error'))) {
    const { fileName, pdfBytes } = await composeCertificatePdf(tpl, fields, rec, pattern);
    files.push({ fileName, data: pdfBytes });
  }
  const zip = createZipArchive(files);
  return unzipSync(new Uint8Array(await zip.arrayBuffer()));
}

describe('Generación de punta a punta (lista → PDF → ZIP)', () => {
  it('la lista de ejemplo da un PDF por persona con su nombre y su curso', async () => {
    const tpl = template();
    const fields = fieldsFor(tpl, 'Curso');
    const recipients = loadRecipients(readFileSync(fixturePath('destinatarios.csv'), 'utf8'), tpl, fields);

    expect(recipients).toHaveLength(10);
    expect(recipients.flatMap((r) => r.issues.filter((i) => i.severity === 'error'))).toEqual([]);
    expect(recipients[0]).toMatchObject({ name: 'Ana María Pérez Rodríguez', email: 'ana.perez@universidad.edu' });

    const zip = await generate(tpl, fields, recipients);
    expect(Object.keys(zip)).toHaveLength(10);
    expect(Object.keys(zip)).toContain("María Elena O'Connor-Pérez - Certificado.pdf");
    expect(Object.keys(zip)).toContain('Íñigo Peña Nuñez - Certificado.pdf');

    const text = await pdfText(zip['Íñigo Peña Nuñez - Certificado.pdf']);
    expect(text).toContain('Íñigo Peña Nuñez');
    expect(text).toContain('Inteligencia Artificial Aplicada');
  });

  it('una columna llamada "C++" o "Nota (final" no rompe el PDF, el nombre de archivo ni el correo', async () => {
    const tpl = template();
    const fields = fieldsFor(tpl, 'C++');
    const csv = 'Nombre,Correo,C++,Nota (final\nAna Pérez,ana@uni.pe,Avanzado,18\nLuis Soto,luis@uni.pe,Básico,US$& 15\n';
    const recipients = loadRecipients(csv, tpl, fields);

    const zip = await generate(tpl, fields, recipients, '{nombre} - {C++} - {Nota (final}');
    expect(Object.keys(zip).sort()).toEqual(['Ana Pérez - Avanzado - 18.pdf', 'Luis Soto - Básico - US$& 15.pdf']);
    expect(await pdfText(zip['Ana Pérez - Avanzado - 18.pdf'])).toContain('Avanzado');

    expect(interpolateEmailVariables('Hola {nombre}: {C++}, nota {Nota (final}', recipients[1])).toBe(
      'Hola Luis Soto: Básico, nota US$& 15'
    );
  });

  it('los homónimos reciben cada uno su PDF y las filas con error no se generan', async () => {
    const tpl = template();
    const fields = fieldsFor(tpl, 'Curso');
    const csv = [
      'Nombre;Correo;Curso',
      'Ana Pérez;ana1@uni.pe;IA',
      'ana pérez;ana2@uni.pe;Datos',
      ';sin-nombre@uni.pe;IA',
      'Luis Soto;correo-invalido;IA',
      'Ana Pérez;ana3@uni.pe;Redes',
    ].join('\r\n');
    const recipients = loadRecipients(csv, tpl, fields);

    expect(recipients.map((r) => r.issues.map((i) => i.code))).toEqual([
      [],
      ['DUPLICATE'],
      ['EMPTY_NAME'],
      ['INVALID_EMAIL'],
      ['DUPLICATE'],
    ]);

    const zip = await generate(tpl, fields, recipients);
    expect(Object.keys(zip).sort()).toEqual([
      'Ana Pérez - Certificado (2).pdf',
      'Ana Pérez - Certificado (3).pdf',
      'Ana Pérez - Certificado.pdf',
    ]);
    const courses = await Promise.all(Object.values(zip).map(pdfText));
    expect(courses.map((t) => ['IA', 'Datos', 'Redes'].find((c) => t.includes(c))).sort()).toEqual(['Datos', 'IA', 'Redes']);
  });
});
