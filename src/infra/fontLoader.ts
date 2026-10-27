import { FieldBox } from '../domain/types';
import { CatalogFont, findCatalogFont, FONT_CATALOG, FontVariant } from '../domain/fonts';

const FONTSOURCE_CDN = 'https://cdn.jsdelivr.net/fontsource/fonts';
const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com/css2';

/** URL del TTF de una variante (subconjunto latino: incluye tildes y ñ). */
export function fontFileUrl(font: CatalogFont, variant: FontVariant): string {
  return `${FONTSOURCE_CDN}/${font.id}@latest/latin-${variant.weight}-${variant.italic ? 'italic' : 'normal'}.ttf`;
}

export type FontBytesLoader = (font: CatalogFont, variant: FontVariant) => Promise<Uint8Array>;

/**
 * Descarga el archivo de la fuente una sola vez por variante. Si falla, no se guarda el error,
 * para poder reintentar en el próximo certificado (por ejemplo, al volver la conexión).
 */
export function createFontBytesLoader(fetchImpl: typeof fetch = (...args) => fetch(...args)): FontBytesLoader {
  const cache = new Map<string, Promise<Uint8Array>>();
  return (font, variant) => {
    const url = fontFileUrl(font, variant);
    let pending = cache.get(url);
    if (!pending) {
      pending = fetchImpl(url).then(async (response) => {
        if (!response.ok) throw new Error(`No se pudo descargar la fuente ${font.family} (${response.status}).`);
        return new Uint8Array(await response.arrayBuffer());
      });
      pending.catch(() => cache.delete(url));
      cache.set(url, pending);
    }
    return pending;
  };
}

// --- Vista previa en el navegador ---

const requestedStylesheets = new Set<string>();

function appendStylesheet(href: string): void {
  if (typeof document === 'undefined' || requestedStylesheets.has(href)) return;
  requestedStylesheets.add(href);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

/** Carga en la página todas las variantes de una fuente para que la vista previa coincida con el PDF. */
export function loadFontForPreview(font: CatalogFont | undefined): void {
  if (!font || font.source === 'standard') return;
  const family = font.family.replace(/ /g, '+');
  const axes = font.italic
    ? [...font.weights.map((w) => `0,${w}`), ...font.weights.map((w) => `1,${w}`)].join(';')
    : font.weights.join(';');
  appendStylesheet(`${GOOGLE_FONTS_CSS}?family=${family}:${font.italic ? 'ital,' : ''}wght@${axes}&display=swap`);
}

export function loadFieldFontsForPreview(fields: Pick<FieldBox, 'fontFamily'>[]): void {
  for (const field of fields) loadFontForPreview(findCatalogFont(field.fontFamily));
}

/**
 * Para el selector: carga todas las fuentes del catálogo pero solo con las letras de sus propios
 * nombres (parámetro `text` de Google Fonts), así la lista pesa muy poco.
 */
export function loadCatalogNamesForPreview(): void {
  const googleFonts = FONT_CATALOG.filter((font) => font.source !== 'standard');
  const letters = [...new Set(googleFonts.map((font) => font.family).join(''))].join('');
  const families = googleFonts.map((font) => `family=${font.family.replace(/ /g, '+')}`).join('&');
  appendStylesheet(`${GOOGLE_FONTS_CSS}?${families}&text=${encodeURIComponent(letters)}&display=swap`);
}
