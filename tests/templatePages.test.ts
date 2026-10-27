import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertCanAddPages,
  assertSupportedFile,
  assertTemplateIsValid,
  detectFileFormat,
  exifImageMatrix,
  imagePageSizePt,
  MAX_TEMPLATE_PAGES,
  migrateLegacyFields,
  migrateLegacyTemplate,
  movePage,
  readImageInfo,
  removePage,
  replacePage,
  TemplateFileError,
} from '../src/domain/templatePages';
import {
  autoAssignColumns,
  unassignedColumnFields,
  applyRecipientOverrides,
  createNameField,
  createQrField,
  createTextField,
  defaultNameFontSize,
  NAME_FIELD_ID,
  resetNameFieldLayout,
  reconcileFieldsWithTemplate,
  resolveFieldText,
} from '../src/domain/fields';
import { validateRecipients } from '../src/domain/validation';
import { FieldBox, TemplateData, TemplatePage } from '../src/domain/types';
import { migrateSession } from '../src/infra/storage';

const fixture = (name: string) => new Uint8Array(readFileSync(resolve(__dirname, 'fixtures', name)));

function fakePage(id: string, overrides: Partial<TemplatePage> = {}): TemplatePage {
  return {
    id,
    sourceName: `${id}.png`,
    kind: 'image',
    bytes: fixture('page2.png'),
    mimeType: 'image/png',
    widthPt: 600,
    heightPt: 800,
    previewUrl: '',
    ...overrides,
  };
}

function crc32Of(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function expectTemplateError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(TemplateFileError);
    expect((err as TemplateFileError).code).toBe(code);
    return err as TemplateFileError;
  }
  throw new Error(`Se esperaba TemplateFileError ${code}`);
}

describe('Template pages - formatos', () => {
  it('detecta PDF, PNG y JPG por su firma y no por la extensión', () => {
    expect(detectFileFormat(fixture('page1.jpg'))).toBe('jpeg');
    expect(detectFileFormat(fixture('page2.png'))).toBe('png');
    expect(detectFileFormat(new TextEncoder().encode('%PDF-1.7\n...'))).toBe('pdf');
    expect(detectFileFormat(new TextEncoder().encode('GIF89a......'))).toBeNull();
  });

  it('rechaza formatos no soportados aunque tengan extensión válida', () => {
    const gif = new TextEncoder().encode('GIF89a fake content');
    const err = expectTemplateError(() => assertSupportedFile(gif, 'diseño.png'), 'UNSUPPORTED_FORMAT');
    expect(err.message).toContain('diseño.png');
  });

  it('rechaza archivos de más de 15 MB', () => {
    const big = new Uint8Array(15 * 1024 * 1024 + 1);
    expectTemplateError(() => assertSupportedFile(big, 'enorme.pdf'), 'FILE_TOO_LARGE');
  });

  it('lee dimensiones de PNG y JPG desde la cabecera', () => {
    expect(readImageInfo(fixture('page1.jpg'), 'jpeg', 'page1.jpg')).toEqual({ widthPx: 1200, heightPx: 848, orientation: 1, rotation: 0 });
    expect(readImageInfo(fixture('page2.png'), 'png', 'page2.png')).toEqual({ widthPx: 850, heightPx: 1100, orientation: 1, rotation: 0 });
  });

  it('respeta la orientación EXIF de los JPG al calcular el tamaño de página', () => {
    const info = readImageInfo(fixture('rotated-exif6.jpg'), 'jpeg', 'rotada.jpg');
    expect(info).toEqual({ widthPx: 400, heightPx: 200, orientation: 6, rotation: 90 });
    expect(imagePageSizePt(info)).toEqual({ widthPt: 150, heightPt: 300 });
  });

  it('la matriz EXIF lleva la esquina superior izquierda de la imagen a donde debe verse', () => {
    // Imagen codificada de 200×100 pt; esquina superior izquierda = (u=0, v=1) en el espacio de la imagen
    const topLeft = (o: number) => {
      const [a, b, c, d, e, f] = exifImageMatrix(o, 200, 100);
      return [c + e, d + f]; // (0·a + 1·c + e, 0·b + 1·d + f)
    };
    // Página visible: 200×100 para 1-4 y 100×200 para 5-8 (origen PDF abajo-izquierda)
    expect(topLeft(1)).toEqual([0, 100]); // arriba-izquierda
    expect(topLeft(2)).toEqual([200, 100]); // espejo: arriba-derecha
    expect(topLeft(3)).toEqual([200, 0]); // 180°: abajo-derecha
    expect(topLeft(4)).toEqual([0, 0]); // espejo vertical: abajo-izquierda
    expect(topLeft(5)).toEqual([0, 200]); // transpuesta: arriba-izquierda
    expect(topLeft(6)).toEqual([100, 200]); // 90° horario: arriba-derecha
    expect(topLeft(7)).toEqual([100, 0]); // transversa: abajo-derecha
    expect(topLeft(8)).toEqual([0, 0]); // 270° horario: abajo-izquierda
  });

  it('convierte px a pt a 96 DPI conservando la proporción', () => {
    const size = imagePageSizePt({ widthPx: 1200, heightPx: 848, orientation: 1, rotation: 0 });
    expect(size).toEqual({ widthPt: 900, heightPt: 636 });
    expect(size.widthPt / size.heightPt).toBeCloseTo(1200 / 848, 2);
  });

  it('detecta imágenes corruptas o truncadas', () => {
    const truncatedPng = fixture('page2.png').slice(0, 20);
    expectTemplateError(() => readImageInfo(truncatedPng, 'png', 'rota.png'), 'CORRUPT_FILE');
    const truncatedJpg = fixture('page1.jpg').slice(0, 30);
    expectTemplateError(() => readImageInfo(truncatedJpg, 'jpeg', 'rota.jpg'), 'CORRUPT_FILE');
  });

  it('detecta PNG con datos alterados (CRC inválido) aunque la cabecera sea correcta', () => {
    const png = fixture('page2.png').slice();
    png[png.length - 100] ^= 0xff;
    expectTemplateError(() => readImageInfo(png, 'png', 'alterada.png'), 'CORRUPT_FILE');
  });

  it('rechaza imágenes por encima de 8000 px por lado o 25 MP', () => {
    const withSize = (w: number, h: number) => {
      const png = fixture('page2.png').slice();
      const view = new DataView(png.buffer);
      view.setUint32(16, w);
      view.setUint32(20, h);
      view.setUint32(29, crc32Of(png.subarray(12, 29))); // recalcular CRC del IHDR
      return png;
    };
    expectTemplateError(() => readImageInfo(withSize(9000, 100), 'png', 'ancha.png'), 'IMAGE_TOO_LARGE');
    const err = expectTemplateError(() => readImageInfo(withSize(6000, 5000), 'png', 'grande.png'), 'IMAGE_TOO_LARGE');
    expect(err.message).toContain('25 MP');
    expect(readImageInfo(withSize(5000, 5000), 'png', 'ok.png').widthPx).toBe(5000);
  });
});

describe('Template pages - límite de 5 páginas', () => {
  it(`permite hasta ${MAX_TEMPLATE_PAGES} páginas en total`, () => {
    expect(() => assertCanAddPages(0, 5, 'cinco.pdf')).not.toThrow();
    expect(() => assertCanAddPages(4, 1, 'quinta.png')).not.toThrow();
  });

  it('rechaza un PDF multipágina que supera el límite con un mensaje claro', () => {
    const err = expectTemplateError(() => assertCanAddPages(3, 4, 'anexo.pdf'), 'TOO_MANY_PAGES');
    expect(err.message).toBe(
      '"anexo.pdf" aporta 4 páginas y solo quedan 2 lugares. Una plantilla admite como máximo 5 páginas.'
    );
  });

  it('rechaza un PDF de 6 páginas en una plantilla vacía', () => {
    expectTemplateError(() => assertCanAddPages(0, 6, 'seis.pdf'), 'TOO_MANY_PAGES');
  });

  it('rechaza agregar páginas cuando ya hay 5', () => {
    const err = expectTemplateError(() => assertCanAddPages(5, 1, 'extra.jpg'), 'TOO_MANY_PAGES');
    expect(err.message).toContain('ya no queda espacio');
  });

  it('al reemplazar descuenta la página sustituida', () => {
    expect(() => assertCanAddPages(5, 1, 'nueva.png', true)).not.toThrow();
    expectTemplateError(() => assertCanAddPages(5, 2, 'doble.pdf', true), 'TOO_MANY_PAGES');
  });

  it('la validación final de la plantilla también aplica el límite (segunda barrera)', () => {
    const pages = Array.from({ length: 6 }, (_, i) => fakePage(`p${i}`));
    expectTemplateError(() => assertTemplateIsValid({ id: 't', name: 't', pages }), 'TOO_MANY_PAGES');
    expectTemplateError(() => assertTemplateIsValid({ id: 't', name: 't', pages: [] }), 'NO_PAGES');
  });

  it('la validación final detecta una página cuyo contenido no coincide con su tipo', () => {
    const tpl: TemplateData = { id: 't', name: 't', pages: [fakePage('p1', { kind: 'pdf' })] };
    expectTemplateError(() => assertTemplateIsValid(tpl), 'CORRUPT_FILE');
  });
});

describe('Template pages - orden y edición', () => {
  const pages = ['a', 'b', 'c'].map((id) => fakePage(id));

  it('reordena páginas sin mutar el arreglo original', () => {
    expect(movePage(pages, 0, 2).map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(movePage(pages, 2, 0).map((p) => p.id)).toEqual(['c', 'a', 'b']);
    expect(movePage(pages, 0, 5)).toBe(pages);
    expect(pages.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('reemplaza una página conservando su id (y por lo tanto sus campos)', () => {
    const replaced = replacePage(pages, 'b', [fakePage('nueva', { sourceName: 'nueva.jpg' })]);
    expect(replaced.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(replaced[1].sourceName).toBe('nueva.jpg');
  });

  it('reemplazar por un PDF de varias páginas las inserta en la misma posición', () => {
    const replaced = replacePage(pages, 'b', [fakePage('x1'), fakePage('x2')]);
    expect(replaced.map((p) => p.id)).toEqual(['a', 'b', 'x2', 'c']);
  });

  it('elimina páginas', () => {
    expect(removePage(pages, 'b').map((p) => p.id)).toEqual(['a', 'c']);
  });
});

describe('Fields - campos por página', () => {
  const template: TemplateData = { id: 't', name: 't', pages: [fakePage('p1'), fakePage('p2'), fakePage('p3')] };

  it('el tamaño por defecto del nombre es 28 pt en A4 y escala con la página', () => {
    expect(defaultNameFontSize({ widthPt: 842, heightPt: 595 })).toBe(28);
    expect(defaultNameFontSize({ widthPt: 595, heightPt: 842 })).toBe(28);
    expect(defaultNameFontSize({ widthPt: 1500, heightPt: 1060 })).toBe(50); // imagen de 2000×1414 px
    expect(defaultNameFontSize({ widthPt: 300, heightPt: 200 })).toBe(16); // mínimo legible
    expect(defaultNameFontSize({ widthPt: 6000, heightPt: 4000 })).toBe(120); // tope
    expect(defaultNameFontSize()).toBe(28);
  });

  it('el nombre nuevo y "Restablecer" usan el tamaño de su página', () => {
    const big = { widthPt: 1500, heightPt: 1060 };
    const name = createNameField('p1', big);
    expect([name.maxFontSize, name.minFontSize]).toEqual([50, 35]);
    expect([createNameField('p1').maxFontSize, createNameField('p1').minFontSize]).toEqual([28, 20]);

    const moved = { ...createNameField('p1'), x: 0.3, width: 0.2, maxFontSize: 12, isBold: false };
    expect(resetNameFieldLayout(moved, big)).toMatchObject({ x: 0.05, width: 0.9, maxFontSize: 50, minFontSize: 35, isBold: true });
  });

  it('un campo nuevo no queda escondido debajo de otro en la misma posición', () => {
    const page = { id: 'p1', widthPt: 842, heightPt: 595 };
    const first = createQrField(page, []);
    const second = createQrField(page, [first]);
    const third = createQrField(page, [first, second]);

    // Cada uno, un poco más arriba y a la izquierda que el anterior
    expect(second.x).toBeCloseTo(first.x - 0.04, 6);
    expect(second.y).toBeCloseTo(first.y - 0.05, 6);
    expect(third.x).toBeCloseTo(second.x - 0.04, 6);
    expect(third.y).toBeCloseTo(second.y - 0.05, 6);

    // En otra página o si el primero ya se movió, se usa la posición por defecto
    expect(createQrField({ ...page, id: 'p2' }, [first])).toMatchObject({ x: first.x, y: first.y });
    expect(createQrField(page, [{ ...first, x: 0.1, y: 0.1 }])).toMatchObject({ x: first.x, y: first.y });

    // Lo mismo con los campos de texto
    const text1 = createTextField('p1', []);
    const text2 = createTextField('p1', [text1]);
    expect([text2.x, text2.y]).not.toEqual([text1.x, text1.y]);
  });

  it('la cascada nunca saca un campo de la página', () => {
    const page = { id: 'p1', widthPt: 842, heightPt: 595 };
    const fields: FieldBox[] = [];
    for (let i = 0; i < 30; i++) fields.push(createQrField(page, fields));
    for (const f of fields) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.width).toBeLessThanOrEqual(1 + 1e-9);
      expect(f.y + f.height).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('asigna sola la columna cuando el encabezado coincide con el campo, sin importar tildes ni mayúsculas', () => {
    const headers = ['Nombre', 'Correo', 'Código de verificación', 'CURSO'];
    const name = createNameField('p1');
    const curso: FieldBox = { ...createTextField('p1', []), id: 'c', name: 'Curso', source: { type: 'column', column: '' } };
    const codigo: FieldBox = { ...createTextField('p1', []), id: 'q', name: 'QR', source: { type: 'column', column: 'codigo de verificacion' } };
    const otro: FieldBox = { ...createTextField('p1', []), id: 'o', name: 'Horas', source: { type: 'column', column: '' } };
    const fijo: FieldBox = { ...createTextField('p1', []), id: 'f', name: 'Curso', source: { type: 'fixed', value: 'X' } };

    const assigned = autoAssignColumns([name, curso, codigo, otro, fijo], headers);
    expect(assigned.map((f) => f.source)).toEqual([
      name.source,
      { type: 'column', column: 'CURSO' },
      { type: 'column', column: 'Código de verificación' },
      { type: 'column', column: '' }, // sin coincidencia: se elige a mano
      { type: 'fixed', value: 'X' },
    ]);
    expect(unassignedColumnFields(assigned, headers).map((f) => f.name)).toEqual(['Horas']);
  });

  it('una columna que ya existe en la lista no se cambia', () => {
    const f: FieldBox = { ...createTextField('p1', []), name: 'Curso', source: { type: 'column', column: 'Correo' } };
    expect(autoAssignColumns([f], ['Correo', 'Curso'])[0].source).toEqual({ type: 'column', column: 'Correo' });
    expect(unassignedColumnFields([f], ['Nombre'])).toHaveLength(1);
  });

  it('crea el campo de nombre si falta', () => {
    const fields = reconcileFieldsWithTemplate([], template);
    expect(fields).toHaveLength(1);
    expect(fields[0].id).toBe(NAME_FIELD_ID);
    expect(fields[0].pageId).toBe('p1');
  });

  it('al eliminar una página descarta sus campos, pero el nombre pasa a la primera página', () => {
    const name = { ...createNameField('p2') };
    const curso = { ...createTextField('p2', [name]), id: 'curso' };
    const fecha = { ...createTextField('p3', [name]), id: 'fecha' };
    const withoutP2: TemplateData = { ...template, pages: removePage(template.pages, 'p2') };

    const fields = reconcileFieldsWithTemplate([name, curso, fecha], withoutP2);
    expect(fields.map((f) => [f.id, f.pageId])).toEqual([
      [NAME_FIELD_ID, 'p1'],
      ['fecha', 'p3'],
    ]);
  });

  it('resuelve el texto según el origen del campo', () => {
    const recipient = { name: 'Ana Pérez', extra: { curso: '  React   Avanzado ' } };
    const base = createTextField('p1', []);
    expect(resolveFieldText(createNameField('p1'), recipient)).toBe('Ana Pérez');
    expect(resolveFieldText({ ...base, source: { type: 'column', column: 'curso' } }, recipient)).toBe('React Avanzado');
    expect(resolveFieldText({ ...base, source: { type: 'column', column: 'fecha' } }, recipient)).toBe('');
    expect(resolveFieldText({ ...base, source: { type: 'fixed', value: '40 horas' } }, recipient)).toBe('40 horas');
  });

  it('los ajustes individuales solo afectan al nombre y nunca cambian su página', () => {
    const name = createNameField('p2');
    const other = createTextField('p2', [name]);
    const recipient = { customField: { maxFontSize: 12, pageId: 'p9' } as Partial<FieldBox> };
    const adjusted = applyRecipientOverrides(name, recipient);
    expect(adjusted.maxFontSize).toBe(12);
    expect(adjusted.pageId).toBe('p2');
    expect(applyRecipientOverrides(other, recipient)).toBe(other);
  });

  it('avisa cuando la columna de un campo adicional viene vacía', () => {
    const curso: FieldBox = { ...createTextField('p2', []), name: 'Curso', source: { type: 'column', column: 'curso' } };
    const [ok, empty] = validateRecipients(
      [
        { name: 'Ana', extra: { curso: 'React' } },
        { name: 'Luis', extra: { curso: ' ' } },
      ],
      { extraFields: [curso] }
    );
    expect(ok.issues).toEqual([]);
    expect(empty.issues).toEqual([
      { severity: 'warning', code: 'EMPTY_FIELD', message: '"Curso" quedará vacío (columna "curso" sin dato)' },
    ]);
  });
});

describe('Migración de sesiones de una página', () => {
  const legacyTemplate = {
    id: 'tpl_123',
    name: 'diploma.png',
    kind: 'image' as const,
    bytes: fixture('page2.png'),
    mimeType: 'image/png',
    widthPt: 638,
    heightPt: 825,
    previewUrl: 'blob:viejo',
  };
  const { pageId: _ignored, ...legacyField } = createNameField('');

  it('convierte la plantilla antigua en una plantilla de 1 página', () => {
    const tpl = migrateLegacyTemplate(legacyTemplate)!;
    expect(tpl.id).toBe('tpl_123');
    expect(tpl.pages).toHaveLength(1);
    expect(tpl.pages[0]).toMatchObject({
      id: 'tpl_123_p1',
      kind: 'image',
      widthPt: 638,
      heightPt: 825,
      sourceName: 'diploma.png',
    });
    expect(tpl.pages[0].bytes).toBe(legacyTemplate.bytes);
  });

  it('asigna el campo antiguo a la primera página', () => {
    const tpl = migrateLegacyTemplate(legacyTemplate);
    const fields = migrateLegacyFields(undefined, legacyField, tpl)!;
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ ...legacyField, pageId: 'tpl_123_p1' });
  });

  it('es idempotente', () => {
    const migrated = migrateSession({ template: legacyTemplate, field: legacyField, currentStep: 4 });
    const again = migrateSession(migrated as unknown as Record<string, unknown>);
    expect(again.template).toEqual(migrated.template);
    expect(again.fields).toEqual(migrated.fields);
    expect(again.currentStep).toBe(4);
    expect('field' in again).toBe(false);
  });

  it('una sesión sin plantilla sigue sin plantilla', () => {
    const migrated = migrateSession({ template: null, recipients: [] });
    expect(migrated.template).toBeNull();
    expect(migrated.fields).toEqual([]);
  });
});
