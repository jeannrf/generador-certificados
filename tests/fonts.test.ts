import { describe, it, expect, vi } from 'vitest';
import {
  cssFontStack,
  fieldFontVariant,
  findCatalogFont,
  FONT_CATALOG,
  resolveFontVariant,
  searchFonts,
  supportsBold,
  supportsItalic,
} from '../src/domain/fonts';
import { createFontBytesLoader, fontFileUrl } from '../src/infra/fontLoader';

const byFamily = (family: string) => FONT_CATALOG.find((f) => f.family === family)!;

describe('Catálogo de fuentes', () => {
  it('tiene más de 100 fuentes, sin duplicados y todas con peso regular', () => {
    expect(FONT_CATALOG.length).toBeGreaterThan(100);
    expect(new Set(FONT_CATALOG.map((f) => f.id)).size).toBe(FONT_CATALOG.length);
    expect(FONT_CATALOG.every((f) => f.weights.includes(400))).toBe(true);
  });

  it('cubre todas las categorías, incluidas las manuscritas para certificados', () => {
    const counts = FONT_CATALOG.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.category]: (acc[f.category] ?? 0) + 1 }), {});
    expect(counts.script).toBeGreaterThanOrEqual(20);
    expect(Object.keys(counts).sort()).toEqual(['display', 'mono', 'sans', 'script', 'serif']);
  });

  it('el valor CSS guardado vuelve a encontrar la misma fuente', () => {
    for (const font of FONT_CATALOG) {
      expect(findCatalogFont(cssFontStack(font))?.id).toBe(font.id);
    }
  });
});

describe('Búsqueda de fuentes', () => {
  it('busca sin distinguir mayúsculas ni tildes', () => {
    expect(searchFonts('GREAT').map((f) => f.family)).toContain('Great Vibes');
    expect(searchFonts('manuscríta').every((f) => f.category === 'script')).toBe(true);
  });

  it('filtra por categoría y combina con el texto', () => {
    const scripts = searchFonts('', 'script');
    expect(scripts.length).toBeGreaterThanOrEqual(20);
    expect(scripts.every((f) => f.category === 'script')).toBe(true);
    expect(searchFonts('play', 'display').map((f) => f.family)).toEqual(['Playfair Display SC']);
    expect(searchFonts('zzzz')).toEqual([]);
  });
});

describe('Variantes (negrita e itálica)', () => {
  it('usa 700 para negrita si existe, o el peso pesado más cercano', () => {
    expect(resolveFontVariant(byFamily('Montserrat'), true, false)).toEqual({ weight: 700, italic: false });
    expect(resolveFontVariant(byFamily('Montserrat'), false, true)).toEqual({ weight: 400, italic: true });
  });

  it('no simula negrita ni itálica en fuentes que no las tienen', () => {
    const greatVibes = byFamily('Great Vibes');
    expect(supportsBold(greatVibes)).toBe(false);
    expect(supportsItalic(greatVibes)).toBe(false);
    expect(resolveFontVariant(greatVibes, true, true)).toEqual({ weight: 400, italic: false });
    expect(supportsItalic(byFamily('Cinzel'))).toBe(false);
  });

  it('interpreta campos con valores antiguos o desconocidos', () => {
    expect(fieldFontVariant({ fontFamily: 'Playfair Display, Georgia, serif', isBold: true, isItalic: false })).toEqual({ weight: 700, italic: false });
    expect(fieldFontVariant({ fontFamily: 'Fuente Inventada', isBold: true, isItalic: true })).toEqual({ weight: 700, italic: true });
  });
});

describe('Descarga de fuentes', () => {
  it('arma la URL del TTF latino de Fontsource', () => {
    expect(fontFileUrl(byFamily('Great Vibes'), { weight: 400, italic: false })).toBe(
      'https://cdn.jsdelivr.net/fontsource/fonts/great-vibes@latest/latin-400-normal.ttf'
    );
    expect(fontFileUrl(byFamily('Montserrat'), { weight: 700, italic: true })).toBe(
      'https://cdn.jsdelivr.net/fontsource/fonts/montserrat@latest/latin-700-italic.ttf'
    );
  });

  it('descarga cada variante una sola vez y reintenta si falló', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('error', { status: 503 }))
      .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    const load = createFontBytesLoader(fetchImpl as unknown as typeof fetch);
    const font = byFamily('Lora');

    await expect(load(font, { weight: 400, italic: false })).rejects.toThrow('No se pudo descargar la fuente Lora (503).');
    expect(await load(font, { weight: 400, italic: false })).toEqual(new Uint8Array([1, 2, 3]));
    await load(font, { weight: 400, italic: false });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
