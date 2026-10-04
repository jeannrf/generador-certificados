import React, { useState, useRef, useEffect } from 'react';
import { TemplateData, FieldBox, TextAlign } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { transformTextCase } from '../../domain/normalization';
import { calculateScreenFontSize } from '../../domain/layout';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Move,
  Sliders,
  ChevronLeft,
  Sparkles,
  Minus,
  Plus,
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
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [sampleName, setSampleName] = useState('Jeanpier Alexander Robles Fabian');
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isSnappedToCenterX, setIsSnappedToCenterX] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0, fieldX: 0, fieldY: 0, width: 0, height: 0 });
  const previewText = transformTextCase(sampleName, field.textCase);

  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    update();
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const screenFontSize = calculateScreenFontSize(
    previewText,
    field,
    containerWidth,
    template.widthPt
  );

  // Navegación precisa con flechas del teclado (1px por pulsación, Shift + Flechas = 10px)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // No mover si el usuario está escribiendo en un input, textarea o select
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown'
      ) {
        e.preventDefault();

        // Cálculo exacto de 1 píxel físico según el tamaño real del lienzo
        let stepX = 0.002;
        let stepY = 0.002;
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          if (rect.width > 0) stepX = (e.shiftKey ? 10 : 1) / rect.width;
          if (rect.height > 0) stepY = (e.shiftKey ? 10 : 1) / rect.height;
        } else {
          stepX = e.shiftKey ? 0.01 : 0.002;
          stepY = e.shiftKey ? 0.01 : 0.002;
        }

        let newX = field.x;
        let newY = field.y;

        if (e.key === 'ArrowLeft') newX = Math.max(0, field.x - stepX);
        if (e.key === 'ArrowRight') newX = Math.min(1 - field.width, field.x + stepX);
        if (e.key === 'ArrowUp') newY = Math.max(0, field.y - stepY);
        if (e.key === 'ArrowDown') newY = Math.min(1 - field.height, field.y + stepY);

        // Notificar si está en el centro
        const boxCenterX = newX + field.width / 2;
        if (Math.abs(boxCenterX - 0.5) < 0.005) {
          setIsSnappedToCenterX(true);
        } else {
          setIsSnappedToCenterX(false);
        }

        onFieldChange({ ...field, x: newX, y: newY });
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [field, onFieldChange]);

  // Centrar horizontalmente con 1 clic
  const handleCenterField = () => {
    const centeredX = Math.max(0, (1 - field.width) / 2);
    onFieldChange({ ...field, x: centeredX });
  };

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
        let nextX = Math.min(
          Math.max(0, dragStartPos.current.fieldX + deltaX),
          1 - field.width
        );
        const nextY = Math.min(
          Math.max(0, dragStartPos.current.fieldY + deltaY),
          1 - field.height
        );

        // Guía magnética al centro horizontal del certificado
        const boxCenterX = nextX + field.width / 2;
        const SNAP_TOLERANCE = 0.015; // 1.5% de tolerancia magnética
        if (Math.abs(boxCenterX - 0.5) < SNAP_TOLERANCE) {
          nextX = (1 - field.width) / 2;
          setIsSnappedToCenterX(true);
        } else {
          setIsSnappedToCenterX(false);
        }

        onFieldChange({ ...field, x: nextX, y: nextY });
      } else if (isResizing) {
        let { fieldX, fieldY, width, height } = dragStartPos.current;

        if (isResizing.includes('e')) {
          width = Math.max(0.04, Math.min(1 - fieldX, width + deltaX));
        }
        if (isResizing.includes('s')) {
          height = Math.max(0.02, Math.min(1 - fieldY, height + deltaY));
        }
        if (isResizing.includes('w')) {
          const maxW = fieldX + width;
          const newW = Math.max(0.04, Math.min(maxW, width - deltaX));
          fieldX = maxW - newW;
          width = newW;
        }
        if (isResizing.includes('n')) {
          const maxH = fieldY + height;
          const newH = Math.max(0.02, Math.min(maxH, height - deltaY));
          fieldY = maxH - newH;
          height = newH;
        }

        // Detección de centro durante redimensión
        const boxCenterX = fieldX + width / 2;
        const SNAP_TOLERANCE = 0.015;
        if (Math.abs(boxCenterX - 0.5) < SNAP_TOLERANCE) {
          setIsSnappedToCenterX(true);
        } else {
          setIsSnappedToCenterX(false);
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
      setIsSnappedToCenterX(false);
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
    <div className="space-y-6 animate-fadeIn">
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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <span className="hidden sm:inline">Arrastra o usa las <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-300 text-slate-700 text-[10px]">Flechas</kbd> (1px) / <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-300 text-slate-700 text-[10px]">Shift+Flechas</kbd> (10px)</span>
                <span className="sm:hidden font-medium text-slate-600">Arrastra para ubicar el nombre</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCenterField}
                  className="text-[11px] font-semibold text-brand-700 bg-white hover:bg-brand-50 px-2 py-0.5 rounded border border-brand-200 transition-colors shadow-2xs cursor-pointer"
                  title="Alinear automáticamente al centro horizontal del certificado"
                >
                  Centrar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onFieldChange({
                      ...field,
                      x: 0.05,
                      y: 0.42,
                      width: 0.90,
                      height: 0.13,
                      maxFontSize: 28,
                      isBold: true,
                    })
                  }
                  className="text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 px-2 py-0.5 rounded border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                  title="Restablecer al tamaño estándar (28 pt, 90% de ancho)"
                >
                  Restablecer (28 pt)
                </button>
                <span className="hidden sm:inline-block font-mono bg-white px-2 py-0.5 rounded border text-slate-600">
                  X: {Math.round(field.x * 100)}% • Y: {Math.round(field.y * 100)}%
                </span>
              </div>
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

              {/* Red Vertical Snapping Guide Line (Guía de centro en rojo) */}
              {(isSnappedToCenterX || (isDragging && Math.abs(field.x + field.width / 2 - 0.5) < 0.005)) && (
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-rose-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(244,63,94,0.6)] flex flex-col items-center justify-between py-2">
                  <span className="bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow tracking-wider uppercase">
                    Centro
                  </span>
                  <span className="bg-rose-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow tracking-wider uppercase">
                    Centro
                  </span>
                </div>
              )}

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
                  className="w-full h-full flex px-[1%] py-0.5 overflow-hidden pointer-events-none"
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
                    className="w-full block truncate leading-normal select-none transition-all py-0.5 px-0.5"
                    style={{
                      fontFamily: field.fontFamily,
                      fontWeight: field.isBold ? 700 : 400,
                      fontStyle: field.isItalic ? 'italic' : 'normal',
                      fontSize: `${screenFontSize}px`,
                      color: field.color,
                      textAlign: field.align,
                    }}
                  >
                    {previewText || 'Jeanpier Alexander Robles Fabian'}
                  </span>
                </div>

                {/* Corner Resize Handles (Canva / PowerPoint style) */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'nw')}
                  title="Redimensionar esquina superior izquierda"
                  className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-brand-600 rounded-full cursor-nwse-resize shadow-sm hover:scale-125 transition-transform after:absolute after:-inset-2.5 after:content-['']"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'ne')}
                  title="Redimensionar esquina superior derecha"
                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-brand-600 rounded-full cursor-nesw-resize shadow-sm hover:scale-125 transition-transform after:absolute after:-inset-2.5 after:content-['']"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'sw')}
                  title="Redimensionar esquina inferior izquierda"
                  className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-brand-600 rounded-full cursor-nesw-resize shadow-sm hover:scale-125 transition-transform after:absolute after:-inset-2.5 after:content-['']"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'se')}
                  title="Redimensionar esquina inferior derecha"
                  className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-brand-600 rounded-full cursor-nwse-resize shadow-sm hover:scale-125 transition-transform after:absolute after:-inset-2.5 after:content-['']"
                />

                {/* Edge Resize Handles (Top, Bottom, Left, Right) */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'n')}
                  title="Ajustar altura (superior)"
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border border-brand-500 rounded-full cursor-ns-resize shadow-xs hover:bg-brand-100 hover:scale-110 transition-transform"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 's')}
                  title="Ajustar altura (inferior)"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border border-brand-500 rounded-full cursor-ns-resize shadow-xs hover:bg-brand-100 hover:scale-110 transition-transform"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'w')}
                  title="Ajustar ancho (izquierda)"
                  className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-6 bg-white border border-brand-500 rounded-full cursor-ew-resize shadow-xs hover:bg-brand-100 hover:scale-110 transition-transform"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'e')}
                  title="Ajustar ancho (derecha)"
                  className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-6 bg-white border border-brand-500 rounded-full cursor-ew-resize shadow-xs hover:bg-brand-100 hover:scale-110 transition-transform"
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Styling Controls Sidebar (Right Column) */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="p-5 space-y-5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sliders className="w-4 h-4 text-brand-600" />
              Ajustes de Tipografía
            </h3>

            {/* Test Text Input (Placed prominently at the top of the sidebar) */}
            <div className="space-y-2 bg-brand-50/50 p-3 rounded-xl border border-brand-200/70">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                Texto de prueba en vivo
              </label>
              <input
                type="text"
                value={sampleName}
                onChange={(e) => setSampleName(e.target.value)}
                className="w-full text-xs font-semibold text-slate-900 bg-white border border-brand-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none shadow-xs"
                placeholder="Jeanpier Alexander Robles Fabian"
              />

            </div>

            {/* Font Family */}
            <div className="space-y-2">
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

            {/* Compact Typography Toolbar: Style (B, I, Mayús) + Alignment */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">Estilo y Alineación</label>
                <span className="text-[10px] text-slate-500">
                  {field.textCase === 'upper' ? (
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Mayús activado
                    </span>
                  ) : (
                    <span className="text-slate-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Normal
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5 bg-slate-100 rounded-xl border border-slate-200">
                {/* Bold, Italic & Mayús Toggle */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title="Negrita (Bold)"
                    onClick={() => onFieldChange({ ...field, isBold: !field.isBold })}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-all ${
                      field.isBold
                        ? 'bg-brand-600 text-white font-extrabold shadow-sm'
                        : 'bg-white text-slate-700 hover:bg-slate-50 font-bold border border-slate-200'
                    }`}
                  >
                    B
                  </button>

                  <button
                    type="button"
                    title="Cursiva (Italic)"
                    onClick={() => onFieldChange({ ...field, isItalic: !field.isItalic })}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm transition-all ${
                      field.isItalic
                        ? 'bg-brand-600 text-white font-serif italic font-bold shadow-sm'
                        : 'bg-white text-slate-700 hover:bg-slate-50 font-serif italic font-bold border border-slate-200'
                    }`}
                  >
                    I
                  </button>

                  {/* Mayús Toggle Button with Red/Green border */}
                  <button
                    type="button"
                    title={
                      field.textCase === 'upper'
                        ? 'Mayúsculas ACTIVADAS (clic para volver a Normal)'
                        : 'Mayúsculas DESACTIVADAS (clic para activar MAYÚSCULAS)'
                    }
                    onClick={() =>
                      onFieldChange({
                        ...field,
                        textCase: field.textCase === 'upper' ? 'title' : 'upper',
                      })
                    }
                    className={`relative w-9 h-9 flex items-center justify-center rounded-lg text-xs transition-all ${
                      field.textCase === 'upper'
                        ? 'bg-emerald-50 text-emerald-700 font-extrabold border-2 border-emerald-500 shadow-xs ring-2 ring-emerald-400/20'
                        : 'bg-white text-slate-600 hover:bg-rose-50/30 font-semibold border-2 border-rose-300 hover:border-rose-400'
                    }`}
                  >
                    <span className="text-[11px] font-extrabold leading-none">
                      {field.textCase === 'upper' ? 'MAY' : 'Aa'}
                    </span>
                    <span
                      className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                        field.textCase === 'upper' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400'
                      }`}
                    />
                  </button>
                </div>

                {/* Divider */}
                <div className="w-px h-6 bg-slate-300" />

                {/* Alignment Icons Only */}
                <div className="flex items-center gap-1.5">
                  {[
                    { value: 'left' as TextAlign, label: 'Alinear a la izquierda', icon: AlignLeft },
                    { value: 'center' as TextAlign, label: 'Centrar texto', icon: AlignCenter },
                    { value: 'right' as TextAlign, label: 'Alinear a la derecha', icon: AlignRight },
                  ].map((a) => {
                    const Icon = a.icon;
                    const isSelected = field.align === a.value;
                    return (
                      <button
                        key={a.value}
                        type="button"
                        title={a.label}
                        onClick={() => onFieldChange({ ...field, align: a.value })}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
                          isSelected
                            ? 'bg-brand-600 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Font Size (Manual input + Slider + / - buttons) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-700">Tamaño de fuente</label>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-xs focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500">
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={field.maxFontSize}
                    onChange={(e) => {
                      const val = Math.max(8, Math.min(120, Number(e.target.value) || 12));
                      onFieldChange({
                        ...field,
                        maxFontSize: val,
                        minFontSize: Math.min(val, field.minFontSize),
                      });
                    }}
                    className="w-10 text-xs font-bold text-brand-700 text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[11px] font-semibold text-slate-400">pt</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = Math.max(10, field.maxFontSize - 1);
                    onFieldChange({
                      ...field,
                      maxFontSize: nextVal,
                      minFontSize: Math.min(nextVal, field.minFontSize),
                    });
                  }}
                  className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg transition-colors shadow-xs"
                  title="Reducir 1 pt"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min="12"
                  max="72"
                  value={field.maxFontSize}
                  onChange={(e) => {
                    const nextVal = Number(e.target.value);
                    onFieldChange({
                      ...field,
                      maxFontSize: nextVal,
                      minFontSize: Math.min(nextVal, field.minFontSize),
                    });
                  }}
                  className="flex-1 accent-brand-600 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = Math.min(90, field.maxFontSize + 1);
                    onFieldChange({
                      ...field,
                      maxFontSize: nextVal,
                      minFontSize: Math.min(nextVal, field.minFontSize),
                    });
                  }}
                  className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg transition-colors shadow-xs"
                  title="Aumentar 1 pt"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
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
