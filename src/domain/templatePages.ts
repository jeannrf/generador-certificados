import { FieldBox, TemplateData, TemplatePage } from './types';

/**
 * Reglas de las plantillas multipágina. Funciones puras: se usan al subir archivos (UI)
 * y otra vez al generar los PDFs (segunda barrera).
 */

export const MAX_TEMPLATE_PAGES = 5;
export const MAX_FILE_MB = 15;
export const MAX_TEMPLATE_MB = 40;
export const MAX_IMAGE_SIDE_PX = 8000;
export const MAX_IMAGE_MEGAPIXELS = 25;

/** Conversión de píxeles a puntos PDF a 96 DPI (1 px = 0,75 pt) */
export const PX_TO_PT = 0.75;

export type TemplateFileFormat = 'pdf' | 'png' | 'jpeg';

export type TemplateErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'CORRUPT_FILE'
  | 'ENCRYPTED_PDF'
  | 'EMPTY_PDF'
  | 'TOO_MANY_PAGES'
  | 'FILE_TOO_LARGE'
  | 'TEMPLATE_TOO_LARGE'
  | 'IMAGE_TOO_LARGE'
  | 'NO_PAGES';

export class TemplateFileError extends Error {
  constructor(public readonly code: TemplateErrorCode, message: string) {
    super(message);
    this.name = 'TemplateFileError';
  }
}

const MB = 1024 * 1024;

/**
 * Detecta el formato real por su firma (magic bytes), sin confiar en la extensión ni en el MIME.
 */
export function detectFileFormat(bytes: Uint8Array): TemplateFileFormat | null {
  if (bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return 'png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  // La especificación permite basura antes de %PDF- dentro del primer KB
  const head = bytes.subarray(0, Math.min(bytes.length, 1024));
  for (let i = 0; i + 4 < head.length; i++) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46 && head[i + 4] === 0x2d) {
      return 'pdf';
    }
  }
  return null;
}

export function mimeTypeForFormat(format: TemplateFileFormat): string {
  if (format === 'pdf') return 'application/pdf';
  return format === 'png' ? 'image/png' : 'image/jpeg';
}

export function assertSupportedFile(bytes: Uint8Array, fileName: string): TemplateFileFormat {
  if (bytes.length > MAX_FILE_MB * MB) {
    throw new TemplateFileError(
      'FILE_TOO_LARGE',
      `"${fileName}" pesa ${(bytes.length / MB).toFixed(1)} MB. El máximo por archivo es ${MAX_FILE_MB} MB.`
    );
  }
  const format = detectFileFormat(bytes);
  if (!format) {
    throw new TemplateFileError(
      'UNSUPPORTED_FORMAT',
      `"${fileName}" no es un PDF, PNG ni JPG válido. Si cambiaste la extensión a mano, expórtalo de nuevo desde tu editor.`
    );
  }
  return format;
}

export type ImageRotation = 0 | 90 | 180 | 270;

export interface ImageInfo {
  widthPx: number; // tal como está codificada (sin aplicar EXIF)
  heightPx: number;
  /** Orientación EXIF 1-8 (solo JPEG; 1 = normal) */
  orientation: number;
  /** Rotación horaria implícita en la orientación (90/270 intercambian ancho y alto) */
  rotation: ImageRotation;
}

function readUint16(bytes: Uint8Array, offset: number, littleEndian = false): number {
  return littleEndian
    ? bytes[offset] | (bytes[offset + 1] << 8)
    : (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes: Uint8Array, offset: number, littleEndian = false): number {
  return littleEndian
    ? (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
    : ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

const EXIF_ROTATION: Record<number, ImageRotation> = { 1: 0, 2: 0, 3: 180, 4: 180, 5: 90, 6: 90, 7: 270, 8: 270 };

function readExifOrientation(bytes: Uint8Array, start: number, length: number): number {
  // "Exif\0\0" + cabecera TIFF
  if (length < 14 || bytes[start] !== 0x45 || bytes[start + 1] !== 0x78 || bytes[start + 2] !== 0x69 || bytes[start + 3] !== 0x66) {
    return 1;
  }
  const tiff = start + 6;
  const le = bytes[tiff] === 0x49; // 'II' = little endian, 'MM' = big endian
  const ifd = tiff + readUint32(bytes, tiff + 4, le);
  const end = start + length;
  if (ifd + 2 > end) return 1;
  const entries = readUint16(bytes, ifd, le);
  for (let i = 0; i < entries; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end) break;
    if (readUint16(bytes, entry, le) === 0x0112) {
      const orientation = readUint16(bytes, entry + 8, le);
      return orientation >= 1 && orientation <= 8 ? orientation : 1;
    }
  }
  return 1;
}

function readJpegInfo(bytes: Uint8Array): ImageInfo | null {
  let offset = 2;
  let orientation = 1;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xff) {
      offset++; // relleno entre marcadores
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // fin de imagen o datos sin haber visto SOF
    const segmentLength = readUint16(bytes, offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) return null;
    if (marker === 0xe1) {
      orientation = readExifOrientation(bytes, offset + 4, segmentLength - 2);
    }
    // SOF0..SOF15 salvo DHT (C4), JPG (C8) y DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const heightPx = readUint16(bytes, offset + 5);
      const widthPx = readUint16(bytes, offset + 7);
      return widthPx > 0 && heightPx > 0
        ? { widthPx, heightPx, orientation, rotation: EXIF_ROTATION[orientation] }
        : null;
    }
    offset += 2 + segmentLength;
  }
  return null;
}

let crcTable: Uint32Array | null = null;

function crc32(bytes: Uint8Array, start: number, end: number): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Recorre todos los chunks del PNG verificando longitud y CRC, y exige IDAT e IEND.
 * Es necesario porque el decodificador PNG de pdf-lib puede quedarse colgado con archivos truncados.
 */
function hasValidPngStructure(bytes: Uint8Array): boolean {
  let offset = 8;
  let sawImageData = false;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const dataEnd = offset + 8 + length;
    if (dataEnd + 4 > bytes.length) return false;
    if (crc32(bytes, offset + 4, dataEnd) !== readUint32(bytes, dataEnd)) return false;
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    if (type === 'IDAT') sawImageData = true;
    if (type === 'IEND') return sawImageData;
    offset = dataEnd + 4;
  }
  return false;
}

function readPngInfo(bytes: Uint8Array): ImageInfo | null {
  // La firma ocupa 8 bytes y el primer chunk debe ser IHDR
  if (bytes.length < 24 || String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== 'IHDR') {
    return null;
  }
  const widthPx = readUint32(bytes, 16);
  const heightPx = readUint32(bytes, 20);
  return widthPx > 0 && heightPx > 0 ? { widthPx, heightPx, orientation: 1, rotation: 0 } : null;
}

/** Un JPEG completo termina con el marcador EOI (FFD9); se tolera relleno de hasta 1 KB después. */
function hasJpegEnd(bytes: Uint8Array): boolean {
  for (let i = bytes.length - 2; i >= Math.max(2, bytes.length - 1024); i--) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) return true;
  }
  return false;
}

/**
 * Lee las dimensiones de la cabecera de la imagen y valida los límites de tamaño.
 */
export function readImageInfo(bytes: Uint8Array, format: 'png' | 'jpeg', fileName: string): ImageInfo {
  const info = format === 'png' ? readPngInfo(bytes) : readJpegInfo(bytes);
  const complete = format === 'png' ? hasValidPngStructure(bytes) : hasJpegEnd(bytes);
  if (!info || !complete) {
    throw new TemplateFileError('CORRUPT_FILE', `"${fileName}" está dañado o incompleto y no se puede leer.`);
  }
  const megapixels = (info.widthPx * info.heightPx) / 1_000_000;
  if (info.widthPx > MAX_IMAGE_SIDE_PX || info.heightPx > MAX_IMAGE_SIDE_PX || megapixels > MAX_IMAGE_MEGAPIXELS) {
    throw new TemplateFileError(
      'IMAGE_TOO_LARGE',
      `"${fileName}" mide ${info.widthPx}×${info.heightPx} px (${megapixels.toFixed(1)} MP). ` +
        `El máximo es ${MAX_IMAGE_SIDE_PX} px por lado y ${MAX_IMAGE_MEGAPIXELS} MP; redúcela o expórtala como PDF.`
    );
  }
  return info;
}

/**
 * Matriz PDF [a b c d e f] que dibuja la imagen (espacio unitario, origen abajo-izquierda) sobre
 * una página que empieza en (0,0), aplicando la orientación EXIF, incluidas las espejadas.
 * `w` y `h` son el ancho y alto en pt de la imagen TAL COMO ESTÁ CODIFICADA.
 */
export function exifImageMatrix(orientation: number, w: number, h: number): [number, number, number, number, number, number] {
  switch (orientation) {
    case 2: return [-w, 0, 0, h, w, 0]; // espejo horizontal
    case 3: return [-w, 0, 0, -h, w, h]; // 180°
    case 4: return [w, 0, 0, -h, 0, h]; // espejo vertical
    case 5: return [0, -w, -h, 0, h, w]; // transpuesta
    case 6: return [0, -w, h, 0, 0, w]; // 90° horario
    case 7: return [0, w, h, 0, 0, 0]; // transversa
    case 8: return [0, w, -h, 0, h, 0]; // 270° horario
    default: return [w, 0, 0, h, 0, 0];
  }
}

/** Dimensiones visibles de la página (pt) para una imagen, aplicando la orientación EXIF. */
export function imagePageSizePt(info: ImageInfo): { widthPt: number; heightPt: number } {
  const swap = info.rotation === 90 || info.rotation === 270;
  const w = swap ? info.heightPx : info.widthPx;
  const h = swap ? info.widthPx : info.heightPx;
  return { widthPt: Math.round(w * PX_TO_PT), heightPt: Math.round(h * PX_TO_PT) };
}

/**
 * Comprueba si caben `incomingCount` páginas nuevas. `replacing` descuenta la página que se sustituye.
 */
export function assertCanAddPages(currentCount: number, incomingCount: number, fileName: string, replacing = false): void {
  const resulting = currentCount - (replacing ? 1 : 0) + incomingCount;
  if (resulting <= MAX_TEMPLATE_PAGES) return;

  const available = Math.max(0, MAX_TEMPLATE_PAGES - currentCount + (replacing ? 1 : 0));
  const pagesLabel = incomingCount === 1 ? '1 página' : `${incomingCount} páginas`;
  const availableLabel = available === 0
    ? 'ya no queda espacio'
    : `solo ${available === 1 ? 'queda 1 lugar' : `quedan ${available} lugares`}`;
  throw new TemplateFileError(
    'TOO_MANY_PAGES',
    `"${fileName}" aporta ${pagesLabel} y ${availableLabel}. Una plantilla admite como máximo ${MAX_TEMPLATE_PAGES} páginas.`
  );
}

export function totalTemplateBytes(pages: Pick<TemplatePage, 'bytes'>[]): number {
  return pages.reduce((sum, p) => sum + p.bytes.length, 0);
}

export function assertTemplateSize(pages: Pick<TemplatePage, 'bytes'>[]): void {
  const total = totalTemplateBytes(pages);
  if (total > MAX_TEMPLATE_MB * MB) {
    throw new TemplateFileError(
      'TEMPLATE_TOO_LARGE',
      `La plantilla sumaría ${(total / MB).toFixed(1)} MB. El máximo total es ${MAX_TEMPLATE_MB} MB.`
    );
  }
}

/**
 * Validación completa de una plantilla ya armada. La usa el generador antes de componer.
 */
export function assertTemplateIsValid(template: TemplateData): void {
  if (!template.pages || template.pages.length === 0) {
    throw new TemplateFileError('NO_PAGES', 'La plantilla no tiene páginas.');
  }
  if (template.pages.length > MAX_TEMPLATE_PAGES) {
    throw new TemplateFileError(
      'TOO_MANY_PAGES',
      `La plantilla tiene ${template.pages.length} páginas y el máximo es ${MAX_TEMPLATE_PAGES}.`
    );
  }
  assertTemplateSize(template.pages);
  for (const page of template.pages) {
    const format = detectFileFormat(page.bytes);
    const expected = page.kind === 'pdf' ? format === 'pdf' : format === 'png' || format === 'jpeg';
    if (!expected) {
      throw new TemplateFileError('CORRUPT_FILE', `La página "${page.sourceName}" está dañada o no coincide con su formato.`);
    }
  }
}

// --- Operaciones de edición (inmutables) ---

export function movePage(pages: TemplatePage[], fromIndex: number, toIndex: number): TemplatePage[] {
  if (fromIndex === toIndex || toIndex < 0 || toIndex >= pages.length || fromIndex < 0 || fromIndex >= pages.length) {
    return pages;
  }
  const next = [...pages];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Sustituye una página por una o varias nuevas en la misma posición.
 * La primera página nueva hereda el id, así los campos colocados en ella se conservan.
 */
export function replacePage(pages: TemplatePage[], pageId: string, replacements: TemplatePage[]): TemplatePage[] {
  const index = pages.findIndex((p) => p.id === pageId);
  if (index === -1 || replacements.length === 0) return pages;
  const [first, ...rest] = replacements;
  return [...pages.slice(0, index), { ...first, id: pageId }, ...rest, ...pages.slice(index + 1)];
}

export function removePage(pages: TemplatePage[], pageId: string): TemplatePage[] {
  return pages.filter((p) => p.id !== pageId);
}

export function pageIndexById(template: TemplateData, pageId: string): number {
  return template.pages.findIndex((p) => p.id === pageId);
}

export function getPageForField(template: TemplateData, field: Pick<FieldBox, 'pageId'>): TemplatePage {
  return template.pages.find((p) => p.id === field.pageId) ?? template.pages[0];
}

// --- Migración de sesiones guardadas con el formato de una sola página ---

interface LegacyTemplate {
  id: string;
  name: string;
  kind: 'pdf' | 'image';
  bytes: Uint8Array;
  mimeType: string;
  widthPt: number;
  heightPt: number;
  previewUrl?: string;
}

function isLegacyTemplate(value: unknown): value is LegacyTemplate {
  return typeof value === 'object' && value !== null && !('pages' in value) && 'bytes' in value && 'kind' in value;
}

/**
 * Convierte una plantilla del formato antiguo (un solo archivo) a una plantilla de 1 página.
 * Es idempotente: si ya tiene `pages`, la devuelve tal cual.
 * Si el PDF antiguo tenía varias páginas, solo se usa la primera (lo que la app ya avisaba).
 */
export function migrateLegacyTemplate(value: unknown): TemplateData | null {
  if (!value || typeof value !== 'object') return null;
  if (!isLegacyTemplate(value)) {
    const tpl = value as TemplateData;
    return Array.isArray(tpl.pages) && tpl.pages.length > 0 ? tpl : null;
  }
  return {
    id: value.id,
    name: value.name,
    pages: [
      {
        id: `${value.id}_p1`,
        sourceName: value.name,
        kind: value.kind,
        bytes: value.bytes,
        mimeType: value.mimeType,
        widthPt: value.widthPt,
        heightPt: value.heightPt,
        previewUrl: value.previewUrl ?? '',
      },
    ],
  };
}

/**
 * Convierte el campo único antiguo (`field`) en la lista `fields`, asignándolo a la primera página.
 */
export function migrateLegacyFields(
  savedFields: unknown,
  savedField: unknown,
  template: TemplateData | null
): FieldBox[] | null {
  if (Array.isArray(savedFields)) return savedFields as FieldBox[];
  if (!savedField || typeof savedField !== 'object') return null;
  const firstPageId = template?.pages[0]?.id ?? '';
  const legacy = savedField as FieldBox;
  return [{ ...legacy, pageId: legacy.pageId || firstPageId }];
}
