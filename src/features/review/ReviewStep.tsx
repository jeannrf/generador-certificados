import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Recipient, TemplateData, FieldBox } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { StepActions } from '../../ui/StepActions';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Badge } from '../../ui/Badge';
import { transformTextCase } from '../../domain/normalization';
import { calculateScreenFontSize } from '../../domain/layout';
import { validateRecipients } from '../../domain/validation';
import {
  applyRecipientOverrides,
  buildValidationOptions,
  createNameField,
  fieldsForPage,
  getNameField,
  resolveFieldText,
} from '../../domain/fields';
import { getPageForField } from '../../domain/templatePages';
import { SAMPLE_DRIVE_URL } from '../../domain/drive';

// En la revisión todavía no existen los archivos en Drive: el QR usa una URL de ejemplo
const PREVIEW_CONTEXT = { driveUrl: SAMPLE_DRIVE_URL };
import { FieldTextOverlay } from '../../ui/FieldTextOverlay';
import { loadFieldFontsForPreview } from '../../infra/fontLoader';
import { PageTabs } from '../../ui/PageTabs';
import { composeCertificatePdf } from '../../infra/pdfComposer';
import { triggerDownload } from '../../infra/zipExporter';
import { IndividualFieldModal } from './IndividualFieldModal';
import { AlertTriangle, XCircle, Trash2, ChevronLeft, ChevronRight, Sliders, FileDown } from 'lucide-react';

type StatusFilter = 'all' | 'valid' | 'warnings' | 'errors';

interface ReviewStepProps {
  recipients: Recipient[];
  template: TemplateData;
  fields: FieldBox[];
  onUpdateRecipient: (updated: Recipient) => void;
  onRemoveRecipient: (id: string) => void;
  onRemoveRecipients: (ids: string[]) => void;
  onBack: () => void;
  onContinue: () => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  recipients,
  template,
  fields,
  onUpdateRecipient,
  onRemoveRecipient,
  onRemoveRecipients,
  onBack,
  onContinue,
}) => {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [customizingRecipient, setCustomizingRecipient] = useState<Recipient | null>(null);
  const [downloadingSample, setDownloadingSample] = useState<boolean>(false);
  const [confirmingRemoveErrors, setConfirmingRemoveErrors] = useState<boolean>(false);
  const nameField = getNameField(fields) ?? createNameField(template.pages[0].id, template.pages[0]);
  const namePage = getPageForField(template, nameField);
  const [previewPageId, setPreviewPageId] = useState<string>(namePage.id);
  const previewPage = template.pages.find((p) => p.id === previewPageId) ?? namePage;

  // Validación reactiva contra el marco y la tipografía actual
  const validatedRecipients = useMemo(() => {
    const raw = recipients.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      extra: r.extra,
      customField: r.customField,
    }));
    return validateRecipients(raw, buildValidationOptions(template, fields));
  }, [recipients, fields, template]);

  useEffect(() => {
    loadFieldFontsForPreview(fields);
  }, [fields]);

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

  const hasError = (r: Recipient) => r.issues.some((i) => i.severity === 'error');
  const hasOnlyWarnings = (r: Recipient) => !hasError(r) && r.issues.some((i) => i.severity === 'warning');

  // Estadísticas en tiempo real
  const totalCount = validatedRecipients.length;
  const errorRecipients = validatedRecipients.filter(hasError);
  const errorCount = errorRecipients.length;
  const warningCount = validatedRecipients.filter(hasOnlyWarnings).length;
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
    if (filter === 'warnings') return hasOnlyWarnings(r);
    if (filter === 'errors') return hasError(r);
    return true;
  });

  const filterOptions: { value: StatusFilter; label: string; count: number; dot?: string }[] = [
    { value: 'all', label: 'Todos', count: totalCount },
    { value: 'valid', label: 'Listos', count: validCount, dot: 'bg-[#208077]' },
    { value: 'warnings', label: 'Con aviso', count: warningCount, dot: 'bg-amber-500' },
    { value: 'errors', label: 'Con error', count: errorCount, dot: 'bg-rose-500' },
  ];

  // Todos los campos de la página visible, con el texto y los ajustes de la persona seleccionada
  const previewOverlays = currentPreviewRecipient
    ? fieldsForPage(fields, previewPage.id).map((baseField) => {
        const field = applyRecipientOverrides(baseField, currentPreviewRecipient);
        const text = transformTextCase(resolveFieldText(field, currentPreviewRecipient, PREVIEW_CONTEXT), field.textCase);
        return {
          field,
          text,
          fontSizePx: calculateScreenFontSize(text, field, containerWidth, previewPage.widthPt),
        };
      })
    : [];

  const handleDownloadSamplePdf = async () => {
    if (!currentPreviewRecipient) return;
    setDownloadingSample(true);
    try {
      const { pdfBytes, fileName } = await composeCertificatePdf(
        template,
        fields,
        currentPreviewRecipient,
        undefined,
        PREVIEW_CONTEXT
      );
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      triggerDownload(blob, `Muestra - ${fileName}`);
    } catch (err) {
      console.error('Error generando PDF de muestra:', err);
    } finally {
      setDownloadingSample(false);
    }
  };

  const selectRecipient = (id: string) => {
    const idx = validatedRecipients.findIndex((r) => r.id === id);
    if (idx !== -1) setPreviewIndex(idx);
  };

  const hasCustomField = (r: Recipient | undefined) => Boolean(r?.customField && Object.keys(r.customField).length > 0);
  const overflowIssue = currentPreviewRecipient?.issues.find((i) => i.code === 'TEXT_OVERFLOW');
  const segmentClass = (active: boolean) =>
    `inline-flex min-h-9 items-center gap-2 rounded-[6px] px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077] focus-visible:ring-offset-1 ${
      active ? 'bg-[#E7F1EF] font-semibold text-[#0F2E2B]' : 'text-slate-600 hover:bg-slate-50 hover:text-[#0F2E2B]'
    }`;

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Revisa los nombres</h2>
        <p className="text-sm text-slate-600 mt-1">
          Corrige lo que haga falta y mira cómo queda cada certificado antes de generarlo.
        </p>
      </div>

      <StepActions
        onBack={onBack}
        primaryLabel="Continuar"
        onPrimary={onContinue}
        primaryDisabled={validCount + warningCount === 0}
        disabledReason="No hay personas listas para generar"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Lista */}
        <Card className="lg:col-span-7 p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1">
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={filter === opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={segmentClass(filter === opt.value)}
                >
                  {opt.dot && <span className={`h-2 w-2 rounded-full ${opt.dot}`} aria-hidden="true" />}
                  {opt.label}
                  <span className="tabular-nums text-slate-500">{opt.count}</span>
                </button>
              ))}
            </div>
            {errorCount > 0 && (
              <button
                type="button"
                onClick={() => setConfirmingRemoveErrors(true)}
                className="min-h-9 rounded-[6px] px-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                Quitar {errorCount === 1 ? 'el registro' : `los ${errorCount} registros`} con error
              </button>
            )}
          </div>

          <div className="max-h-[480px] overflow-auto">
            <table className="w-full table-fixed text-sm">
              <caption className="sr-only">
                Personas de la lista. Selecciona una fila para ver su certificado.
              </caption>
              <thead className="sticky top-0 z-10 bg-[#E7F1EF] text-left text-xs font-semibold uppercase tracking-[0.08em] [font-stretch:80%] text-[#0F2E2B]">
                <tr>
                  <th scope="col" className="hidden w-12 px-4 py-2 font-semibold sm:table-cell">Fila</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Nombre</th>
                  <th scope="col" className="hidden w-24 px-2 py-2 font-semibold sm:table-cell">Estado</th>
                  <th scope="col" className="w-[72px] px-2 py-2 text-right font-semibold sm:w-24">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0F2E2B]/[0.08]">
                {filteredRecipients.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                      Nadie en este filtro.
                    </td>
                  </tr>
                ) : (
                  filteredRecipients.map((rec) => {
                    const isSelected = currentPreviewRecipient?.id === rec.id;
                    const label = rec.name.trim() || `fila ${rec.rowNumber}`;

                    return (
                      <tr
                        key={rec.id}
                        aria-current={isSelected ? 'true' : undefined}
                        onClick={() => selectRecipient(rec.id)}
                        className={`cursor-pointer align-top transition-colors ${
                          isSelected ? 'bg-[#F4F8F7]' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td
                          className={`hidden px-4 py-3 tabular-nums sm:table-cell ${
                            isSelected ? 'font-semibold text-[#208077]' : 'text-slate-500'
                          }`}
                        >
                          {rec.rowNumber}
                        </td>
                        <td className="min-w-0 px-4 py-2">
                          <input
                            type="text"
                            value={rec.name}
                            aria-label={`Nombre de la fila ${rec.rowNumber}`}
                            onChange={(e) => onUpdateRecipient({ ...rec, name: e.target.value })}
                            onFocus={() => selectRecipient(rec.id)}
                            placeholder="Escribe el nombre"
                            className="-mx-2 w-[calc(100%+1rem)] rounded-[6px] border border-transparent bg-transparent px-2 py-1 font-medium text-[#0F2E2B] transition-colors hover:border-slate-200 hover:bg-white focus:border-[#208077] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#208077]/20"
                          />
                          {rec.email && <span className="block truncate text-xs text-slate-500">{rec.email}</span>}
                          {rec.issues.map((issue, idx) => (
                            <span
                              key={idx}
                              className={`mt-1 flex items-start gap-1 text-xs font-medium ${
                                issue.severity === 'error' ? 'text-rose-700' : 'text-amber-700'
                              }`}
                            >
                              {issue.severity === 'error' ? (
                                <XCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              ) : (
                                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              )}
                              {issue.message}
                            </span>
                          ))}
                        </td>
                        <td className="hidden px-2 py-3 sm:table-cell">
                          {hasError(rec) ? (
                            <Badge variant="error" size="sm">Error</Badge>
                          ) : hasOnlyWarnings(rec) ? (
                            <Badge variant="warning" size="sm">Aviso</Badge>
                          ) : (
                            <Badge variant="success" size="sm">Listo</Badge>
                          )}
                        </td>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                            <button
                              type="button"
                              onClick={() => setCustomizingRecipient(rec)}
                              aria-label={`Ajustar el nombre de ${label} en su certificado`}
                              title="Ajustar tamaño y posición solo para esta persona"
                              className={`flex h-8 w-8 items-center justify-center rounded-[6px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077] ${
                                hasCustomField(rec)
                                  ? 'bg-[#E7F1EF] text-[#208077]'
                                  : 'text-slate-500 hover:bg-slate-100 hover:text-[#0F2E2B]'
                              }`}
                            >
                              <Sliders className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveRecipient(rec.id)}
                              aria-label={`Quitar a ${label} de la lista`}
                              title="Quitar de la lista"
                              className="flex h-8 w-8 items-center justify-center rounded-[6px] text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Vista previa */}
        <Card className="lg:col-span-5 p-4 sm:p-5 lg:sticky lg:top-24">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#0F2E2B]">Vista previa</h3>
              <p className="truncate text-sm text-slate-600">
                {currentPreviewRecipient
                  ? `${currentPreviewRecipient.name || 'Sin nombre'} · fila ${currentPreviewRecipient.rowNumber}`
                  : 'Sin personas en la lista'}
                {hasCustomField(currentPreviewRecipient) && ' · ajustado a mano'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileDown className="h-4 w-4" />}
              onClick={handleDownloadSamplePdf}
              isLoading={downloadingSample}
              disabled={!currentPreviewRecipient}
            >
              Descargar PDF de muestra
            </Button>
          </div>

          <div role="group" aria-label="Elegir a quién ver" className="mt-3 flex gap-1">
            <button
              type="button"
              aria-pressed={safePreviewIndex === 0}
              onClick={() => setPreviewIndex(0)}
              className={segmentClass(safePreviewIndex === 0)}
            >
              Primera fila
            </button>
            <button
              type="button"
              aria-pressed={safePreviewIndex === longestRecipientIndex}
              onClick={() => setPreviewIndex(longestRecipientIndex)}
              className={segmentClass(safePreviewIndex === longestRecipientIndex)}
            >
              Nombre más largo
            </button>
          </div>

          {overflowIssue && currentPreviewRecipient && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                {overflowIssue.message}
              </span>
              <button
                type="button"
                onClick={() => setCustomizingRecipient(currentPreviewRecipient)}
                className="shrink-0 font-semibold underline underline-offset-2 hover:text-amber-950"
              >
                Ajustar
              </button>
            </div>
          )}

          <PageTabs
            pages={template.pages}
            currentPageId={previewPage.id}
            onSelect={setPreviewPageId}
            fieldCounts={Object.fromEntries(template.pages.map((p) => [p.id, fieldsForPage(fields, p.id).length]))}
            className="mt-3"
          />
          <div
            ref={previewContainerRef}
            className="relative mt-3 w-full select-none overflow-hidden rounded-[6px] border border-slate-200 bg-slate-50"
            style={{ aspectRatio: `${previewPage.widthPt} / ${previewPage.heightPt}` }}
          >
            <img
              src={previewPage.previewUrl}
              alt={`Certificado de ${currentPreviewRecipient?.name || 'ejemplo'}, página ${template.pages.indexOf(previewPage) + 1}`}
              className="pointer-events-none h-full w-full object-contain"
            />
            {previewOverlays.map(({ field, text, fontSizePx }) => (
              <FieldTextOverlay key={field.id} field={field} text={text || '—'} fontSizePx={fontSizePx} />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ChevronLeft className="h-4 w-4" />}
              disabled={safePreviewIndex === 0}
              onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
            >
              Anterior
            </Button>
            <span className="tabular-nums text-slate-600" aria-live="polite">
              {validatedRecipients.length > 0 ? safePreviewIndex + 1 : 0} de {validatedRecipients.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              rightIcon={<ChevronRight className="h-4 w-4" />}
              disabled={safePreviewIndex >= validatedRecipients.length - 1}
              onClick={() => setPreviewIndex((prev) => Math.min(validatedRecipients.length - 1, prev + 1))}
            >
              Siguiente
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={confirmingRemoveErrors}
        title={errorCount === 1 ? '¿Quitar el registro con error?' : `¿Quitar los ${errorCount} registros con error?`}
        confirmLabel="Quitar de la lista"
        tone="danger"
        onCancel={() => setConfirmingRemoveErrors(false)}
        onConfirm={() => {
          onRemoveRecipients(errorRecipients.map((r) => r.id));
          setConfirmingRemoveErrors(false);
          setFilter('all');
        }}
      >
        <p>No se generará certificado para:</p>
        <ul className="mt-2 space-y-1 text-slate-700">
          {errorRecipients.slice(0, 5).map((r) => (
            <li key={r.id}>
              <span className="tabular-nums text-slate-500">Fila {r.rowNumber}:</span> {r.name || 'Sin nombre'}
            </li>
          ))}
          {errorCount > 5 && <li className="text-slate-500">y {errorCount - 5} más</li>}
        </ul>
        <p className="mt-3 text-slate-600">Puedes volver a cargar la lista en el paso anterior si los necesitas.</p>
      </ConfirmDialog>

      {/* Modal de ajuste individual para el destinatario */}
      <IndividualFieldModal
        isOpen={Boolean(customizingRecipient)}
        recipient={customizingRecipient}
        baseField={nameField}
        page={namePage}
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
