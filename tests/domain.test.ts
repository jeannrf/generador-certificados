import { describe, it, expect } from 'vitest';
import { cleanString, toTitleCase, transformTextCase } from '../src/domain/normalization';
import { normalizedToPdfCoords, calculateOptimalFontSize } from '../src/domain/layout';
import { validateRecipients, generateSafeFileName, formatCertificateFileName } from '../src/domain/validation';
import { FieldBox } from '../src/domain/types';

describe('Domain - Normalization', () => {
  it('should trim and collapse multiple spaces and remove control chars', () => {
    const raw = '  Juan   \u200BCarlos   Pérez  ';
    expect(cleanString(raw)).toBe('Juan Carlos Pérez');
  });

  it('should format Title Case respecting Spanish particles', () => {
    expect(toTitleCase('JOSÉ LUIS DE LA TORRE')).toBe('José Luis de la Torre');
    expect(toTitleCase('ANA MARÍA DEL ROSARIO')).toBe('Ana María del Rosario');
    expect(toTitleCase('CARLOS Y SUSANA')).toBe('Carlos y Susana');
    expect(toTitleCase("MARÍA ELENA O'CONNOR")).toBe("María Elena O'Connor");
    expect(toTitleCase('JUAN CARLOS PÉREZ-GIL')).toBe('Juan Carlos Pérez-Gil');
  });

  it('should transform case properly based on textCase', () => {
    expect(transformTextCase('ana maría pérez', 'upper')).toBe('ANA MARÍA PÉREZ');
    expect(transformTextCase('ANA MARÍA PÉREZ', 'title')).toBe('Ana María Pérez');
    expect(transformTextCase('ANA MARÍA PÉREZ', 'original')).toBe('ANA MARÍA PÉREZ');
  });
});

describe('Domain - Layout & Coordinates', () => {
  it('should convert normalized coordinates to PDF coordinates (bottom-left origin)', () => {
    const box: FieldBox = {
      id: 'f1',
      name: 'Nombre',
      source: { type: 'column', column: 'nombre' },
      x: 0.1, // 10% from left
      y: 0.2, // 20% from top
      width: 0.8, // 80% width
      height: 0.1, // 10% height
      fontFamily: 'Helvetica',
      maxFontSize: 40,
      minFontSize: 20,
      color: '#000000',
      align: 'center',
      vAlign: 'middle',
      textCase: 'title',
    };

    const pageWidthPt = 800;
    const pageHeightPt = 600;

    const coords = normalizedToPdfCoords(box, pageWidthPt, pageHeightPt);

    expect(coords.xPt).toBe(80);
    expect(coords.widthPt).toBe(640);
    expect(coords.heightPt).toBe(60);
    // Base inferior de la caja = 600 - (0.2 + 0.1) * 600 = 600 - 180 = 420
    expect(coords.yPt).toBe(420);
  });

  it('should auto-reduce font size until text fits', () => {
    // Simular que el texto mide 10 pt por carácter * tamaño / 20
    const fakeMeasure = (text: string, size: number) => text.length * size * 0.5;

    const longText = 'Maximiliano Alejandro de la Fuente y Montalbán'; // 46 chars
    const result = calculateOptimalFontSize(longText, 40, 16, 400, fakeMeasure);

    expect(result.fontSize).toBeLessThanOrEqual(40);
    expect(result.fontSize).toBeGreaterThanOrEqual(16);
    expect(fakeMeasure(longText, result.fontSize)).toBeLessThanOrEqual(400);
  });
});

describe('Domain - Validation & File Safety', () => {
  it('should detect empty names and invalid emails', () => {
    const raw = [
      { name: '', email: 'valid@example.com' },
      { name: 'Pedro García', email: 'not-an-email' },
      { name: 'Ana López', email: 'ana@example.com' },
      { name: 'Ana López', email: 'ana2@example.com' }, // Duplicate name
    ];

    const results = validateRecipients(raw);

    expect(results[0].issues[0].code).toBe('EMPTY_NAME');
    expect(results[0].issues[0].severity).toBe('error');

    expect(results[1].issues[0].code).toBe('INVALID_EMAIL');
    expect(results[1].issues[0].severity).toBe('error');

    expect(results[2].issues.length).toBe(0); // Válido

    expect(results[3].issues[0].code).toBe('DUPLICATE');
    expect(results[3].issues[0].severity).toBe('warning');
  });

  it('should detect text overflow warning for names that exceed field box width', () => {
    const raw = [
      { name: 'Luis Fabiano de Jesus Vargas Mauro' },
    ];
    const field: FieldBox = {
      id: 'f1',
      name: 'Nombre',
      source: { type: 'column', column: 'nombre' },
      x: 0.15,
      y: 0.42,
      width: 0.70, // Marco de 70%
      height: 0.13,
      fontFamily: 'Playfair Display, serif',
      maxFontSize: 46, // 46 pt provoca desborde en 70%
      minFontSize: 20,
      color: '#000000',
      align: 'center',
      vAlign: 'middle',
      textCase: 'title',
      isBold: true,
    };

    const results = validateRecipients(raw, { field, templateWidthPt: 841.89 });

    expect(results[0].issues.length).toBeGreaterThan(0);
    const overflowIssue = results[0].issues.find((i) => i.code === 'TEXT_OVERFLOW');
    expect(overflowIssue).toBeDefined();
    expect(overflowIssue?.severity).toBe('warning');
  });

  it('should preserve recipient IDs and raw names during validation and edits', () => {
    const raw = [
      { id: 'custom-id-1', name: 'Ana María ', email: 'ana@example.com' },
      { id: 'custom-id-2', name: 'Carlos Gomez', email: 'carlos@example.com' },
    ];

    const results = validateRecipients(raw);

    expect(results[0].id).toBe('custom-id-1');
    expect(results[0].name).toBe('Ana María ');
    expect(results[1].id).toBe('custom-id-2');
  });

  it('should sanitize file names safely', () => {
    const safe = generateSafeFileName('Ana/María: "Pérez" & <Test>?');
    expect(safe).toBe('Certificado - AnaMaría Pérez & Test.pdf');
  });

  it('should format certificate file names with custom patterns', () => {
    const f1 = formatCertificateFileName('{nombre} - Certificado UNI', 'Juan Pérez');
    expect(f1).toBe('Juan Pérez - Certificado UNI.pdf');

    const f2 = formatCertificateFileName('[nombre] - Certificado 2026', 'María Gomez');
    expect(f2).toBe('María Gomez - Certificado 2026.pdf');

    const f3 = formatCertificateFileName('Constancia - {nombre}', 'Carlos / Silva');
    expect(f3).toBe('Constancia - Carlos Silva.pdf');
  });
});

describe('Domain - Column Detection', () => {
  it('should detect name and email columns by header keywords', async () => {
    const { detectColumns } = await import('../src/infra/parsers');
    const headers = ['ID', 'Nombre Completo', 'Correo Electrónico', 'DNI'];
    const detected = detectColumns(headers);
    expect(detected.nameCol).toBe('Nombre Completo');
    expect(detected.emailCol).toBe('Correo Electrónico');
  });

  it('should detect email column by row content if header name is not standard', async () => {
    const { detectColumns } = await import('../src/infra/parsers');
    const headers = ['Estudiante', 'Contacto', 'Tipo'];
    const rows = [
      { Estudiante: 'Juan Perez', Contacto: 'juan@uni.pe', Tipo: 'Institucional' },
      { Estudiante: 'Maria Soto', Contacto: 'maria@gmail.com', Tipo: 'Personal' },
    ];
    const detected = detectColumns(headers, rows);
    expect(detected.nameCol).toBe('Estudiante');
    expect(detected.emailCol).toBe('Contacto');
  });

  it('should not detect email column if rows do not contain emails', async () => {
    const { detectColumns } = await import('../src/infra/parsers');
    const headers = ['Estudiante', 'Tipo', 'Nota'];
    const rows = [
      { Estudiante: 'Juan Perez', Tipo: 'Institucional', Nota: '20' },
      { Estudiante: 'Maria Soto', Tipo: 'Personal', Nota: '18' },
    ];
    const detected = detectColumns(headers, rows);
    expect(detected.nameCol).toBe('Estudiante');
    expect(detected.emailCol).toBeUndefined();
  });
});
