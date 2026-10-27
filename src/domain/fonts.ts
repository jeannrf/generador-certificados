import { FieldBox } from './types';
import { GOOGLE_FONTS } from './fontCatalog';

export type FontCategory = 'serif' | 'sans' | 'script' | 'display' | 'mono';

export interface CatalogFont {
  family: string;
  /** Identificador de Fontsource (para descargar el archivo) */
  id: string;
  category: FontCategory;
  weights: number[];
  italic: boolean;
  /**
   * 'standard': fuente básica de PDF que no se descarga (Times, Courier).
   * Por defecto es una fuente de Google que se incrusta en el PDF.
   */
  source?: 'google' | 'standard';
}

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  serif: 'Serif',
  sans: 'Sans serif',
  script: 'Manuscrita',
  display: 'Decorativa',
  mono: 'Monoespaciada',
};

const GENERIC_FAMILY: Record<FontCategory, string> = {
  serif: 'serif',
  sans: 'sans-serif',
  script: 'cursive',
  display: 'sans-serif',
  mono: 'monospace',
};

/** Fuentes básicas de PDF: se mantienen para las plantillas que ya las usaban. */
const STANDARD_FONTS: CatalogFont[] = [
  { family: 'Times New Roman', id: 'times', category: 'serif', weights: [400, 700], italic: true, source: 'standard' },
  { family: 'Courier', id: 'courier', category: 'mono', weights: [400, 700], italic: true, source: 'standard' },
];

export const FONT_CATALOG: CatalogFont[] = [...GOOGLE_FONTS, ...STANDARD_FONTS].sort((a, b) =>
  a.family.localeCompare(b.family, 'es')
);

/** Valor de `font-family` (CSS) que se guarda en el campo y sirve para la vista previa. */
export function cssFontStack(font: CatalogFont): string {
  if (font.id === 'times') return '"Times New Roman", Times, serif';
  if (font.id === 'courier') return '"Courier New", Courier, monospace';
  return `"${font.family}", ${GENERIC_FAMILY[font.category]}`;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Encuentra la fuente del catálogo a partir del `font-family` guardado en un campo,
 * incluidos los valores antiguos ("Playfair Display, Georgia, serif", "monospace").
 */
export function findCatalogFont(fontFamily: string): CatalogFont | undefined {
  const first = fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') ?? '';
  const key = normalize(first);
  if (!key) return undefined;
  if (key === 'monospace' || key === 'courier' || key === 'courier new') return STANDARD_FONTS[1];
  if (key === 'times' || key === 'times new roman') return STANDARD_FONTS[0];
  return FONT_CATALOG.find((font) => normalize(font.family) === key);
}

export function supportsBold(font: CatalogFont): boolean {
  return font.weights.some((w) => w >= 600);
}

export function supportsItalic(font: CatalogFont): boolean {
  return font.italic;
}

export interface FontVariant {
  weight: number;
  italic: boolean;
}

/**
 * Variante real que se usará (en pantalla y en el PDF): negrita = 700 o el peso ≥600 más cercano;
 * normal = 400. Si la fuente no tiene negrita o itálica, se usa la regular en vez de simularla.
 */
export function resolveFontVariant(font: CatalogFont, isBold: boolean, isItalic: boolean): FontVariant {
  const closest = (target: number, candidates: number[]) =>
    candidates.reduce((best, w) => (Math.abs(w - target) < Math.abs(best - target) ? w : best), candidates[0]);
  const heavy = font.weights.filter((w) => w >= 600);
  const weight = isBold && heavy.length > 0 ? closest(700, heavy) : closest(400, font.weights);
  return { weight, italic: isItalic && font.italic };
}

/** Fuente y variante efectivas de un campo (sin catálogo: se interpreta como antes, con Times/Helvetica). */
export function fieldFontVariant(field: Pick<FieldBox, 'fontFamily' | 'isBold' | 'isItalic'>): FontVariant {
  const font = findCatalogFont(field.fontFamily);
  const isBold = field.isBold ?? false;
  const isItalic = field.isItalic ?? false;
  if (!font) return { weight: isBold ? 700 : 400, italic: isItalic };
  return resolveFontVariant(font, isBold, isItalic);
}

/** Busca por nombre (sin distinguir tildes ni mayúsculas) y, opcionalmente, por categoría. */
export function searchFonts(query: string, category?: FontCategory | 'all'): CatalogFont[] {
  const q = normalize(query);
  return FONT_CATALOG.filter(
    (font) =>
      (!category || category === 'all' || font.category === category) &&
      (!q || normalize(font.family).includes(q) || normalize(FONT_CATEGORY_LABELS[font.category]).includes(q))
  );
}
