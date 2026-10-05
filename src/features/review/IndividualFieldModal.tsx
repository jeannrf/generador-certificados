import React, { useState, useEffect, useRef } from 'react';
import { Recipient, FieldBox, TemplateData } from '../../domain/types';
import { Button } from '../../ui/Button';
import { transformTextCase } from '../../domain/normalization';
import { calculateScreenFontSize } from '../../domain/layout';
import {
  X,
  RotateCcw,
  Check,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sliders,
  Minus,
  Plus,
} from 'lucide-react';

interface IndividualFieldModalProps {
  isOpen: boolean;
  recipient: Recipient | null;
  baseField: FieldBox;
  template: TemplateData;
  onClose: () => void;
  onSave: (customField: Partial<FieldBox> | undefined) => void;
}

export const IndividualFieldModal: React.FC<IndividualFieldModalProps> = ({
  isOpen,
  recipient,
  baseField,
  template,
  onClose,
  onSave,
}) => {
  if (!isOpen || !recipient) return null;

  const [customField, setCustomField] = useState<Partial<FieldBox>>(
    recipient.customField || {}
  );
  const previewRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    setCustomField(recipient.customField || {});
  }, [recipient]);

  useEffect(() => {
    if (!previewRef.current) return;
    setContainerWidth(previewRef.current.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const effectiveField: FieldBox = {
    ...baseField,
    ...customField,
  };

  const previewName = transformTextCase(recipient.name, effectiveField.textCase);
  const screenFontSize = calculateScreenFontSize(
    previewName,
    effectiveField,
    containerWidth,
    template.widthPt
  );

  const hasCustomOverrides = Object.keys(customField).length > 0;

  const handleResetToDefault = () => {
    setCustomField({});
  };

  const handleSave = () => {
    onSave(hasCustomOverrides ? customField : undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="individual-field-modal-title"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#f0faf9] text-[#208077] flex items-center justify-center border border-[#b2e5df]" aria-hidden="true">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 id="individual-field-modal-title" className="text-sm font-bold text-slate-900">
                Ajuste individual de diseño
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-md">
                Personalizando para: <span className="font-semibold text-slate-800">{recipient.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Live Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Vista previa en tiempo real</span>
              {hasCustomOverrides && (
                <span className="text-[10px] bg-[#f0faf9] text-[#208077] font-semibold px-2 py-0.5 rounded-full border border-[#b2e5df]">
                  Ajustes personalizados activos
                </span>
              )}
            </div>

            <div
              ref={previewRef}
              className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 shadow-inner select-none"
              style={{ aspectRatio: `${template.widthPt} / ${template.heightPt}` }}
            >
              <img
                src={template.previewUrl}
                alt="Plantilla"
                className="w-full h-full object-contain pointer-events-none"
              />

              <div
                style={{
                  left: `${effectiveField.x * 100}%`,
                  top: `${effectiveField.y * 100}%`,
                  width: `${effectiveField.width * 100}%`,
                  height: `${effectiveField.height * 100}%`,
                }}
                className="absolute flex pointer-events-none border border-[#208077]/30 bg-[#208077]/5 rounded-xs"
              >
                <div
                  className="w-full h-full flex px-[1%] py-0.5 overflow-hidden"
                  style={{
                    alignItems:
                      effectiveField.vAlign === 'top'
                        ? 'flex-start'
                        : effectiveField.vAlign === 'bottom'
                        ? 'flex-end'
                        : 'center',
                    justifyContent:
                      effectiveField.align === 'left'
                        ? 'flex-start'
                        : effectiveField.align === 'right'
                        ? 'flex-end'
                        : 'center',
                  }}
                >
                  <span
                    className="w-full block truncate leading-normal transition-all"
                    style={{
                      fontFamily: effectiveField.fontFamily,
                      fontWeight: effectiveField.isBold ? 700 : 400,
                      fontStyle: effectiveField.isItalic ? 'italic' : 'normal',
                      fontSize: `${screenFontSize}px`,
                      color: effectiveField.color,
                      textAlign: effectiveField.align,
                    }}
                  >
                    {previewName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {/* Font Size Adjustment */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold text-slate-700">Tamaño de Fuente (pt)</label>
                <span className="font-mono font-bold text-[#208077]">
                  {effectiveField.maxFontSize} pt
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCustomField((prev) => ({
                      ...prev,
                      maxFontSize: Math.max(10, effectiveField.maxFontSize - 1),
                    }))
                  }
                  className="p-1.5 border border-slate-300 rounded-lg hover:bg-white text-slate-700 transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min={12}
                  max={72}
                  value={effectiveField.maxFontSize}
                  onChange={(e) =>
                    setCustomField((prev) => ({
                      ...prev,
                      maxFontSize: Number(e.target.value),
                    }))
                  }
                  className="flex-1 accent-[#208077]"
                />
                <button
                  type="button"
                  onClick={() =>
                    setCustomField((prev) => ({
                      ...prev,
                      maxFontSize: Math.min(80, effectiveField.maxFontSize + 1),
                    }))
                  }
                  className="p-1.5 border border-slate-300 rounded-lg hover:bg-white text-slate-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Typography Styles */}
            <div className="space-y-1.5">
              <label className="font-bold text-xs text-slate-700 block">Estilo & Alineación</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setCustomField((prev) => ({
                      ...prev,
                      isBold: !effectiveField.isBold,
                    }))
                  }
                  className={`p-2 rounded-lg border text-xs font-bold transition-all ${
                    effectiveField.isBold
                      ? 'bg-[#208077] text-white border-[#208077] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Negrita"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCustomField((prev) => ({
                      ...prev,
                      isItalic: !effectiveField.isItalic,
                    }))
                  }
                  className={`p-2 rounded-lg border text-xs font-bold transition-all ${
                    effectiveField.isItalic
                      ? 'bg-[#208077] text-white border-[#208077] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Cursiva"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>

                <div className="h-5 w-px bg-slate-300 mx-1" />

                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => setCustomField((prev) => ({ ...prev, align }))}
                    className={`p-2 rounded-lg border text-xs transition-all ${
                      effectiveField.align === align
                        ? 'bg-[#208077] text-white border-[#208077] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                    {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                    {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setCustomField((prev) => ({
                      ...prev,
                      textCase: effectiveField.textCase === 'upper' ? 'title' : 'upper',
                    }))
                  }
                  className={`px-2 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    effectiveField.textCase === 'upper'
                      ? 'border-emerald-500 text-emerald-700 bg-emerald-50 ring-1 ring-emerald-400'
                      : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-50'
                  }`}
                  title="Alternar Mayúsculas"
                >
                  Mayús
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50/70">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={handleResetToDefault}
            disabled={!hasCustomOverrides}
            className="w-full sm:w-auto justify-center"
          >
            Restablecer a global
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-1 sm:flex-none justify-center"
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Check className="w-3.5 h-3.5" />}
              onClick={handleSave}
              className="flex-1 sm:flex-none justify-center"
            >
              Guardar Ajuste
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
