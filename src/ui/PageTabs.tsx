import React from 'react';
import { TemplatePage } from '../domain/types';

interface PageTabsProps {
  pages: TemplatePage[];
  currentPageId: string;
  onSelect: (pageId: string) => void;
  /** Cantidad de campos por página, para mostrarla junto al número */
  fieldCounts?: Record<string, number>;
  className?: string;
}

/**
 * Pestañas para navegar entre las páginas de la plantilla. Si solo hay una página no muestra nada.
 */
export const PageTabs: React.FC<PageTabsProps> = ({
  pages,
  currentPageId,
  onSelect,
  fieldCounts,
  className = '',
}) => {
  if (pages.length <= 1) return null;

  return (
    // Una sola fila: si no entran todas (móvil), se desplazan de lado en vez de partirse en dos líneas
    <div
      role="tablist"
      aria-label="Páginas de la plantilla"
      className={`flex flex-nowrap items-center gap-1.5 overflow-x-auto max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {pages.map((page, index) => {
        const isActive = page.id === currentPageId;
        const count = fieldCounts?.[page.id];
        return (
          <button
            key={page.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={page.sourceName}
            onClick={() => onSelect(page.id)}
            className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              isActive
                ? 'bg-[#208077] text-white border-[#208077] shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Pág. {index + 1}
            {count !== undefined && (
              <span
                className={`min-w-[1.25rem] px-1 rounded-full text-xs font-bold ${
                  isActive ? 'bg-white/25 text-white' : count > 0 ? 'bg-[#f0faf9] text-[#208077]' : 'bg-slate-100 text-slate-400'
                }`}
                aria-label={`${count} campos`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
