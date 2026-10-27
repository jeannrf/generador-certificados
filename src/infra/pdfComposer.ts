import {
  PDFDocument,
  rgb,
  StandardFonts,
  PDFPage,
  PDFFont,
  degrees,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  drawObject,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFObjectCopier,
} from 'pdf-lib';
import { FieldBox, TemplateData, TemplatePage, Recipient } from '../domain/types';
import { transformTextCase } from '../domain/normalization';
import { normalizedToPdfCoords, calculateOptimalFontSize } from '../domain/layout';
import { formatCertificateFileName } from '../domain/validation';
import {
  assertTemplateIsValid,
  detectFileFormat,
  exifImageMatrix,
  readImageInfo,
  ImageRotation,
  TemplateFileError,
} from '../domain/templatePages';
import {
  applyRecipientOverrides,
  FieldContext,
  getNameField,
  isNameField,
  isQrField,
  pageIdsInOrder,
  resolveFieldText,
} from '../domain/fields';
import { qrDarkRuns, qrMatrix, QR_QUIET_ZONE } from './qr';
import { findCatalogFont, resolveFontVariant } from '../domain/fonts';
import { createFontBytesLoader, FontBytesLoader } from './fontLoader';

// Descarga las fuentes de Google a demanda. Los tests lo reemplazan para no depender de la red.
let fontBytesLoader: FontBytesLoader | null = createFontBytesLoader();

/** Cambia de dónde se obtienen las fuentes; `null` usa solo las fuentes estándar de PDF. */
export function setFontBytesLoader(loader: FontBytesLoader | null): void {
  fontBytesLoader = loader;
}

/**
 * Convierte color hex (#RRGGBB) a valores rgb de pdf-lib (0-1)
 */
function hexToPdfRgb(hex: string) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
}

/**
 * Fuente estándar de PDF equivalente al campo. Se usa para Times/Courier y como respaldo
 * si no se puede descargar la fuente real.
 */
export function getStandardFont(field: FieldBox): StandardFonts {
  // Se compara cada familia completa: "sans-serif" contiene "serif" pero es sin serifa
  const families = field.fontFamily
    .split(',')
    .map((name) => name.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
  const isMono = families.some((name) => name === 'monospace' || name.includes('mono') || name.includes('courier'));
  const isSerif =
    !isMono &&
    families.some(
      (name) =>
        name === 'serif' || ['times', 'georgia', 'playfair', 'cormorant', 'garamond'].some((serif) => name.includes(serif))
    );
  const isBold = field.isBold ?? true;
  const isItalic = field.isItalic ?? false;

  if (isSerif) {
    if (isBold && isItalic) return StandardFonts.TimesRomanBoldItalic;
    if (isBold) return StandardFonts.TimesRomanBold;
    if (isItalic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (isMono) {
    if (isBold && isItalic) return StandardFonts.CourierBoldOblique;
    if (isBold) return StandardFonts.CourierBold;
    if (isItalic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique;
  if (isBold) return StandardFonts.HelveticaBold;
  if (isItalic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

/**
 * Estampa un texto en la página según el FieldBox
 */
function drawFieldText(
  page: PDFPage,
  field: FieldBox,
  font: PDFFont,
  text: string
): string {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const transformedText = transformTextCase(text, field.textCase);
  const coords = normalizedToPdfCoords(field, pageWidth, pageHeight);

  // Autoajuste exacto usando las métricas reales de la fuente PDF
  const targetWidthPt = Math.max(10, coords.widthPt - 8);
  const optimal = calculateOptimalFontSize(
    transformedText,
    field.maxFontSize,
    field.minFontSize || 14,
    targetWidthPt,
    (txt, sz) => font.widthOfTextAtSize(txt, sz)
  );
  const fontSize = optimal.fontSize;

  const textWidth = font.widthOfTextAtSize(transformedText, fontSize);
  const textHeight = font.heightAtSize(fontSize);

  // Posicionamiento horizontal
  let drawX = coords.xPt;
  if (field.align === 'center') {
    drawX = coords.xPt + (coords.widthPt - textWidth) / 2;
  } else if (field.align === 'right') {
    drawX = coords.xPt + (coords.widthPt - textWidth);
  }

  // Posicionamiento vertical dentro de la caja
  let drawY = coords.yPt;
  if (field.vAlign === 'middle') {
    drawY = coords.yPt + (coords.heightPt - textHeight) / 2;
  } else if (field.vAlign === 'top') {
    drawY = coords.yPt + coords.heightPt - textHeight;
  }

  const textColor = hexToPdfRgb(field.color);

  page.drawText(transformedText, {
    x: Math.max(0, drawX),
    y: Math.max(0, drawY),
    size: fontSize,
    font,
    color: textColor,
  });

  return transformedText;
}

/**
 * Dibuja un código QR vectorial: el cuadrado más grande que cabe en la caja, alineado según el campo,
 * con fondo blanco y margen para que se pueda leer sobre cualquier diseño.
 */
function drawFieldQr(page: PDFPage, field: FieldBox, content: string): void {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const coords = normalizedToPdfCoords(field, pageWidth, pageHeight);
  const side = Math.min(coords.widthPt, coords.heightPt);

  let x = coords.xPt;
  if (field.align === 'center') x += (coords.widthPt - side) / 2;
  else if (field.align === 'right') x += coords.widthPt - side;
  let y = coords.yPt;
  if (field.vAlign === 'middle') y += (coords.heightPt - side) / 2;
  else if (field.vAlign === 'top') y += coords.heightPt - side;

  const matrix = qrMatrix(content);
  const moduleSize = side / (matrix.size + QR_QUIET_ZONE * 2);
  const color = hexToPdfRgb(field.color);

  page.drawRectangle({ x, y, width: side, height: side, color: rgb(1, 1, 1) });
  for (const [row, col, length] of qrDarkRuns(matrix)) {
    page.drawRectangle({
      x: x + (QR_QUIET_ZONE + col) * moduleSize,
      // Las filas del QR van de arriba hacia abajo; en PDF el eje Y crece hacia arriba
      y: y + side - (QR_QUIET_ZONE + row + 1) * moduleSize,
      width: length * moduleSize,
      height: moduleSize,
      color,
    });
  }
}

/**
 * Posición y giro para dibujar un contenido de w×h (sin rotar) de forma que quede
 * rotado `rotation` grados en sentido horario sobre una página que empieza en (0,0).
 * pdf-lib rota en sentido antihorario alrededor del punto (x, y).
 */
function rotatedPlacement(rotation: ImageRotation, w: number, h: number) {
  switch (rotation) {
    case 90:
      return { x: 0, y: w, rotate: degrees(-90) };
    case 180:
      return { x: w, y: h, rotate: degrees(180) };
    case 270:
      return { x: h, y: 0, rotate: degrees(90) };
    default:
      return { x: 0, y: 0, rotate: degrees(0) };
  }
}

type PointMapper = (x: number, y: number) => [number, number];

/**
 * Copia los enlaces web (anotaciones Link con acción URI) de una página a otra, recalculando
 * su rectángulo con `mapPoint`. Al incrustar una página como XObject sus anotaciones se pierden,
 * por eso se vuelven a agregar. Los demás tipos (formularios, comentarios, enlaces internos) se omiten.
 */
function copyLinkAnnotations(
  source: PDFDocument,
  sourcePage: PDFPage,
  target: PDFDocument,
  targetPage: PDFPage,
  mapPoint: PointMapper
): void {
  const annots = sourcePage.node.Annots();
  if (!annots) return;
  const copier = PDFObjectCopier.for(source.context, target.context);

  for (let i = 0; i < annots.size(); i++) {
    const annot = annots.lookupMaybe(i, PDFDict);
    if (!annot || annot.get(PDFName.of('Subtype')) !== PDFName.of('Link')) continue;
    const action = annot.lookupMaybe(PDFName.of('A'), PDFDict);
    if (!action || action.get(PDFName.of('S')) !== PDFName.of('URI')) continue;
    const rect = annot.lookupMaybe(PDFName.of('Rect'), PDFArray);
    if (!rect || rect.size() !== 4) continue;

    const [x1, y1, x2, y2] = [0, 1, 2, 3].map((j) => rect.lookup(j, PDFNumber).asNumber());
    // Sin /P (apunta a la página de origen y arrastraría el documento entero) ni /QuadPoints (quedarían desplazados)
    const clone = annot.clone();
    clone.delete(PDFName.of('P'));
    clone.delete(PDFName.of('QuadPoints'));
    const copied = copier.copy(clone);

    const [ax, ay] = mapPoint(x1, y1);
    const [bx, by] = mapPoint(x2, y2);
    copied.set(
      PDFName.of('Rect'),
      target.context.obj([Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)])
    );
    targetPage.node.addAnnot(target.context.register(copied));
  }
}

function normalizeRotation(angle: number): ImageRotation {
  const normalized = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
  return normalized as ImageRotation;
}

/**
 * Agrega al documento una página PDF de la plantilla, conservándola vectorial.
 * Se incrusta como Form XObject para aplicar el CropBox y el /Rotate originales:
 * la página resultante empieza en (0,0), no tiene rotación y mide lo que se ve en pantalla.
 */
async function appendPdfTemplatePage(doc: PDFDocument, page: TemplatePage): Promise<void> {
  let source: PDFDocument;
  try {
    source = await PDFDocument.load(page.bytes);
  } catch (err) {
    const encrypted = err instanceof Error && err.message.toLowerCase().includes('encrypt');
    throw new TemplateFileError(
      encrypted ? 'ENCRYPTED_PDF' : 'CORRUPT_FILE',
      encrypted
        ? `La página "${page.sourceName}" está protegida con contraseña.`
        : `La página "${page.sourceName}" está dañada y no se puede leer.`
    );
  }
  if (source.getPageCount() === 0) {
    throw new TemplateFileError('EMPTY_PDF', `La página "${page.sourceName}" no contiene páginas.`);
  }

  const sourcePage = source.getPage(0);
  const crop = sourcePage.getCropBox();
  const embedded = await doc.embedPage(sourcePage, {
    left: crop.x,
    bottom: crop.y,
    right: crop.x + crop.width,
    top: crop.y + crop.height,
  });

  const rotation = normalizeRotation(sourcePage.getRotation().angle);
  const swap = rotation === 90 || rotation === 270;
  const target = doc.addPage(swap ? [crop.height, crop.width] : [crop.width, crop.height]);
  const placement = rotatedPlacement(rotation, crop.width, crop.height);
  target.drawPage(embedded, {
    ...placement,
    width: crop.width,
    height: crop.height,
  });

  // Misma transformación que el contenido: quitar el origen del CropBox y girar alrededor del punto de anclaje
  const radians = (placement.rotate.angle * Math.PI) / 180;
  const cos = Math.round(Math.cos(radians));
  const sin = Math.round(Math.sin(radians));
  copyLinkAnnotations(source, sourcePage, doc, target, (x, y) => {
    const localX = x - crop.x;
    const localY = y - crop.y;
    return [placement.x + localX * cos - localY * sin, placement.y + localX * sin + localY * cos];
  });
}

/**
 * Agrega una página de imagen sin recomprimirla: la imagen original ocupa toda la página,
 * con el tamaño en pt calculado al subirla (px × 0,75), respetando la orientación EXIF (rotada o espejada).
 */
async function appendImageTemplatePage(doc: PDFDocument, page: TemplatePage): Promise<void> {
  const format = detectFileFormat(page.bytes);
  if (format !== 'png' && format !== 'jpeg') {
    throw new TemplateFileError('CORRUPT_FILE', `La página "${page.sourceName}" no es una imagen PNG/JPG válida.`);
  }
  const { orientation, rotation } = readImageInfo(page.bytes, format, page.sourceName);

  let image;
  try {
    image = format === 'png' ? await doc.embedPng(page.bytes) : await doc.embedJpg(page.bytes);
  } catch {
    throw new TemplateFileError('CORRUPT_FILE', `La imagen "${page.sourceName}" está dañada y no se puede leer.`);
  }

  const target = doc.addPage([page.widthPt, page.heightPt]);
  if (orientation === 1) {
    target.drawImage(image, { x: 0, y: 0, width: page.widthPt, height: page.heightPt });
    return;
  }
  // Las orientaciones espejadas no se pueden expresar con drawImage: se aplica la matriz directamente
  const swap = rotation === 90 || rotation === 270;
  const encodedWidth = swap ? page.heightPt : page.widthPt;
  const encodedHeight = swap ? page.widthPt : page.heightPt;
  const xObject = target.node.newXObject('Image', image.ref);
  target.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(...exifImageMatrix(orientation, encodedWidth, encodedHeight)),
    drawObject(xObject),
    popGraphicsState()
  );
}

/**
 * Arma el PDF base de la plantilla: todas sus páginas, en orden, sin ningún texto estampado.
 */
export async function buildTemplateBasePdf(template: TemplateData): Promise<Uint8Array> {
  assertTemplateIsValid(template);
  const doc = await PDFDocument.create();
  for (const page of template.pages) {
    if (page.kind === 'pdf') {
      await appendPdfTemplatePage(doc, page);
    } else {
      await appendImageTemplatePage(doc, page);
    }
  }
  return doc.save();
}

// El PDF base se arma una sola vez por plantilla y se reutiliza para cada persona del lote.
// Cualquier edición de la plantilla crea un objeto nuevo, por lo que la caché se invalida sola.
const basePdfCache = new WeakMap<TemplateData, Promise<Uint8Array>>();

function getTemplateBasePdf(template: TemplateData): Promise<Uint8Array> {
  let cached = basePdfCache.get(template);
  if (!cached) {
    cached = buildTemplateBasePdf(template);
    // Si falla, no dejar la promesa rechazada en caché para permitir reintentos
    cached.catch(() => basePdfCache.delete(template));
    basePdfCache.set(template, cached);
  }
  return cached;
}

/**
 * Incrusta cada fuente (y cada variante) una sola vez por documento. Las fuentes de Google se
 * incrustan con subconjunto: solo los glifos usados, así el PDF pesa poco.
 */
function createFontCache(doc: PDFDocument) {
  const fonts = new Map<string, Promise<PDFFont>>();
  let fontkitReady: Promise<void> | null = null;

  const cached = (key: string, create: () => Promise<PDFFont>) => {
    let font = fonts.get(key);
    if (!font) {
      font = create();
      fonts.set(key, font);
    }
    return font;
  };
  const embedStandard = (field: FieldBox) => {
    const standard = getStandardFont(field);
    return cached(`standard:${standard}`, () => doc.embedFont(standard));
  };

  return (field: FieldBox): Promise<PDFFont> => {
    const font = findCatalogFont(field.fontFamily);
    const loader = fontBytesLoader;
    if (!font || font.source === 'standard' || !loader) return embedStandard(field);

    const variant = resolveFontVariant(font, field.isBold ?? false, field.isItalic ?? false);
    return cached(`${font.id}:${variant.weight}:${variant.italic ? 'italic' : 'normal'}`, async () => {
      try {
        const bytes = await loader(font, variant);
        fontkitReady ??= import('@pdf-lib/fontkit').then((module) => doc.registerFontkit(module.default));
        await fontkitReady;
        return await doc.embedFont(bytes, { subset: true });
      } catch (err) {
        console.warn(`No se pudo usar la fuente ${font.family}; se usará una fuente estándar.`, err);
        return embedStandard(field);
      }
    });
  };
}

/**
 * Estampa todos los campos de una persona en sus páginas. Devuelve el nombre ya transformado.
 */
async function stampRecipientFields(
  pages: PDFPage[],
  pageIds: string[],
  fields: FieldBox[],
  recipient: Recipient,
  getFont: (field: FieldBox) => Promise<PDFFont>,
  context: FieldContext
): Promise<string | undefined> {
  let stampedName: string | undefined;
  for (const baseField of fields) {
    const pageIndex = pageIds.indexOf(baseField.pageId);
    if (pageIndex === -1) continue;
    const field = applyRecipientOverrides(baseField, recipient);
    const text = resolveFieldText(field, recipient, context);
    if (!text.trim()) continue;
    if (isQrField(field)) {
      drawFieldQr(pages[pageIndex], field, text);
      continue;
    }
    const drawn = drawFieldText(pages[pageIndex], field, await getFont(field), text);
    if (isNameField(field)) stampedName = drawn;
  }
  return stampedName;
}

/**
 * Genera un PDF individual para un destinatario: todas las páginas de la plantilla con sus campos.
 */
export async function composeCertificatePdf(
  template: TemplateData,
  fields: FieldBox[],
  recipient: Recipient,
  fileNamePattern?: string,
  context: FieldContext = {}
): Promise<{ fileName: string; pdfBytes: Uint8Array }> {
  const baseBytes = await getTemplateBasePdf(template);
  const pdfDoc = await PDFDocument.load(baseBytes);

  const stampedName = await stampRecipientFields(
    pdfDoc.getPages(),
    pageIdsInOrder(template),
    fields,
    recipient,
    createFontCache(pdfDoc),
    context
  );

  const pdfBytes = await pdfDoc.save();
  const nameField = getNameField(fields);
  const fileName = formatCertificateFileName(
    fileNamePattern || '{nombre} - Certificado',
    stampedName ?? transformTextCase(recipient.name, nameField?.textCase ?? 'original'),
    recipient.extra
  );

  return {
    fileName,
    pdfBytes,
  };
}

/**
 * Genera un ÚNICO archivo PDF que consolida todos los certificados juntos (ideal para imprenta).
 * Cada página de la plantilla se incrusta una sola vez y se reutiliza para todas las personas,
 * así el archivo no crece con cada certificado.
 */
export async function composeCombinedCertificatePdf(
  template: TemplateData,
  fields: FieldBox[],
  recipients: Recipient[],
  onProgress?: (current: number, total: number) => void,
  contextFor: (recipient: Recipient) => FieldContext = () => ({})
): Promise<Uint8Array> {
  const baseDoc = await PDFDocument.load(await getTemplateBasePdf(template));
  const combinedDoc = await PDFDocument.create();
  const embeddedPages = await combinedDoc.embedPdf(
    baseDoc,
    template.pages.map((_, index) => index)
  );
  const pageIds = pageIdsInOrder(template);
  const getFont = createFontCache(combinedDoc);

  for (let i = 0; i < recipients.length; i++) {
    const pages = embeddedPages.map((embedded, pageIndex) => {
      const page = combinedDoc.addPage([embedded.width, embedded.height]);
      page.drawPage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
      // Las páginas base ya están normalizadas: los enlaces conservan sus coordenadas
      copyLinkAnnotations(baseDoc, baseDoc.getPage(pageIndex), combinedDoc, page, (x, y) => [x, y]);
      return page;
    });
    await stampRecipientFields(pages, pageIds, fields, recipients[i], getFont, contextFor(recipients[i]));

    if (onProgress) onProgress(i + 1, recipients.length);
  }

  return await combinedDoc.save();
}
