import { describe, it, expect } from 'vitest';
import { cleanString, toTitleCase, transformTextCase } from '../src/domain/normalization';
import { normalizedToPdfCoords, calculateOptimalFontSize } from '../src/domain/layout';
import { validateRecipients, generateSafeFileName } from '../src/domain/validation';
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

  it('should sanitize file names safely', () => {
    const safe = generateSafeFileName('Ana/María: "Pérez" & <Test>?');
    expect(safe).toBe('Certificado - AnaMaría Pérez & Test.pdf');
  });
});
