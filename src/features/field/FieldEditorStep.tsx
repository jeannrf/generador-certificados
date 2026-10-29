import React, { useState, useRef, useEffect } from 'react';
import { TemplateData, FieldBox, TextAlign } from '../../domain/types';
import { Card } from '../../ui/Card';
import { StepActions } from '../../ui/StepActions';
import { PageTabs } from '../../ui/PageTabs';
import { FieldTextOverlay } from '../../ui/FieldTextOverlay';
import { transformTextCase } from '../../domain/normalization';
import { calculateScreenFontSize } from '../../domain/layout';
import {
  autoAssignColumns,
  createNameField,
  createQrField,
  createTextField,
  defaultNameFontSize,
  fieldsForPage,
  getNameField,
  isNameField,
  isQrField,
  NAME_FIELD_ID,
  resetNameFieldLayout,
} from '../../domain/fields';
import { SAMPLE_DRIVE_URL } from '../../domain/drive';
import { fieldFontVariant, findCatalogFont, supportsBold, supportsItalic } from '../../domain/fonts';
import { loadFieldFontsForPreview } from '../../infra/fontLoader';
import { FontPicker } from '../../ui/FontPicker';
import { QrPreview } from '../../ui/QrPreview';
import { ColorPopover } from '../../ui/ColorPopover';
import { createUndoHistory } from '../../shared/undoHistory';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Plus,
  ListPlus,
  Trash2,
  Undo2,
  Redo2,
  QrCode,
} from 'lucide-react';

interface FieldEditorStepProps {
  template: TemplateData;
  fields: FieldBox[];
  onFieldsChange: (fields: FieldBox[]) => void;
  /** Columnas de la lista si ya se cargó (Paso 3), para sugerirlas */
  availableColumns: string[];
  /** Primera fila de la lista, para previsualizar los campos de columna */
  sampleRow?: Record<string, string>;
  onBack: () => void;
  onContinue: () => void;
}

const toolButton =
  'inline-flex min-h-8 items-center gap-1 rounded-[6px] border border-slate-300 bg-white px-2.5 text-xs font-semibold text-[#0F2E2B] transition-colors hover:border-[#208077] hover:text-[#208077] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077]';
const iconToolButton =
  'flex h-8 w-8 items-center justify-center rounded-[6px] border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-[#0F2E2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077] disabled:cursor-not-allowed disabled:opacity-40';

export const FieldEditorStep: React.FC<FieldEditorStepProps> = ({
  template,
  fields,
  onFieldsChange,
  availableColumns,
  sampleRow,
  onBack,
  onContinue,
}) => {
  const [selectedFieldId, setSelectedFieldId] = useState<string>(NAME_FIELD_ID);
  const field =
    fields.find((f) => f.id === selectedFieldId) ?? getNameField(fields) ?? createNameField(template.pages[0].id, template.pages[0]);
  const [currentPageId, setCurrentPageId] = useState<string>(field.pageId);
  const page = template.pages.find((p) => p.id === currentPageId) ?? template.pages[0];
  const isFieldOnPage = field.pageId === page.id;
  const pageFields = fieldsForPage(fields, page.id);

  // Deshacer/rehacer: todo cambio de campos pasa por commitFields para quedar en el historial
  const historyRef = useRef(createUndoHistory<FieldBox[]>());
  const [, setHistoryVersion] = useState(0);
  const commitFields = (next: FieldBox[], mergeable = true) => {
    historyRef.current.record(fields, mergeable);
    setHistoryVersion((v) => v + 1);
    onFieldsChange(next);
  };
  const handleUndo = () => {
    const previous = historyRef.current.undo(fields);
    if (!previous) return;
    onFieldsChange(previous);
    setHistoryVersion((v) => v + 1);
  };
  const handleRedo = () => {
    const next = historyRef.current.redo(fields);
    if (!next) return;
    onFieldsChange(next);
    setHistoryVersion((v) => v + 1);
  };

  const onFieldChange = (updated: FieldBox) => {
    commitFields(fields.map((f) => (f.id === updated.id ? updated : f)));
  };

  const selectField = (target: FieldBox) => {
    setSelectedFieldId(target.id);
    setCurrentPageId(target.pageId);
  };

  const handlePageSelect = (pageId: string) => {
    setCurrentPageId(pageId);
    const first = fieldsForPage(fields, pageId)[0];
    if (first) setSelectedFieldId(first.id);
  };

  const handleAddField = () => {
    const created = createTextField(page.id, fields);
    commitFields([...fields, created], false);
    setSelectedFieldId(created.id);
  };

  const handleAddQr = () => {
    const created = createQrField(page, fields);
    commitFields([...fields, created], false);
    setSelectedFieldId(created.id);
  };

  const handleDeleteField = (target: FieldBox) => {
    if (isNameField(target)) return;
    commitFields(fields.filter((f) => f.id !== target.id), false);
    if (target.id === selectedFieldId) setSelectedFieldId(NAME_FIELD_ID);
  };

  /** Texto con el que se previsualiza un campo en el editor */
  const sampleTextFor = (target: FieldBox): string => {
    if (isNameField(target)) return sampleName;
    switch (target.source.type) {
      case 'fixed':
        return target.source.value;
      case 'driveLink':
        return SAMPLE_DRIVE_URL;
      case 'column':
        return sampleRow?.[target.source.column] || `{${target.source.column || 'columna'}}`;
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [sampleName, setSampleName] = useState('Jeanpier Alexander Robles Fabian');
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isSnappedToCenterX, setIsSnappedToCenterX] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0, fieldX: 0, fieldY: 0, width: 0, height: 0 });
  const previewText = transformTextCase(sampleTextFor(field), field.textCase);
  const currentFont = findCatalogFont(field.fontFamily);
  // Tamaño de referencia de la página visible: guía el botón "Restablecer" y el tope del control deslizante
  const defaultFontSize = defaultNameFontSize(page);
  const maxSliderFontSize = Math.max(72, defaultFontSize * 2);
  const boldAvailable = !currentFont || supportsBold(currentFont);
  const italicAvailable = !currentFont || supportsItalic(currentFont);

  // Cargar las fuentes de todos los campos para que la vista previa coincida con el PDF
  useEffect(() => {
    loadFieldFontsForPreview(fields);
  }, [fields]);

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
    page.widthPt
  );

  // Atajos de teclado: Ctrl+Z / Ctrl+Shift+Z (o Ctrl+Y), Supr/Retroceso para borrar el campo
  // y flechas para moverlo (1px por pulsación, Shift + Flechas = 10px)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Mientras se escribe en un input, textarea o select, las teclas hacen lo de siempre
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

      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'y')) {
        e.preventDefault();
        if (key === 'y' || e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      // El campo seleccionado está en otra página: no hay nada visible que borrar ni mover
      if (!isFieldOnPage) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isNameField(field)) {
        e.preventDefault();
        handleDeleteField(field);
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
  });

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
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Ubica los datos en tu diseño</h2>
        <p className="mt-1 text-sm text-slate-600">
          Arrastra el recuadro del nombre a su lugar. Agrega curso, fecha o un QR si tu certificado los lleva.
        </p>
      </div>
      <StepActions onBack={onBack} primaryLabel="Continuar" onPrimary={onContinue} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Interactive Canvas / Visual Template Editor */}
        <div className="lg:col-span-8">
          <Card className="p-4 sm:p-5 overflow-hidden">
            {/* Pestañas de página a la izquierda y acciones a la derecha, en la misma fila */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 text-xs text-slate-500 font-medium">
              <PageTabs
                pages={template.pages}
                currentPageId={page.id}
                onSelect={handlePageSelect}
                fieldCounts={Object.fromEntries(template.pages.map((p) => [p.id, fieldsForPage(fields, p.id).length]))}
              />
              <div className="flex items-center gap-2 sm:ml-auto shrink-0">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!historyRef.current.canUndo()}
                  title="Deshacer (Ctrl+Z)"
                  aria-label="Deshacer"
                  className={iconToolButton}
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!historyRef.current.canRedo()}
                  title="Rehacer (Ctrl+Shift+Z)"
                  aria-label="Rehacer"
                  className={iconToolButton}
                >
                  <Redo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCenterField}
                  className={toolButton}
                  title="Centrar el campo en el ancho de la página"
                >
                  Centrar
                </button>
                {isNameField(field) && (
                <button
                  type="button"
                  onClick={() => onFieldChange(resetNameFieldLayout(field, page))}
                  className={toolButton}
                  title={`Restablecer al tamaño estándar para esta página (${defaultFontSize} pt, 90% de ancho)`}
                >
                  Restablecer ({defaultFontSize} pt)
                </button>
                )}
              </div>
            </div>

            {/* Template Container with overlay box */}
            <div
              ref={containerRef}
              className="relative w-full rounded-[6px] overflow-hidden border border-slate-300 bg-white select-none touch-none"
              style={{ aspectRatio: `${page.widthPt} / ${page.heightPt}` }}
            >
              <img
                src={page.previewUrl}
                alt={`Página ${template.pages.indexOf(page) + 1} de la plantilla`}
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />

              {/* Demás campos de esta página: clic para seleccionarlos */}
              {pageFields
                .filter((f) => f.id !== field.id)
                .map((other) => {
                  const otherText = transformTextCase(sampleTextFor(other), other.textCase);
                  return (
                    <FieldTextOverlay
                      key={other.id}
                      field={other}
                      text={otherText}
                      fontSizePx={calculateScreenFontSize(otherText, other, containerWidth, page.widthPt)}
                      title={`Seleccionar "${other.name}"`}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        selectField(other);
                      }}
                      boxClassName="cursor-pointer border border-dashed border-slate-500/60 hover:border-[#208077] hover:bg-[#208077]/5 rounded-sm"
                    />
                  );
                })}

              {pageFields.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                  <div className="pointer-events-auto max-w-xs rounded-[6px] border border-slate-200 bg-white px-4 py-3 text-center shadow-[0_8px_24px_-12px_rgba(15,46,43,0.35)]">
                    <p className="text-sm font-semibold text-[#0F2E2B]">Esta página no tiene campos</p>
                    <p className="mt-0.5 text-sm text-slate-600">Se incluirá igual en cada certificado, como un reverso fijo.</p>
                    <button
                      type="button"
                      onClick={handleAddField}
                      className={`mt-2 ${toolButton}`}
                    >
                      <ListPlus className="w-3.5 h-3.5" /> Agregar un campo aquí
                    </button>
                  </div>
                </div>
              )}

              {/* Red Vertical Snapping Guide Line (Guía de centro en rojo) */}
              {(isSnappedToCenterX || (isDragging && Math.abs(field.x + field.width / 2 - 0.5) < 0.005)) && (
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-rose-500 z-30 pointer-events-none flex flex-col items-center py-2">
                  <span className="rounded-[4px] bg-rose-600 px-1.5 py-0.5 text-xs font-semibold text-white">Centro</span>
                </div>
              )}

              {/* Bounding Box for the selected field */}
              {isFieldOnPage && (
              <div
                onPointerDown={(e) => handlePointerDown(e, 'drag')}
                style={{
                  left: `${field.x * 100}%`,
                  top: `${field.y * 100}%`,
                  width: `${field.width * 100}%`,
                  height: `${field.height * 100}%`,
                }}
                className={`absolute cursor-move border-2 border-[#208077] bg-[#208077]/10 rounded-sm flex transition-shadow ${
                  isDragging ? 'shadow-2xl ring-4 ring-[#b2e5df]/60 bg-[#208077]/20' : 'hover:border-[#18655e]'
                }`}
              >
                {/* Live text (or QR) inside the box */}
                {isQrField(field) ? (
                  <div className="w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">
                    <QrPreview text={previewText} color={field.color} className="h-full max-w-full aspect-square" />
                  </div>
                ) : (
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
                      fontWeight: fieldFontVariant(field).weight,
                      fontStyle: fieldFontVariant(field).italic ? 'italic' : 'normal',
            fontSynthesis: 'none',
                      fontSize: `${screenFontSize}px`,
                      color: field.color,
                      textAlign: field.align,
                    }}
                  >
                    {previewText || (isNameField(field) ? 'Jeanpier Alexander Robles Fabian' : field.name)}
                  </span>
                </div>
                )}

                {/* Corner Resize Handles (Canva / PowerPoint style) */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'nw')}
                  title="Redimensionar esquina superior izquierda"
                  className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-[#208077] rounded-full cursor-nwse-resize shadow-sm hover:scale-125 transition-transform after:absolute after:-inset-2.5 after:content-['']"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'ne')}
                  title="Redimensionar esquina superior derecha"
                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-[#208077] rounded-full cursor-nesw-resize shadow-sm hover:scale-125 transition-transform after:absolute after:-inset-2.5 after:content-['']"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'sw')}
                  title="Redimensionar esquina inferior izquierda"
                  className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-white border-2 border-[#208077] rounded-full cursor-nesw-resize shadow-sm hover:scale-125 transition-transform after:absolute after:-inset-2.5 after:content-['']"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'se')}
                  title="Redimensionar esquina inferior derecha"
                  className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-white border-2 border-[#208077] rounded-full cursor-nwse-resize shadow-sm hover:scale-125 transition-transform after:absolute after:-inset-2.5 after:content-['']"
                />

                {/* Edge Resize Handles (Top, Bottom, Left, Right) */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'n')}
                  title="Ajustar altura (superior)"
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border border-[#208077] rounded-full cursor-ns-resize hover:bg-[#b2e5df] hover:scale-110 transition-transform"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 's')}
                  title="Ajustar altura (inferior)"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-white border border-[#208077] rounded-full cursor-ns-resize hover:bg-[#b2e5df] hover:scale-110 transition-transform"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'w')}
                  title="Ajustar ancho (izquierda)"
                  className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-6 bg-white border border-[#208077] rounded-full cursor-ew-resize hover:bg-[#b2e5df] hover:scale-110 transition-transform"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'e')}
                  title="Ajustar ancho (derecha)"
                  className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-6 bg-white border border-[#208077] rounded-full cursor-ew-resize hover:bg-[#b2e5df] hover:scale-110 transition-transform"
                />
              </div>
              )}
            </div>
          </Card>
        </div>

        {/* Styling Controls Sidebar (Right Column) */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F2E2B]">Campos</h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleAddField}
                  className={toolButton}
                  title="Agregar un campo de texto en la página visible"
                >
                  <ListPlus className="w-4 h-4" aria-hidden="true" /> Texto
                </button>
                <button
                  type="button"
                  onClick={handleAddQr}
                  className={toolButton}
                  title="Agregar un código QR en la página visible"
                >
                  <QrCode className="w-4 h-4" aria-hidden="true" /> QR
                </button>
              </div>
            </div>

            <ul className="space-y-1.5">
              {fields.map((f) => {
                const pageNumber = template.pages.findIndex((p) => p.id === f.pageId) + 1;
                const isSelected = f.id === field.id;
                return (
                  <li key={f.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => selectField(f)}
                      aria-pressed={isSelected}
                      className={`flex-1 min-w-0 flex items-center justify-between gap-2 px-3 py-2 rounded-[6px] border text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077] ${
                        isSelected ? 'border-[#208077] bg-[#F4F8F7] text-[#0F2E2B]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate font-semibold flex items-center gap-1.5">
                        {isQrField(f) && <QrCode className="w-3.5 h-3.5 shrink-0 text-slate-500" aria-hidden />}
                        {f.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-slate-500">Pág. {pageNumber}</span>
                    </button>
                    {!isNameField(f) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteField(f)}
                        className="flex h-8 w-8 items-center justify-center rounded-[6px] text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        title={`Eliminar "${f.name}"`}
                        aria-label={`Eliminar campo ${f.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Configuración del campo seleccionado (el nombre no tiene opciones aquí) */}
            {!isNameField(field) && (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              {!isNameField(field) && (
                <>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-slate-700">Nombre del campo</span>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => onFieldChange({ ...field, name: e.target.value })}
                      className="w-full text-xs font-medium bg-white border border-slate-200 rounded-[6px] px-2.5 py-1.5 focus:ring-2 focus:ring-[#208077] focus:outline-none"
                      placeholder="Curso, Fecha, Horas…"
                    />
                  </label>

                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-slate-700">{isQrField(field) ? 'Contenido del QR' : 'Texto'}</span>
                    <div
                      className={`grid ${isQrField(field) ? 'grid-cols-3' : 'grid-cols-2'} gap-1 p-1 bg-white rounded-[6px] border border-slate-200`}
                      role="radiogroup"
                      aria-label={isQrField(field) ? 'Contenido del QR' : 'Origen del texto'}
                    >
                      {[
                        ...(isQrField(field) ? [{ type: 'driveLink' as const, label: 'PDF en Drive' }] : []),
                        { type: 'column' as const, label: isQrField(field) ? 'Columna' : 'Columna de la lista' },
                        { type: 'fixed' as const, label: 'Texto fijo' },
                      ].map((option) => (
                        <button
                          key={option.type}
                          type="button"
                          role="radio"
                          aria-checked={field.source.type === option.type}
                          onClick={() =>
                            onFieldChange(
                              option.type === 'driveLink'
                                ? { ...field, source: { type: 'driveLink' } }
                                : option.type === 'column'
                                ? // Si la lista ya está cargada, se busca la columna que se llame como el campo
                                  autoAssignColumns([{ ...field, source: { type: 'column', column: '' } }], availableColumns)[0]
                                : { ...field, source: { type: 'fixed', value: isQrField(field) ? '' : field.name } }
                            )
                          }
                          className={`px-2 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                            field.source.type === option.type ? 'bg-[#208077] text-white' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {field.source.type === 'column' &&
                      (availableColumns.length > 0 ? (
                        <>
                          <select
                            value={field.source.column}
                            onChange={(e) => onFieldChange({ ...field, source: { type: 'column', column: e.target.value } })}
                            aria-label="Columna de la lista"
                            className="w-full text-xs font-medium bg-white border border-slate-200 rounded-[6px] px-2 py-1.5 focus:ring-2 focus:ring-[#208077] focus:outline-none"
                          >
                            <option value="">Elige una columna</option>
                            {availableColumns.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-slate-500">Cada certificado mostrará el valor de esta columna.</p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-500 bg-white border border-dashed border-slate-300 rounded-[6px] px-2.5 py-2">
                          Elegirás qué columna usar cuando subas tu lista en el Paso 3.
                        </p>
                      ))}
                    {field.source.type === 'fixed' && (
                      <input
                        type="text"
                        value={field.source.value}
                        onChange={(e) => onFieldChange({ ...field, source: { type: 'fixed', value: e.target.value } })}
                        className="w-full text-xs font-medium bg-white border border-slate-200 rounded-[6px] px-2.5 py-1.5 focus:ring-2 focus:ring-[#208077] focus:outline-none"
                        placeholder={isQrField(field) ? 'Enlace o texto, igual para todos' : 'Igual en todos los certificados'}
                        aria-label="Texto fijo"
                      />
                    )}
                    {field.source.type === 'driveLink' && (
                      <p className="text-xs text-slate-500">
                        Cada QR abrirá el PDF de esa persona. Se guarda en tu Google Drive en el Paso 5.
                      </p>
                    )}
                  </div>

                  {isQrField(field) && (
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">Color del QR</span>
                      <input
                        type="color"
                        value={field.color}
                        onChange={(e) => onFieldChange({ ...field, color: e.target.value })}
                        className="w-8 h-8 rounded-[6px] border border-slate-200 cursor-pointer p-0.5 bg-white"
                        aria-label="Color del QR"
                      />
                    </label>
                  )}
                </>
              )}

            </div>
            )}
          </Card>

          {!isQrField(field) && (
          <Card className="p-4 space-y-3.5">
            <h3 className="text-base font-bold text-[#0F2E2B] truncate">
              Tipografía <span className="font-normal text-slate-600">· {field.name}</span>
            </h3>

            {/* Texto de prueba para previsualizar el nombre */}
            {isNameField(field) && (
              <input
                type="text"
                value={sampleName}
                onChange={(e) => setSampleName(e.target.value)}
                aria-label="Texto de prueba"
                title="Texto de prueba"
                className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded-[6px] px-2.5 py-1.5 focus:ring-2 focus:ring-[#208077] focus:outline-none"
                placeholder="Escribe un nombre de prueba"
              />
            )}

            {/* Font Family */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Fuente</label>
              <FontPicker
                value={field.fontFamily}
                onChange={(fontFamily) => onFieldChange({ ...field, fontFamily })}
              />
            </div>

            {/* Compact Typography Toolbar: Style (B, I, Mayús) + Alignment */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Estilo y alineación</span>
              </div>
              <div className="flex items-center justify-between gap-1 p-1 bg-slate-100 rounded-[6px] border border-slate-200">
                {/* Bold, Italic & Mayús Toggle */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title={boldAvailable ? 'Negrita (Bold)' : 'Esta fuente no tiene negrita'}
                    disabled={!boldAvailable}
                    onClick={() => onFieldChange({ ...field, isBold: !field.isBold })}
                    className={`w-8 h-8 flex items-center justify-center rounded-[6px] text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      field.isBold && boldAvailable
                        ? 'bg-[#208077] text-white font-extrabold shadow-sm'
                        : 'bg-white text-slate-700 hover:bg-slate-50 font-bold border border-slate-200'
                    }`}
                  >
                    B
                  </button>

                  <button
                    type="button"
                    title={italicAvailable ? 'Cursiva (Italic)' : 'Esta fuente no tiene cursiva'}
                    disabled={!italicAvailable}
                    onClick={() => onFieldChange({ ...field, isItalic: !field.isItalic })}
                    className={`w-8 h-8 flex items-center justify-center rounded-[6px] text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      field.isItalic && italicAvailable
                        ? 'bg-[#208077] text-white font-serif italic font-bold shadow-sm'
                        : 'bg-white text-slate-700 hover:bg-slate-50 font-serif italic font-bold border border-slate-200'
                    }`}
                  >
                    I
                  </button>

                  {/* Mayúsculas: mismo patrón de botón activable que negrita y cursiva */}
                  <button
                    type="button"
                    aria-pressed={field.textCase === 'upper'}
                    aria-label="Mayúsculas"
                    title={field.textCase === 'upper' ? 'Mayúsculas activadas' : 'Escribir en mayúsculas'}
                    onClick={() =>
                      onFieldChange({
                        ...field,
                        textCase: field.textCase === 'upper' ? 'title' : 'upper',
                      })
                    }
                    className={`w-8 h-8 flex items-center justify-center rounded-[6px] text-xs font-bold transition-all ${
                      field.textCase === 'upper'
                        ? 'bg-[#208077] text-white'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    {field.textCase === 'upper' ? 'AA' : 'Aa'}
                  </button>

                  <ColorPopover value={field.color} onChange={(color) => onFieldChange({ ...field, color })} />
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
                        className={`w-8 h-8 flex items-center justify-center rounded-[6px] transition-all ${
                          isSelected
                            ? 'bg-[#208077] text-white shadow-sm'
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
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-[6px] px-2 py-0.5 focus-within:ring-2 focus-within:ring-[#208077] focus-within:border-[#208077]">
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={field.maxFontSize}
                    onChange={(e) => {
                      const val = Math.max(8, Math.min(120, Number(e.target.value) || 12));
                      onFieldChange({
                        ...field,
                        maxFontSize: val,
                        minFontSize: Math.min(val, field.minFontSize),
                      });
                    }}
                    className="w-10 text-xs font-bold text-[#208077] text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-xs font-semibold text-slate-400">pt</span>
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
                  className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-[6px] transition-colors"
                  title="Reducir 1 pt"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min="12"
                  max={maxSliderFontSize}
                  value={field.maxFontSize}
                  onChange={(e) => {
                    const nextVal = Number(e.target.value);
                    onFieldChange({
                      ...field,
                      maxFontSize: nextVal,
                      minFontSize: Math.min(nextVal, field.minFontSize),
                    });
                  }}
                  className="flex-1 accent-[#208077] cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = Math.min(120, field.maxFontSize + 1);
                    onFieldChange({
                      ...field,
                      maxFontSize: nextVal,
                      minFontSize: Math.min(nextVal, field.minFontSize),
                    });
                  }}
                  className="p-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-[6px] transition-colors"
                  title="Aumentar 1 pt"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </Card>
          )}
        </div>
      </div>
    </div>
  );
};
