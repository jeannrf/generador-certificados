import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDict, PDFDocument, PDFName, PDFString, StandardFonts, degrees, rgb } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  buildTemplateBasePdf,
  composeCertificatePdf,
  composeCombinedCertificatePdf,
  setFontBytesLoader,
} from '../src/infra/pdfComposer';
import type { FontBytesLoader } from '../src/infra/fontLoader';
import { splitPdfPages } from '../src/infra/templateImport';
import { createNameField, createTextField } from '../src/domain/fields';
import { imagePageSizePt, migrateLegacyFields, migrateLegacyTemplate, movePage, readImageInfo, TemplateFileError } from '../src/domain/templatePages';
import { FieldBox, Recipient, TemplateData, TemplatePage } from '../src/domain/types';
import { composeCertificatePdf as composeLegacyCertificatePdf, LegacyTemplateData } from './fixtures/legacyComposer';

const fixture = (name: string) => new Uint8Array(readFileSync(resolve(__dirname, 'fixtures', name)));

/** Fuentes desde tests/fixtures/fonts (sin red). Las que no están fallan y se usa el respaldo estándar. */
const fixtureFontLoader: FontBytesLoader = async (font, variant) => {
  const file = resolve(__dirname, 'fixtures', 'fonts', `${font.id}-${variant.weight}-${variant.italic ? 'italic' : 'normal'}.ttf`);
  if (!existsSync(file)) throw new Error(`Fuente de prueba no disponible: ${file}`);
  return new Uint8Array(readFileSync(file));
};

beforeAll(() => setFontBytesLoader(fixtureFontLoader));

/** Nombres de las fuentes incrustadas (BaseFont de las fuentes de nivel superior). */
async function embeddedFontNames(bytes: Uint8Array): Promise<string[]> {
  const doc = await PDFDocument.load(bytes);
  const names: string[] = [];
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict) || object.get(PDFName.of('Type')) !== PDFName.of('Font')) continue;
    const subtype = object.get(PDFName.of('Subtype'));
    if (subtype === PDFName.of('Type0') || subtype === PDFName.of('Type1')) {
      names.push(String(object.get(PDFName.of('BaseFont'))).replace(/^\//, ''));
    }
  }
  return names.sort();
}

async function makeVectorPdf(
  label: string,
  size: [number, number] = [842, 595],
  options: { rotate?: number; pages?: number } = {}
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < (options.pages ?? 1); i++) {
    const page = doc.addPage(size);
    page.drawRectangle({ x: 20, y: 20, width: size[0] - 40, height: size[1] - 40, borderColor: rgb(0.1, 0.2, 0.5), borderWidth: 4 });
    page.drawText(options.pages ? `${label} ${i + 1}` : label, { x: 60, y: size[1] - 80, size: 24, font });
    if (options.rotate) page.setRotation(degrees(options.rotate));
  }
  return doc.save();
}

function imagePage(id: string, file: string): TemplatePage {
  const bytes = fixture(file);
  const format = file.endsWith('.png') ? 'png' : 'jpeg';
  return {
    id,
    sourceName: file,
    kind: 'image',
    bytes,
    mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
    ...imagePageSizePt(readImageInfo(bytes, format, file)),
    previewUrl: '',
  };
}

async function pdfPage(id: string, bytes: Uint8Array, sourceName = `${id}.pdf`): Promise<TemplatePage> {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0);
  const { width, height } = page.getSize();
  const swap = page.getRotation().angle % 180 !== 0;
  return {
    id,
    sourceName,
    kind: 'pdf',
    bytes,
    mimeType: 'application/pdf',
    widthPt: Math.round(swap ? height : width),
    heightPt: Math.round(swap ? width : height),
    previewUrl: '',
  };
}

function recipient(name: string, extra: Record<string, string> = {}): Recipient {
  return { id: `rec_${name}`, rowNumber: 1, name, extra, issues: [] };
}

interface PageText {
  width: number;
  height: number;
  items: { str: string; x: number; y: number }[];
}

/** Lee con pdf.js (el mismo motor que el visor) el tamaño visible y los textos de cada página. */
async function readPdf(bytes: Uint8Array): Promise<PageText[]> {
  const doc = await getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const pages: PageText[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push({
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      items: content.items
        .filter((item): item is typeof item & { str: string; transform: number[] } => 'str' in item && item.str.trim() !== '')
        .map((item) => ({ str: item.str, x: item.transform[4], y: item.transform[5] })),
    });
  }
  return pages;
}

function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Cuenta las imágenes rasterizadas (XObject /Image) que usa una página. */
async function countImagesOnPage(bytes: Uint8Array, pageIndex: number): Promise<number> {
  const doc = await getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
  const page = await doc.getPage(pageIndex + 1);
  const ops = await page.getOperatorList();
  const { OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return ops.fnArray.filter((fn) => fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject).length;
}

describe('PDF composer - conversión de cada formato a página PDF', () => {
  it('JPG: página del tamaño de la imagen a 96 DPI, sin recomprimir', async () => {
    const tpl: TemplateData = { id: 't', name: 't', pages: [imagePage('p1', 'page1.jpg')] };
    const out = await buildTemplateBasePdf(tpl);
    const [page] = await readPdf(out);
    expect([page.width, page.height]).toEqual([900, 636]); // 1200×848 px × 0,75
    // El JPEG original está embebido byte a byte (DCTDecode), sin pérdida de calidad
    expect(containsBytes(out, fixture('page1.jpg').subarray(0, 2048))).toBe(true);
  });

  it('PNG: conserva tamaño y proporción', async () => {
    const tpl: TemplateData = { id: 't', name: 't', pages: [imagePage('p1', 'page2.png')] };
    const [page] = await readPdf(await buildTemplateBasePdf(tpl));
    expect([page.width, page.height]).toEqual([638, 825]); // 850×1100 px × 0,75
    expect(page.width / page.height).toBeCloseTo(850 / 1100, 2);
  });

  it('PDF: la página sigue siendo vectorial (texto extraíble y sin imágenes rasterizadas)', async () => {
    const tpl: TemplateData = { id: 't', name: 't', pages: [await pdfPage('p1', await makeVectorPdf('Reverso vectorial'))] };
    const out = await buildTemplateBasePdf(tpl);
    const [page] = await readPdf(out);
    expect([page.width, page.height]).toEqual([842, 595]);
    expect(page.items.map((i) => i.str)).toContain('Reverso vectorial');
    expect(await countImagesOnPage(out, 0)).toBe(0);
  });

  it('PDF con /Rotate 90: la página sale con su orientación visible y sin rotación pendiente', async () => {
    const rotated = await makeVectorPdf('Girado', [595, 842], { rotate: 90 });
    const page = await pdfPage('p1', rotated);
    expect([page.widthPt, page.heightPt]).toEqual([842, 595]);

    const out = await buildTemplateBasePdf({ id: 't', name: 't', pages: [page] });
    const doc = await PDFDocument.load(out);
    expect(doc.getPage(0).getRotation().angle).toBe(0);
    expect(doc.getPage(0).getSize()).toEqual({ width: 842, height: 595 });
    const [visible] = await readPdf(out);
    expect([visible.width, visible.height]).toEqual([842, 595]);
    expect(visible.items.map((i) => i.str)).toContain('Girado');
  });

  it('JPG con orientación EXIF: la página sale girada como la ve el usuario', async () => {
    const out = await buildTemplateBasePdf({ id: 't', name: 't', pages: [imagePage('p1', 'rotated-exif6.jpg')] });
    const [page] = await readPdf(out);
    expect([page.width, page.height]).toEqual([150, 300]);
  });

  it('separa un PDF multipágina en páginas independientes y vectoriales', async () => {
    const multi = await PDFDocument.load(await makeVectorPdf('Anexo', [595, 842], { pages: 3 }));
    const singles = await splitPdfPages(multi);
    expect(singles).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      const [page] = await readPdf(singles[i]);
      expect(page.items.map((it) => it.str)).toEqual([`Anexo ${i + 1}`]);
    }
  });

  it('rechaza una página PDF corrupta', async () => {
    const good = await makeVectorPdf('X');
    const page = await pdfPage('p1', good);
    const corrupt = { ...page, bytes: good.slice(0, 120) };
    await expect(buildTemplateBasePdf({ id: 't', name: 't', pages: [corrupt] })).rejects.toBeInstanceOf(TemplateFileError);
  });

  it('rechaza una imagen corrupta', async () => {
    const page = imagePage('p1', 'page2.png');
    const corrupt = { ...page, bytes: page.bytes.slice(0, 200) };
    await expect(buildTemplateBasePdf({ id: 't', name: 't', pages: [corrupt] })).rejects.toBeInstanceOf(TemplateFileError);
  });

  it('rechaza plantillas de más de 5 páginas también al generar', async () => {
    const pages = Array.from({ length: 6 }, (_, i) => ({ ...imagePage(`p${i}`, 'page2.png') }));
    const err = await buildTemplateBasePdf({ id: 't', name: 't', pages }).catch((e) => e);
    expect(err).toBeInstanceOf(TemplateFileError);
    expect(err.code).toBe('TOO_MANY_PAGES');
  });
});

describe('PDF composer - plantillas multipágina', () => {
  async function threePageTemplate(): Promise<TemplateData> {
    return {
      id: 'tpl_multi',
      name: 'Diploma',
      pages: [
        imagePage('p_jpg', 'page1.jpg'),
        imagePage('p_png', 'page2.png'),
        await pdfPage('p_pdf', await makeVectorPdf('Reverso vectorial')),
      ],
    };
  }

  it('genera un único PDF con las páginas en el orden de la plantilla, cada una con su tamaño', async () => {
    const tpl = await threePageTemplate();
    const { pdfBytes } = await composeCertificatePdf(tpl, [createNameField('p_jpg')], recipient('Ana Pérez'));
    const pages = await readPdf(pdfBytes);
    expect(pages.map((p) => [p.width, p.height])).toEqual([[900, 636], [638, 825], [842, 595]]);
  });

  it('respeta el nuevo orden tras reordenar', async () => {
    const tpl = await threePageTemplate();
    const reordered: TemplateData = { ...tpl, pages: movePage(tpl.pages, 2, 0) };
    const { pdfBytes } = await composeCertificatePdf(reordered, [createNameField('p_jpg')], recipient('Ana Pérez'));
    const pages = await readPdf(pdfBytes);
    expect(pages.map((p) => [p.width, p.height])).toEqual([[842, 595], [900, 636], [638, 825]]);
    // El nombre sigue a su página (ahora la segunda), no a la posición
    expect(pages[1].items.map((i) => i.str)).toContain('Ana Pérez');
    expect(pages[0].items.map((i) => i.str)).not.toContain('Ana Pérez');
  });

  it('estampa cada campo en su página y deja sin campos las que no tienen', async () => {
    const tpl = await threePageTemplate();
    const name = createNameField('p_png');
    const curso: FieldBox = { ...createTextField('p_pdf', [name]), id: 'curso', source: { type: 'column', column: 'curso' } };
    const horas: FieldBox = { ...createTextField('p_pdf', [name]), id: 'horas', y: 0.85, source: { type: 'fixed', value: '40 horas' } };

    const { pdfBytes, fileName } = await composeCertificatePdf(
      tpl,
      [name, curso, horas],
      recipient('ANA MARÍA PÉREZ', { curso: 'React Avanzado' })
    );
    const [p1, p2, p3] = await readPdf(pdfBytes);

    expect(p1.items).toEqual([]); // JPG sin campos
    expect(p2.items.map((i) => i.str)).toEqual(['Ana María Pérez']);
    expect(p3.items.map((i) => i.str).sort()).toEqual(['40 horas', 'React Avanzado', 'Reverso vectorial']);
    expect(fileName).toBe('Ana María Pérez - Certificado.pdf');
  });

  it('las coordenadas de cada campo son relativas a su propia página', async () => {
    const tpl = await threePageTemplate();
    const left = { ...createTextField('p_png', []), id: 'izq', x: 0, width: 0.5, align: 'left' as const, source: { type: 'fixed' as const, value: 'A' } };
    const onWide = { ...left, id: 'ancha', pageId: 'p_pdf', x: 0.5, source: { type: 'fixed' as const, value: 'B' } };
    const { pdfBytes } = await composeCertificatePdf(tpl, [createNameField('p_jpg'), left, onWide], recipient('X'));
    const pages = await readPdf(pdfBytes);
    const a = pages[1].items.find((i) => i.str === 'A')!;
    const b = pages[2].items.find((i) => i.str === 'B')!;
    expect(a.x).toBeCloseTo(0, 0);
    expect(b.x).toBeCloseTo(842 * 0.5, 0);
    // y = 70 % desde arriba, centrado en una caja de 7 % de alto: queda en el tercio inferior de cada página
    expect(a.y / pages[1].height).toBeLessThan(0.3);
    expect(b.y / pages[2].height).toBeLessThan(0.3);
  });

  it('no estampa campos vacíos ni campos de páginas que ya no existen', async () => {
    const tpl = await threePageTemplate();
    const fecha: FieldBox = { ...createTextField('p_pdf', []), id: 'fecha', source: { type: 'column', column: 'fecha' } };
    const huerfano: FieldBox = { ...createTextField('p_borrada', []), id: 'huerfano', source: { type: 'fixed', value: 'NO' } };
    const { pdfBytes } = await composeCertificatePdf(tpl, [createNameField('p_jpg'), fecha, huerfano], recipient('Ana'));
    const all = (await readPdf(pdfBytes)).flatMap((p) => p.items.map((i) => i.str));
    expect(all.sort()).toEqual(['Ana', 'Reverso vectorial']);
  });

  it('PDF combinado: N personas × páginas, reutilizando cada página de la plantilla', async () => {
    const tpl = await threePageTemplate();
    const fields = [createNameField('p_png')];
    const people = ['Ana', 'Luis', 'Marta'].map((n) => recipient(n));

    const combined = await composeCombinedCertificatePdf(tpl, fields, people);
    const pages = await readPdf(combined);
    expect(pages).toHaveLength(9);
    expect(pages.map((p) => p.items.find((i) => i.str !== 'Reverso vectorial')?.str ?? null)).toEqual([
      null, 'Ana', null,
      null, 'Luis', null,
      null, 'Marta', null,
    ]);

    // Las imágenes se incrustan una sola vez: 3 personas no triplican el peso
    const single = (await composeCertificatePdf(tpl, fields, people[0])).pdfBytes;
    expect(combined.length).toBeLessThan(single.length * 1.5);
  });
});

describe('PDF composer - retrocompatibilidad con plantillas de 1 página', () => {
  // Sin descargar fuentes, el resultado debe ser idéntico al del composer anterior
  beforeAll(() => setFontBytesLoader(null));
  afterAll(() => setFontBytesLoader(fixtureFontLoader));

  const legacyField = (() => {
    const { pageId: _p, ...rest } = createNameField('');
    return rest as FieldBox;
  })();

  async function compareWithLegacy(legacy: LegacyTemplateData, rec: Recipient) {
    const before = await composeLegacyCertificatePdf(legacy, legacyField, rec, '{nombre} - UNI');

    const template = migrateLegacyTemplate(legacy)!;
    const fields = migrateLegacyFields(undefined, legacyField, template)!;
    const after = await composeCertificatePdf(template, fields, rec, '{nombre} - UNI');

    expect(after.fileName).toBe(before.fileName);
    const [oldPages, newPages] = [await readPdf(before.pdfBytes), await readPdf(after.pdfBytes)];
    expect(newPages).toHaveLength(oldPages.length);
    newPages.forEach((page, i) => {
      expect([page.width, page.height]).toEqual([oldPages[i].width, oldPages[i].height]);
      expect(page.items.length).toBe(oldPages[i].items.length);
      page.items.forEach((item, j) => {
        expect(item.str).toBe(oldPages[i].items[j].str);
        expect(item.x).toBeCloseTo(oldPages[i].items[j].x, 3);
        expect(item.y).toBeCloseTo(oldPages[i].items[j].y, 3);
      });
    });
  }

  it('una sesión antigua con imagen genera exactamente el mismo certificado', async () => {
    const page = imagePage('x', 'page1.jpg');
    await compareWithLegacy(
      { id: 'tpl_old', name: 'page1.jpg', kind: 'image', bytes: page.bytes, mimeType: 'image/jpeg', widthPt: 900, heightPt: 636, previewUrl: '' },
      recipient('JOSÉ LUIS DE LA TORRE')
    );
  });

  it('una sesión antigua con PDF de 1 página genera exactamente el mismo certificado', async () => {
    const bytes = await makeVectorPdf('Diploma');
    await compareWithLegacy(
      { id: 'tpl_old', name: 'diploma.pdf', kind: 'pdf', bytes, mimeType: 'application/pdf', widthPt: 842, heightPt: 595, previewUrl: '' },
      recipient('Ana María Pérez')
    );
  });

  it('una sesión antigua con PDF de varias páginas usa solo la primera (lo que la app ya avisaba)', async () => {
    const bytes = await makeVectorPdf('Hoja', [842, 595], { pages: 3 });
    const template = migrateLegacyTemplate({
      id: 'tpl_old', name: 'tres.pdf', kind: 'pdf', bytes, mimeType: 'application/pdf', widthPt: 842, heightPt: 595, previewUrl: '',
    })!;
    const fields = migrateLegacyFields(undefined, legacyField, template)!;
    const { pdfBytes } = await composeCertificatePdf(template, fields, recipient('Ana'));
    const pages = await readPdf(pdfBytes);
    expect(pages).toHaveLength(1);
    expect(pages[0].items.map((i) => i.str).sort()).toEqual(['Ana', 'Hoja 1']);
  });
});

describe('PDF composer - certificado de ejemplo de 3 páginas (JPG + PNG + PDF)', () => {
  it('produce un único PDF correcto', async () => {
    const template: TemplateData = {
      id: 'tpl_ejemplo',
      name: 'Certificado de ejemplo',
      pages: [
        imagePage('p1', 'page1.jpg'),
        imagePage('p2', 'page2.png'),
        await pdfPage('p3', await makeVectorPdf('Reverso · verificación', [842, 595]), 'reverso.pdf'),
      ],
    };
    const name = { ...createNameField('p1'), y: 0.5 };
    const fields: FieldBox[] = [
      name,
      { ...createTextField('p1', [name]), id: 'fecha', name: 'Fecha', y: 0.8, source: { type: 'column', column: 'fecha' } },
      { ...createTextField('p2', [name]), id: 'curso', name: 'Curso', y: 0.3, maxFontSize: 22, source: { type: 'column', column: 'curso' } },
      { ...createTextField('p3', [name]), id: 'codigo', name: 'Código', y: 0.5, source: { type: 'column', column: 'codigo' } },
    ];
    const rec = recipient('jeanpier alexander robles fabian', { curso: 'Desarrollo Web con React', fecha: '26 de octubre de 2026', codigo: 'UNI-2026-0042' });

    const { pdfBytes, fileName } = await composeCertificatePdf(template, fields, rec);
    const pages = await readPdf(pdfBytes);

    expect(fileName).toBe('Jeanpier Alexander Robles Fabian - Certificado.pdf');
    expect(new TextDecoder().decode(pdfBytes.subarray(0, 5))).toBe('%PDF-');
    expect(pages).toHaveLength(3);
    expect(pages.map((p) => [p.width, p.height])).toEqual([[900, 636], [638, 825], [842, 595]]);
    expect(pages[0].items.map((i) => i.str).sort()).toEqual(['26 de octubre de 2026', 'Jeanpier Alexander Robles Fabian']);
    expect(pages[1].items.map((i) => i.str)).toEqual(['Desarrollo Web con React']);
    expect(pages[2].items.map((i) => i.str).sort()).toEqual(['Reverso · verificación', 'UNI-2026-0042']);
    expect(await countImagesOnPage(pdfBytes, 0)).toBe(1);
    expect(await countImagesOnPage(pdfBytes, 1)).toBe(1);
    expect(await countImagesOnPage(pdfBytes, 2)).toBe(0); // vectorial

    if (process.env.WRITE_SAMPLE) {
      writeFileSync(resolve(__dirname, '..', 'samples', 'certificado-3-paginas.pdf'), pdfBytes);
    }
  });
});

describe('PDF composer - rendimiento en generación masiva', () => {
  it('genera 300 certificados de 3 páginas sin reconstruir la plantilla', async () => {
    const template: TemplateData = {
      id: 'tpl_perf',
      name: 'perf',
      pages: [imagePage('p1', 'page1.jpg'), imagePage('p2', 'page2.png'), await pdfPage('p3', await makeVectorPdf('Reverso'))],
    };
    const fields = [createNameField('p1'), { ...createTextField('p3', []), source: { type: 'column' as const, column: 'curso' } }];

    const start = performance.now();
    for (let i = 0; i < 300; i++) {
      await composeCertificatePdf(template, fields, recipient(`Persona ${i}`, { curso: 'Curso' }));
    }
    const perCertificateMs = (performance.now() - start) / 300;
    console.info(`Promedio: ${perCertificateMs.toFixed(1)} ms por certificado de 3 páginas`);
    expect(perCertificateMs).toBeLessThan(100);
  }, 60_000);
});

describe('PDF composer - fuentes estándar (respaldo y valores antiguos)', () => {
  // Valores que guardaba el selector anterior: las sesiones viejas los siguen teniendo
  const LEGACY_FONT_VALUES: Record<string, string> = {
    'Playfair Display': 'Playfair Display, Georgia, serif',
    'Times New Roman': '"Times New Roman", Times, serif',
    'Cormorant Garamond': 'Cormorant Garamond, Georgia, serif',
    'Plus Jakarta Sans': 'Plus Jakarta Sans, sans-serif',
    Montserrat: 'Montserrat, sans-serif',
    Poppins: 'Poppins, sans-serif',
    Monospace: 'monospace',
  };

  it('asigna cada valor antiguo a la familia PDF estándar correcta', async () => {
    const { getStandardFont } = await import('../src/infra/pdfComposer');
    const { StandardFonts } = await import('pdf-lib');
    const base = { ...createNameField('p'), isBold: false, isItalic: false };
    const mapped = Object.fromEntries(
      Object.entries(LEGACY_FONT_VALUES).map(([label, value]) => [label, getStandardFont({ ...base, fontFamily: value })])
    );
    expect(mapped).toEqual({
      'Playfair Display': StandardFonts.TimesRoman,
      'Times New Roman': StandardFonts.TimesRoman,
      'Cormorant Garamond': StandardFonts.TimesRoman,
      'Plus Jakarta Sans': StandardFonts.Helvetica,
      Montserrat: StandardFonts.Helvetica,
      Poppins: StandardFonts.Helvetica,
      Monospace: StandardFonts.Courier,
    });
    expect(getStandardFont({ ...base, fontFamily: 'Poppins, sans-serif', isBold: true, isItalic: true })).toBe(StandardFonts.HelveticaBoldOblique);
  });

  it('los valores antiguos se encuentran en el catálogo nuevo', async () => {
    const { findCatalogFont } = await import('../src/domain/fonts');
    const found = Object.fromEntries(Object.entries(LEGACY_FONT_VALUES).map(([label, value]) => [label, findCatalogFont(value)?.family]));
    expect(found).toEqual({
      'Playfair Display': 'Playfair Display',
      'Times New Roman': 'Times New Roman',
      'Cormorant Garamond': 'Cormorant Garamond',
      'Plus Jakarta Sans': 'Plus Jakarta Sans',
      Montserrat: 'Montserrat',
      Poppins: 'Poppins',
      Monospace: 'Courier',
    });
  });
});

describe('PDF composer - enlaces de las páginas PDF', () => {
  async function pdfWithLink(options: { rotate?: number; crop?: [number, number, number, number] } = {}) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    page.drawText('Verifica aquí', { x: 100, y: 700, size: 18, font: await doc.embedFont(StandardFonts.Helvetica) });
    const link = doc.context.register(
      doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [100, 690, 260, 720],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of('https://verificar.uni.pe/ABC123') },
      })
    );
    page.node.addAnnot(link);
    if (options.crop) page.setCropBox(...options.crop);
    if (options.rotate) page.setRotation(degrees(options.rotate));
    return doc.save();
  }

  /** Enlaces con su rectángulo en coordenadas de pantalla (lo que ve el usuario). */
  async function visibleLinks(bytes: Uint8Array, pageIndex = 0) {
    const doc = await getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const annotations = await page.getAnnotations();
    return annotations
      .filter((a) => a.subtype === 'Link')
      .map((a) => {
        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(a.rect);
        return {
          url: a.url as string,
          rect: [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)].map((n) => Math.round(n)),
        };
      });
  }

  it.each([
    ['sin rotación', {}],
    ['con /Rotate 90', { rotate: 90 }],
    ['con /Rotate 270', { rotate: 270 }],
    ['con CropBox desplazado', { crop: [50, 100, 500, 700] as [number, number, number, number] }],
  ])('conserva el enlace en la misma posición visible (%s)', async (_label, options) => {
    const source = await pdfWithLink(options);
    const out = await buildTemplateBasePdf({ id: 't', name: 't', pages: [await pdfPage('p1', source)] });
    const expected = await visibleLinks(source);
    expect(expected).toHaveLength(1);
    expect(await visibleLinks(out)).toEqual(expected);
  });

  it('el PDF combinado repite el enlace en el certificado de cada persona', async () => {
    const tpl: TemplateData = { id: 't', name: 't', pages: [await pdfPage('p1', await pdfWithLink())] };
    const combined = await composeCombinedCertificatePdf(tpl, [createNameField('p1')], [recipient('Ana'), recipient('Luis')]);
    for (const pageIndex of [0, 1]) {
      expect((await visibleLinks(combined, pageIndex)).map((l) => l.url)).toEqual(['https://verificar.uni.pe/ABC123']);
    }
  });
});

describe('PDF composer - código QR', () => {
  const urlFor = (id: string) => `https://drive.google.com/file/d/${id}/view`;

  async function fillCount(bytes: Uint8Array, pageIndex = 0): Promise<number> {
    const doc = await getDocument({ data: bytes.slice(), verbosity: 0 }).promise;
    const ops = await (await doc.getPage(pageIndex + 1)).getOperatorList();
    const { OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    return ops.fnArray.filter((fn) => fn === OPS.fill || fn === OPS.eoFill).length;
  }

  async function qrTemplate() {
    const page = await pdfPage('p1', await makeVectorPdf('Diploma'));
    return { template: { id: 't', name: 't', pages: [page] } as TemplateData, page };
  }

  it('estampa el QR como vector: fondo blanco + un rectángulo por tramo oscuro, sin imágenes', async () => {
    const { qrMatrix, qrDarkRuns } = await import('../src/infra/qr');
    const { createQrField } = await import('../src/domain/fields');
    const { template, page } = await qrTemplate();
    const fields = [createNameField('p1'), createQrField(page, [])];

    const without = (await composeCertificatePdf(template, [createNameField('p1')], recipient('Ana'))).pdfBytes;
    const withQr = (await composeCertificatePdf(template, fields, recipient('Ana'), undefined, { driveUrl: urlFor('abc') })).pdfBytes;

    const expectedRects = qrDarkRuns(qrMatrix(urlFor('abc'))).length + 1;
    expect((await fillCount(withQr)) - (await fillCount(without))).toBe(expectedRects);
    expect(await countImagesOnPage(withQr, 0)).toBe(0);
  });

  it('sin enlace a Drive el QR no se estampa (en vez de codificar un texto vacío)', async () => {
    const { createQrField } = await import('../src/domain/fields');
    const { template, page } = await qrTemplate();
    const plain = (await composeCertificatePdf(template, [createNameField('p1')], recipient('Ana'))).pdfBytes;
    const qrWithoutLink = (await composeCertificatePdf(template, [createNameField('p1'), createQrField(page, [])], recipient('Ana'))).pdfBytes;
    expect(await fillCount(qrWithoutLink)).toBe(await fillCount(plain));
  });

  it('en el PDF combinado cada persona lleva el QR de su propio archivo', async () => {
    const { qrMatrix, qrDarkRuns } = await import('../src/infra/qr');
    const { createQrField } = await import('../src/domain/fields');
    const { template, page } = await qrTemplate();
    const fields = [createNameField('p1'), createQrField(page, [])];
    const people = [recipient('Ana'), recipient('Luis')];
    const contextFor = vi.fn((rec: Recipient) => ({ driveUrl: urlFor(rec.id) }));

    const combined = await composeCombinedCertificatePdf(template, fields, people, undefined, contextFor);
    expect(contextFor.mock.calls.map(([rec]) => rec.id)).toEqual(['rec_Ana', 'rec_Luis']);

    const base = await fillCount((await composeCertificatePdf(template, [createNameField('p1')], recipient('X'))).pdfBytes);
    for (const [index, person] of people.entries()) {
      const expected = qrDarkRuns(qrMatrix(urlFor(person.id))).length + 1;
      expect((await fillCount(combined, index)) - base).toBe(expected);
    }
  });
});

describe('PDF composer - fuentes reales incrustadas', () => {
  async function onePage() {
    return { id: 't', name: 't', pages: [await pdfPage('p1', await makeVectorPdf('Fondo'))] } as TemplateData;
  }

  it('incrusta la fuente elegida (con subconjunto) y conserva tildes y ñ', async () => {
    const name = { ...createNameField('p1'), fontFamily: '"Playfair Display", serif', isBold: true };
    const { pdfBytes } = await composeCertificatePdf(await onePage(), [name], recipient('ñandú josé pérez ávila'));
    const fonts = await embeddedFontNames(pdfBytes);
    expect(fonts.some((f) => f.includes('PlayfairDisplay-Bold'))).toBe(true);
    const [page] = await readPdf(pdfBytes);
    expect(page.items.map((i) => i.str)).toContain('Ñandú José Pérez Ávila');
  });

  it('una fuente sin negrita usa su peso regular en vez de simularla', async () => {
    const loader = vi.fn(fixtureFontLoader);
    setFontBytesLoader(loader);
    try {
      const name = { ...createNameField('p1'), fontFamily: '"Great Vibes", cursive', isBold: true, isItalic: true };
      const { pdfBytes } = await composeCertificatePdf(await onePage(), [name], recipient('Ana'));
      expect(loader).toHaveBeenCalledWith(expect.objectContaining({ id: 'great-vibes' }), { weight: 400, italic: false });
      expect((await embeddedFontNames(pdfBytes)).some((f) => f.includes('GreatVibes-Regular'))).toBe(true);
    } finally {
      setFontBytesLoader(fixtureFontLoader);
    }
  });

  it('si no se puede descargar la fuente, usa la estándar equivalente y el certificado igual se genera', async () => {
    setFontBytesLoader(async () => {
      throw new Error('sin conexión');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const name = { ...createNameField('p1'), fontFamily: '"Playfair Display", serif', isBold: true };
      const { pdfBytes } = await composeCertificatePdf(await onePage(), [name], recipient('Ana'));
      // (Helvetica-Bold es la del PDF de fondo de la prueba)
      const fonts = await embeddedFontNames(pdfBytes);
      expect(fonts).toContain('Times-Bold');
      expect(fonts.some((f) => f.includes('Playfair'))).toBe(false);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      setFontBytesLoader(fixtureFontLoader);
    }
  });

  it('en el PDF combinado cada variante de fuente se incrusta una sola vez', async () => {
    const name = { ...createNameField('p1'), fontFamily: '"Playfair Display", serif', isBold: true };
    const people = ['Ana', 'Luis', 'Marta', 'Jorge'].map((n) => recipient(n));
    const combined = await composeCombinedCertificatePdf(await onePage(), [name], people);
    const fonts = await embeddedFontNames(combined);
    expect(fonts.filter((f) => f.includes('PlayfairDisplay-Bold'))).toHaveLength(1);
  });

  it('mantiene los certificados livianos gracias al subconjunto de glifos', async () => {
    const name = { ...createNameField('p1'), fontFamily: '"Great Vibes", cursive', isBold: false };
    const { pdfBytes } = await composeCertificatePdf(await onePage(), [name], recipient('Ana Pérez'));
    // El archivo completo de la fuente pesa ~90 KB; con subconjunto el PDF entero queda muy por debajo
    expect(pdfBytes.length).toBeLessThan(40_000);
  });
});
