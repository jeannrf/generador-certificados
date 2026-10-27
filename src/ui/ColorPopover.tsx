import React from 'react';

interface ColorPopoverProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

/**
 * Botón de color de texto (una "A" con la barra del color elegido) que abre el selector de color
 * del sistema, el mismo que usa el color del QR. El input cubre todo el botón para que el clic lo
 * abra directamente en cualquier navegador.
 */
export const ColorPopover: React.FC<ColorPopoverProps> = ({ value, onChange, label = 'Color del texto' }) => (
  <label
    title={label}
    className="relative w-8 h-8 flex flex-col items-center justify-center gap-0.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer focus-within:ring-2 focus-within:ring-[#208077]"
  >
    <span className="text-[13px] font-bold leading-none text-slate-700" aria-hidden>
      A
    </span>
    <span className="w-4 h-1 rounded-full ring-1 ring-slate-300" style={{ backgroundColor: value }} aria-hidden />
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
    />
  </label>
);
