import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import {
  cssFontStack,
  findCatalogFont,
  FONT_CATEGORY_LABELS,
  FontCategory,
  searchFonts,
} from '../domain/fonts';
import { loadCatalogNamesForPreview, loadFontForPreview } from '../infra/fontLoader';

interface FontPickerProps {
  /** `font-family` actual del campo */
  value: string;
  onChange: (fontFamily: string) => void;
}

const CATEGORIES: Array<FontCategory | 'all'> = ['all', 'serif', 'sans', 'script', 'display', 'mono'];

/**
 * Selector de fuentes con buscador y filtros por categoría. Cada nombre se muestra en su propia fuente.
 */
export const FontPicker: React.FC<FontPickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FontCategory | 'all'>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const current = findCatalogFont(value);
  const results = useMemo(() => searchFonts(query, category), [query, category]);

  useEffect(() => {
    loadFontForPreview(current);
  }, [current]);

  useEffect(() => {
    if (!isOpen) return;
    loadCatalogNamesForPreview();
    searchRef.current?.focus();
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const select = (fontFamily: string) => {
    onChange(fontFamily);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Fuente: ${current?.family ?? value}`}
        onClick={() => setIsOpen((open) => !open)}
        className="w-full flex items-center justify-between gap-2 text-sm rounded-lg border border-slate-200 bg-slate-50 hover:bg-white px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-[#208077] focus:outline-none cursor-pointer"
      >
        <span className="truncate" style={{ fontFamily: current ? cssFontStack(current) : value }}>
          {current?.family ?? value.split(',')[0].replace(/['"]/g, '')}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-500" />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Elegir fuente"
          className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
        >
          <div className="p-2 space-y-2 border-b border-slate-100">
            <label className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 focus-within:ring-2 focus-within:ring-[#208077]">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results[0]) {
                    e.preventDefault();
                    select(cssFontStack(results[0]));
                  }
                }}
                placeholder="Buscar fuente"
                aria-label="Buscar fuente"
                className="w-full text-xs bg-transparent focus:outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-1" role="group" aria-label="Categoría">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={category === cat}
                  onClick={() => setCategory(cat)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border cursor-pointer ${
                    category === cat
                      ? 'bg-[#208077] text-white border-[#208077]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cat === 'all' ? 'Todas' : FONT_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          <ul className="max-h-64 overflow-y-auto py-1" role="listbox" aria-label="Fuentes">
            {results.length === 0 && <li className="px-3 py-4 text-center text-xs text-slate-400">Sin resultados</li>}
            {results.map((font) => {
              const isSelected = current?.id === font.id;
              return (
                <li key={font.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => select(cssFontStack(font))}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left cursor-pointer ${
                      isSelected ? 'bg-[#f0faf9]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[15px] text-slate-900 truncate" style={{ fontFamily: cssFontStack(font) }}>
                      {font.family}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-400">{FONT_CATEGORY_LABELS[font.category]}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#208077]" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
