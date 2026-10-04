import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Recipient, TemplateData, FieldBox } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { transformTextCase } from '../../domain/normalization';
import { calculateScreenFontSize } from '../../domain/layout';
import { validateRecipients } from '../../domain/validation';
import { composeCertificatePdf } from '../../infra/pdfComposer';
import { triggerDownload } from '../../infra/zipExporter';
import { IndividualFieldModal } from './IndividualFieldModal';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  ChevronLeft,
  Eye,
  ChevronRight,
  Filter,
  Sliders,
  FileDown,
} from 'lucide-react';

interface ReviewStepProps {
  recipients: Recipient[];
  template: TemplateData;
  field: FieldBox;
  onUpdateRecipient: (updated: Recipient) => void;
  onRemoveRecipient: (id: string) => void;
  onRemoveInvalid: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  recipients,
  template,
  field,
  onUpdateRecipient,
  onRemoveRecipient,
  onRemoveInvalid,
  onBack,
  onContinue,
}) => {
  const [filter, setFilter] = useState<'all' | 'valid' | 'warnings' | 'errors'>('all');
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [customizingRecipient, setCustomizingRecipient] = useState<Recipient | null>(null);
  const [downloadingSample, setDownloadingSample] = useState<boolean>(false);

  // Validación reactiva contra el marco y la tipografía actual
  const validatedRecipients = useMemo(() => {
    const raw = recipients.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      extra: r.extra,
      customField: r.customField,
    }));
    return validateRecipients(raw, {
      field,
      templateWidthPt: template.widthPt,
    });
  }, [recipients, field, template]);

  // Medición subpíxel reactiva del contenedor con ResizeObserver
  useEffect(() => {
    if (!previewContainerRef.current) return;
    const update = () => {
      if (previewContainerRef.current) {
        setContainerWidth(previewContainerRef.current.clientWidth);
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
    observer.observe(previewContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Estadísticas en tiempo real
  const totalCount = validatedRecipients.length;
  const errorCount = validatedRecipients.filter((r) => r.issues.some((i) => i.severity === 'error')).length;
  const warningCount = validatedRecipients.filter(
    (r) =>
      r.issues.some((i) => i.severity === 'warning') &&
      !r.issues.some((i) => i.severity === 'error')
  ).length;
  const validCount = validatedRecipients.filter((r) => r.issues.length === 0).length;

  // Encontrar el nombre más largo
  const longestRecipientIndex = validatedRecipients.reduce((maxIdx, curr, idx, arr) => {
    return curr.name.length > (arr[maxIdx]?.name.length || 0) ? idx : maxIdx;
  }, 0);

  // Destinatario activo en la vista previa
  const safePreviewIndex = validatedRecipients.length > 0
    ? Math.min(Math.max(0, previewIndex), validatedRecipients.length - 1)
    : 0;
  const currentPreviewRecipient = validatedRecipients[safePreviewIndex];

  const filteredRecipients = validatedRecipients.filter((r) => {
    if (filter === 'valid') return r.issues.length === 0;
    if (filter === 'warnings') {
      return (
        r.issues.some((i) => i.severity === 'warning') &&
        !r.issues.some((i) => i.severity === 'error')
      );
    }
    if (filter === 'errors') return r.issues.some((i) => i.severity === 'error');
    return true;
  });

  const effectivePreviewField: FieldBox = currentPreviewRecipient?.customField
    ? { ...field, ...currentPreviewRecipient.customField }
    : field;

  const previewName = currentPreviewRecipient
    ? transformTextCase(currentPreviewRecipient.name, effectivePreviewField.textCase)
    : '';

  const computedFontSize = calculateScreenFontSize(
    previewName,
    effectivePreviewField,
    containerWidth,
    template.widthPt
  );

  const handleDownloadSamplePdf = async () => {
    if (!currentPreviewRecipient) return;
    setDownloadingSample(true);
    try {
      const { pdfBytes, fileName } = await composeCertificatePdf(
        template,
        field,
        currentPreviewRecipient
      );
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      triggerDownload(blob, `Muestra - ${fileName}`);
    } catch (err) {
      console.error('Error generando PDF de muestra:', err);
    } finally {
      setDownloadingSample(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Revisión y validación de datos
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Verifica los nombres antes de generar los PDFs y prueba cómo queda el nombre más largo.
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />} onClick={onBack}>
            Atrás
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={validCount + warningCount === 0}
            onClick={onContinue}
            className="flex-1 sm:flex-none justify-center"
          >
            <span className="hidden sm:inline">Continuar a Generación</span>
            <span className="sm:hidden">Continuar</span> ({validCount + warningCount})
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Lista */}
        <div
          onClick={() => setFilter('all')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-slate-100 border-slate-400 shadow-xs ring-2 ring-slate-300/80'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <span
            className={`text-xs uppercase tracking-wider font-semibold block transition-colors ${
              filter === 'all' ? 'text-slate-800' : 'text-slate-500'
            }`}
          >
            Total Lista
          </span>
          <span className="text-2xl font-bold font-mono text-slate-900 transition-colors">
            {totalCount}
          </span>
        </div>

        {/* Listos ✔ */}
        <div
          onClick={() => setFilter('valid')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            filter === 'valid'
              ? 'bg-slate-100 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs uppercase tracking-wider font-semibold block transition-colors ${
                filter === 'valid' ? 'text-emerald-800' : 'text-slate-500'
              }`}
            >
              Listos ✔
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-500 transition-colors" />
          </div>
          <span className="text-2xl font-bold font-mono text-emerald-600 transition-colors">
            {validCount}
          </span>
        </div>

        {/* Advertencias ⚠ */}
        <div
          onClick={() => setFilter('warnings')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            filter === 'warnings'
              ? 'bg-slate-100 border-amber-500 shadow-xs ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs uppercase tracking-wider font-semibold block transition-colors ${
                filter === 'warnings' ? 'text-amber-800' : 'text-slate-500'
              }`}
            >
              Advertencias ⚠
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500 transition-colors" />
          </div>
          <span className="text-2xl font-bold font-mono text-amber-600 transition-colors">
            {warningCount}
          </span>
        </div>

        {/* Errores ✖ */}
        <div
          onClick={() => setFilter('errors')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            filter === 'errors'
              ? 'bg-slate-100 border-rose-500 shadow-xs ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs uppercase tracking-wider font-semibold block transition-colors ${
                filter === 'errors' ? 'text-rose-800' : 'text-slate-500'
              }`}
            >
              Errores ✖
            </span>
            <XCircle className="w-4 h-4 text-rose-500 transition-colors" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-rose-600 transition-colors">
              {errorCount}
            </span>
            {errorCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveInvalid();
                }}
                className={`text-[11px] font-semibold hover:underline transition-colors ${
                  filter === 'errors'
                    ? 'text-rose-300 hover:text-white'
                    : 'text-rose-600 hover:text-rose-700'
                }`}
              >
                Descartar errores
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recipients Table */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-700">Filtro actual:</span>
                <span className="text-xs font-semibold text-brand-600 uppercase">
                  {filter === 'all'
                    ? 'Todos los registros'
                    : filter === 'valid'
                    ? 'Solo listos (válidos)'
                    : filter === 'warnings'
                    ? 'Solo advertencias'
                    : 'Solo errores'}
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {filteredRecipients.length} de {totalCount}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[440px]">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left w-10">#</th>
                    <th className="px-3 py-2 text-left">Nombre del Destinatario</th>
                    <th className="px-3 py-2 text-left w-28">Estado</th>
                    <th className="px-3 py-2 text-center w-20">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRecipients.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs font-medium">
                        No hay registros para este filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredRecipients.map((rec) => {
                    const hasError = rec.issues.some((i) => i.severity === 'error');
                    const hasWarning = rec.issues.some((i) => i.severity === 'warning');
                    const isSelectedInPreview = currentPreviewRecipient?.id === rec.id;
                    const targetIdx = validatedRecipients.findIndex((r) => r.id === rec.id);

                    return (
                      <tr
                        key={rec.id}
                        onClick={() => {
                          if (targetIdx !== -1) setPreviewIndex(targetIdx);
                        }}
                        className={`cursor-pointer transition-all ${
                          isSelectedInPreview
                            ? 'bg-brand-50/90 ring-1 ring-inset ring-brand-400/50 shadow-sm'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="px-3 py-2 text-slate-400 font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            {isSelectedInPreview && (
                              <Eye className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 animate-pulse" />
                            )}
                            <span>{rec.rowNumber}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          <input
                            type="text"
                            value={rec.name}
                            onChange={(e) =>
                              onUpdateRecipient({ ...rec, name: e.target.value })
                            }
                            onFocus={() => {
                              if (targetIdx !== -1) setPreviewIndex(targetIdx);
                            }}
                            onClick={() => {
                              if (targetIdx !== -1) setPreviewIndex(targetIdx);
                            }}
                            placeholder="Nombre del destinatario"
                            title="Haz clic para editar el nombre o ver en el certificado"
                            className="w-full bg-white/70 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 rounded-md px-2 py-1 transition-all text-xs font-semibold text-slate-900 shadow-xs"
                          />
                          {rec.email && (
                            <span className="block text-[11px] text-slate-400 font-normal px-1 mt-0.5">
                              {rec.email}
                            </span>
                          )}
                          {rec.issues.length > 0 && (
                            <span className="block text-[10px] text-amber-600 mt-0.5 px-1 font-medium">
                              {rec.issues.map((i) => i.message).join(' • ')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {hasError ? (
                            <Badge variant="error" size="sm">
                              Error
                            </Badge>
                          ) : hasWarning ? (
                            <Badge variant="warning" size="sm">
                              Aviso
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm">
                              Válido
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCustomizingRecipient(rec)}
                              className={`p-1 rounded-lg transition-colors ${
                                rec.customField && Object.keys(rec.customField).length > 0
                                  ? 'text-brand-600 bg-brand-50 hover:bg-brand-100 ring-1 ring-brand-300'
                                  : 'text-slate-400 hover:text-brand-600 hover:bg-slate-100'
                              }`}
                              title="Ajuste individual de diseño (tamaño de fuente, posición)"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveRecipient(rec.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                              title="Eliminar fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Live Preview & Longest Name Test */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-brand-600" />
                  Vista previa real del certificado
                </span>
                {currentPreviewRecipient?.customField &&
                  Object.keys(currentPreviewRecipient.customField).length > 0 && (
                    <span className="text-[10px] bg-brand-50 text-brand-700 font-semibold px-1.5 py-0.5 rounded border border-brand-200">
                      Personalizado
                    </span>
                  )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<FileDown className="w-3.5 h-3.5 text-brand-600" />}
                  onClick={handleDownloadSamplePdf}
                  isLoading={downloadingSample}
                  title="Descargar este certificado como archivo PDF para ver el resultado real"
                >
                  Descargar PDF
                </Button>
                <div className="h-4 w-px bg-slate-200 mx-0.5" />
                <button
                  onClick={() => setPreviewIndex(0)}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all ${
                    safePreviewIndex === 0
                      ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Primero
                </button>
                <button
                  onClick={() => setPreviewIndex(longestRecipientIndex)}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all ${
                    safePreviewIndex === longestRecipientIndex
                      ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Más largo
                </button>
              </div>
            </div>

            {/* Template with live stamped name */}
            {currentPreviewRecipient?.issues.some((i) => i.code === 'TEXT_OVERFLOW') && (
              <div className="mb-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex items-center justify-between gap-2 shadow-2xs animate-fadeIn">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {currentPreviewRecipient.issues.find((i) => i.code === 'TEXT_OVERFLOW')?.message}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomizingRecipient(currentPreviewRecipient)}
                  className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline shrink-0 cursor-pointer"
                >
                  Ajustar
                </button>
              </div>
            )}
            <div
              ref={previewContainerRef}
              className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 shadow-md select-none"
              style={{ aspectRatio: `${template.widthPt} / ${template.heightPt}` }}
            >
              <img
                src={template.previewUrl}
                alt="Vista previa"
                className="w-full h-full object-contain pointer-events-none"
              />

              {/* Dynamic Name Box */}
              <div
                style={{
                  left: `${effectivePreviewField.x * 100}%`,
                  top: `${effectivePreviewField.y * 100}%`,
                  width: `${effectivePreviewField.width * 100}%`,
                  height: `${effectivePreviewField.height * 100}%`,
                }}
                className="absolute flex pointer-events-none"
              >
                <div
                  className="w-full h-full flex px-[1%] py-0.5 overflow-hidden"
                  style={{
                    alignItems:
                      effectivePreviewField.vAlign === 'top'
                        ? 'flex-start'
                        : effectivePreviewField.vAlign === 'bottom'
                        ? 'flex-end'
                        : 'center',
                    justifyContent:
                      effectivePreviewField.align === 'left'
                        ? 'flex-start'
                        : effectivePreviewField.align === 'right'
                        ? 'flex-end'
                        : 'center',
                  }}
                >
                  <span
                    className="w-full block leading-normal select-none transition-all py-0.5 px-0.5 whitespace-nowrap overflow-visible"
                    style={{
                      fontFamily: effectivePreviewField.fontFamily,
                      fontWeight: effectivePreviewField.isBold ? 700 : 400,
                      fontStyle: effectivePreviewField.isItalic ? 'italic' : 'normal',
                      fontSize: `${computedFontSize}px`,
                      color: effectivePreviewField.color,
                      textAlign: effectivePreviewField.align,
                    }}
                  >
                    {previewName || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation controls */}
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-3">
              <button
                disabled={safePreviewIndex === 0}
                onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
              </button>
              <span className="font-mono text-slate-500 font-medium">
                {validatedRecipients.length > 0 ? safePreviewIndex + 1 : 0} de {validatedRecipients.length}
              </span>
              <button
                disabled={safePreviewIndex >= validatedRecipients.length - 1}
                onClick={() => setPreviewIndex((prev) => Math.min(validatedRecipients.length - 1, prev + 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
              >
                Siguiente <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Modal de ajuste individual para el destinatario */}
      <IndividualFieldModal
        isOpen={Boolean(customizingRecipient)}
        recipient={customizingRecipient}
        baseField={field}
        template={template}
        onClose={() => setCustomizingRecipient(null)}
        onSave={(newCustomField) => {
          if (customizingRecipient) {
            onUpdateRecipient({
              ...customizingRecipient,
              customField: newCustomField,
            });
          }
        }}
      />
    </div>
  );
};
