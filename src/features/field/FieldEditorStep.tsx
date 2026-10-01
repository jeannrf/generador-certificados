import React, { useState, useRef, useEffect, useCallback } from 'react';
import { TemplateData, FieldBox, TextAlign, TextCase } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { transformTextCase } from '../../domain/normalization';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Move,
  Sliders,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';

interface FieldEditorStepProps {
  template: TemplateData;
  field: FieldBox;
  onFieldChange: (field: FieldBox) => void;
  onBack: () => void;
  onContinue: () => void;
}

const FONT_OPTIONS = [
  { label: 'Playfair Display (Serif Elegante)', value: 'Playfair Display, Georgia, serif' },
  { label: 'Cormorant Garamond (Clásico)', value: 'Cormorant Garamond, Georgia, serif' },
  { label: 'Plus Jakarta Sans (Moderno)', value: 'Plus Jakarta Sans, sans-serif' },
  { label: 'Montserrat (Geométrico)', value: 'Montserrat, sans-serif' },
  { label: 'Poppins (Amigable)', value: 'Poppins, sans-serif' },
  { label: 'Monospace (Técnico)', value: 'monospace' },
];

const PRESET_COLORS = [
  '#0f172a', // Slate Dark
  '#1e3a8a', // Navy Blue
  '#7c3aed', // Brand Violet
  '#d97706', // Gold / Amber
  '#047857', // Emerald Green
  '#0284c7', // Sky Blue
  '#dc2626', // Crimson Red
  '#ffffff', // Pure White
];

export const FieldEditorStep: React.FC<FieldEditorStepProps> = ({
  template,
  field,
  onFieldChange,
  onBack,
  onContinue,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sampleName, setSampleName] = useState('Dra. María Elena de la Fuente y Montalbán');
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0, fieldX: 0, fieldY: 0, width: 0, height: 0 });

  const previewText = transformTextCase(sampleName, field.textCase);

  // Mover con teclas de flecha
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 0.02 : 0.005;
      let newX = field.x;
      let newY = field.y;

      if (e.key === 'ArrowLeft') newX = Math.max(0, field.x - step);
      if (e.key === 'ArrowRight') newX = Math.min(1 - field.width, field.x + step);
      if (e.key === 'ArrowUp') newY = Math.max(0, field.y - step);
      if (e.key === 'ArrowDown') newY = Math.min(1 - field.height, field.y + step);

      if (newX !== field.x || newY !== field.y) {
        e.preventDefault();
        onFieldChange({ ...field, x: newX, y: newY });
      }
    },
    [field, onFieldChange]
  );

  // Manejadores de arrastre y redimensión del recuadro
  const handlePointerDown = (e: React.PointerEvent, action: 'drag' | string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    dragStartPos.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      fieldX: field.x,
      fieldY: field.y,
      width: field.width,
      height: field.height,
    };

    if (action === 'drag') {
      setIsDragging(true);
    } else {
      setIsResizing(action);
    }
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      if (!isDragging && !isResizing) return;

      const rect = containerRef.current.getBoundingClientRect();
      const currentX = (e.clientX - rect.left) / rect.width;
      const currentY = (e.clientY - rect.top) / rect.height;
      const deltaX = currentX - dragStartPos.current.x;
      const deltaY = currentY - dragStartPos.current.y;

      if (isDragging) {
        const nextX = Math.min(
          Math.max(0, dragStartPos.current.fieldX + deltaX),
          1 - field.width
        );
        const nextY = Math.min(
          Math.max(0, dragStartPos.current.fieldY + deltaY),
          1 - field.height
        );
        onFieldChange({ ...field, x: nextX, y: nextY });
      } else if (isResizing) {
        let { fieldX, fieldY, width, height } = dragStartPos.current;

        if (isResizing.includes('e')) {
          width = Math.max(0.1, Math.min(1 - fieldX, width + deltaX));
        }
        if (isResizing.includes('s')) {
          height = Math.max(0.05, Math.min(1 - fieldY, height + deltaY));
        }
        if (isResizing.includes('w')) {
          const maxW = fieldX + width;
          const newW = Math.max(0.1, Math.min(maxW, width - deltaX));
          fieldX = maxW - newW;
          width = newW;
        }
        if (isResizing.includes('n')) {
          const maxH = fieldY + height;
          const newH = Math.max(0.05, Math.min(maxH, height - deltaY));
          fieldY = maxH - newH;
          height = newH;
        }

        onFieldChange({
          ...field,
          x: Math.max(0, fieldX),
          y: Math.max(0, fieldY),
          width,
          height,
        });
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setIsResizing(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, isResizing, field, onFieldChange]);

  return (
    <div className="space-y-6 animate-fadeIn" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Define la ubicación y el estilo del nombre
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Arrastra el recuadro sobre el certificado y personaliza la tipografía.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />} onClick={onBack}>
            Atrás
          </Button>
          <Button variant="primary" size="sm" onClick={onContinue}>
            Guardar y Continuar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive Canvas / Visual Template Editor */}
        <div className="lg:col-span-8">
          <Card className="p-4 sm:p-6 overflow-hidden bg-slate-900/5">
            <div className="flex items-center justify-between mb-3 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-brand-600" />
                Haz clic y arrastra para mover • Tira de las esquinas para cambiar el tamaño
              </span>
              <span className="hidden sm:inline-block font-mono bg-white px-2 py-0.5 rounded border text-slate-600">
                X: {Math.round(field.x * 100)}% • Y: {Math.round(field.y * 100)}%
              </span>
            </div>

            {/* Template Container with overlay box */}
            <div
              ref={containerRef}
              className="relative w-full rounded-xl overflow-hidden shadow-lg border border-slate-300 bg-white select-none touch-none"
              style={{ aspectRatio: `${template.widthPt} / ${template.heightPt}` }}
            >
              <img
                src={template.previewUrl}
                alt="Plantilla"
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />

              {/* Bounding Box for Name */}
              <div
                onPointerDown={(e) => handlePointerDown(e, 'drag')}
                style={{
                  left: `${field.x * 100}%`,
                  top: `${field.y * 100}%`,
                  width: `${field.width * 100}%`,
                  height: `${field.height * 100}%`,
                }}
                className={`absolute cursor-move border-2 border-brand-500 bg-brand-500/10 rounded-sm flex transition-shadow ${
                  isDragging ? 'shadow-2xl ring-4 ring-brand-300/60 bg-brand-500/20' : 'hover:border-brand-600'
                }`}
              >
                {/* Live Name Text inside box */}
                <div
                  className="w-full h-full flex px-2 overflow-hidden pointer-events-none"
                  style={{
                    alignItems:
                      field.vAlign === 'top'
                        ? 'flex-start'
                        : field.vAlign === 'bottom'
                        ? 'flex-end'
                        : 'center',
                    justifyContent:
                      field.align === 'left'
                        ? 'flex-start'
                        : field.align === 'right'
                        ? 'flex-end'
                        : 'center',
                  }}
                >
                  <span
                    className="truncate leading-none select-none transition-all"
                    style={{
                      fontFamily: field.fontFamily,
                      fontSize: `clamp(${field.minFontSize * 0.4}px, 2.5vw, ${field.maxFontSize * 0.55}px)`,
                      color: field.color,
                      textAlign: field.align,
                    }}
                  >
                    {previewText || 'Nombre del Destinatario'}
                  </span>
                </div>

                {/* Resize Handles */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'nw')}
                  className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-brand-600 border-2 border-white rounded-full cursor-nwse-resize shadow"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'ne')}
                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-brand-600 border-2 border-white rounded-full cursor-nesw-resize shadow"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'sw')}
                  className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-brand-600 border-2 border-white rounded-full cursor-nesw-resize shadow"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'se')}
                  className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-brand-600 border-2 border-white rounded-full cursor-nwse-resize shadow"
                />
              </div>
            </div>

            {/* Test Input */}
            <div className="mt-4 flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
              <Sparkles className="w-4 h-4 text-brand-600 shrink-0" />
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Probar con un nombre de ejemplo:
                </label>
                <input
                  type="text"
                  value={sampleName}
                  onChange={(e) => setSampleName(e.target.value)}
                  className="w-full text-sm font-medium text-slate-800 focus:outline-none bg-transparent"
                  placeholder="Escribe un nombre largo para probar el autoajuste..."
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Styling Controls Sidebar */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="p-5 space-y-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sliders className="w-4 h-4 text-brand-600" />
              Ajustes de Tipografía
            </h3>

            {/* Font Family */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Fuente tipográfica</label>
              <select
                value={field.fontFamily}
                onChange={(e) => onFieldChange({ ...field, fontFamily: e.target.value })}
                className="w-full text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:bg-white"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Font Sizes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">Tamaño Máx.</span>
                  <span className="font-mono text-brand-600">{field.maxFontSize} pt</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={field.maxFontSize}
                  onChange={(e) =>
                    onFieldChange({ ...field, maxFontSize: Number(e.target.value) })
                  }
                  className="w-full accent-brand-600"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">Tamaño Mín.</span>
                  <span className="font-mono text-slate-500">{field.minFontSize} pt</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="40"
                  value={field.minFontSize}
                  onChange={(e) =>
                    onFieldChange({ ...field, minFontSize: Number(e.target.value) })
                  }
                  className="w-full accent-brand-600"
                />
              </div>
            </div>

            {/* Alignment */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Alineación Horizontal</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'left' as TextAlign, label: 'Izquierda', icon: AlignLeft },
                  { value: 'center' as TextAlign, label: 'Centro', icon: AlignCenter },
                  { value: 'right' as TextAlign, label: 'Derecha', icon: AlignRight },
                ].map((a) => {
                  const Icon = a.icon;
                  const isSelected = field.align === a.value;
                  return (
                    <button
                      key={a.value}
                      onClick={() => onFieldChange({ ...field, align: a.value })}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Capitalization */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Formato de Texto</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { value: 'title' as TextCase, label: 'Tipo Título' },
                  { value: 'upper' as TextCase, label: 'MAYÚSCULAS' },
                  { value: 'original' as TextCase, label: 'Original' },
                ].map((tc) => (
                  <button
                    key={tc.value}
                    onClick={() => onFieldChange({ ...field, textCase: tc.value })}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-medium border transition-all ${
                      field.textCase === tc.value
                        ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {tc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker & Presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Color del Texto</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={field.color}
                  onChange={(e) => onFieldChange({ ...field, color: e.target.value })}
                  className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer p-0.5 bg-white"
                />
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => onFieldChange({ ...field, color: c })}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-lg border border-slate-300 transition-transform ${
                        field.color.toLowerCase() === c.toLowerCase()
                          ? 'scale-125 ring-2 ring-brand-500 ring-offset-1'
                          : 'hover:scale-110'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
