import React, { useRef, useState } from 'react';
import { TemplateData, TemplatePage, FieldBox } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { StepActions } from '../../ui/StepActions';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Badge } from '../../ui/Badge';
import { Dropzone } from '../../ui/Dropzone';
import { importTemplateFile } from '../../infra/templateImport';
import {
  MAX_FILE_MB,
  MAX_TEMPLATE_PAGES,
  movePage,
  removePage,
  replacePage,
  TemplateFileError,
  assertTemplateSize,
} from '../../domain/templatePages';
import { fieldsForPage, isNameField } from '../../domain/fields';
import {
  FileText,
  AlertCircle,
  Loader2,
  Trash2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Layers,
} from 'lucide-react';

interface TemplateStepProps {
  template: TemplateData | null;
  fields: FieldBox[];
  onTemplateChange: (template: TemplateData) => void;
  onRemoveTemplate?: () => void;
  onRequireTemplate?: () => void;
  onContinue: () => void;
}

function describeError(err: unknown, fallback: string): string {
  if (err instanceof TemplateFileError) return err.message;
  console.error('Error procesando la plantilla:', err);
  return fallback;
}

const iconButton =
  'flex h-8 w-8 items-center justify-center rounded-[6px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#0F2E2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077] disabled:cursor-not-allowed disabled:opacity-30';

function orientationLabel(page: TemplatePage): string {
  return page.widthPt >= page.heightPt ? 'Horizontal' : 'Vertical';
}

export const TemplateStep: React.FC<TemplateStepProps> = ({
  template,
  fields,
  onTemplateChange,
  onRemoveTemplate,
  onRequireTemplate,
  onContinue,
}) => {
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replacingPageIdRef = useRef<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const pages = template?.pages ?? [];
  const isFull = pages.length >= MAX_TEMPLATE_PAGES;
  const selectedPage = pages.find((p) => p.id === selectedPageId) ?? pages[0];

  const commitPages = (nextPages: TemplatePage[], fileName: string) => {
    assertTemplateSize(nextPages);
    onTemplateChange({
      id: template?.id ?? `tpl_${Date.now()}`,
      name: template?.name ?? fileName,
      pages: nextPages,
    });
  };

  const handleAddFile = async (file: File) => {
    setRenderError(null);
    setPendingDeleteId(null);
    setIsRendering(true);
    try {
      const newPages = await importTemplateFile(file, pages.length);
      commitPages([...pages, ...newPages], file.name);
      setSelectedPageId(newPages[0].id);
    } catch (err) {
      setRenderError(describeError(err, `No se pudo procesar "${file.name}". Verifica que no esté dañado ni protegido con contraseña.`));
    } finally {
      setIsRendering(false);
    }
  };

  const handleReplaceFile = async (file: File) => {
    const pageId = replacingPageIdRef.current;
    replacingPageIdRef.current = null;
    if (!pageId) return;
    setRenderError(null);
    setPendingDeleteId(null);
    setIsRendering(true);
    try {
      const newPages = await importTemplateFile(file, pages.length, true);
      commitPages(replacePage(pages, pageId, newPages), file.name);
      setSelectedPageId(pageId);
    } catch (err) {
      setRenderError(describeError(err, `No se pudo procesar "${file.name}". Verifica que no esté dañado ni protegido con contraseña.`));
    } finally {
      setIsRendering(false);
    }
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    setPendingDeleteId(null);
    commitPages(movePage(pages, index, index + direction), pages[index].sourceName);
  };

  const handleDelete = (pageId: string) => {
    const hasFields = fieldsForPage(fields, pageId).length > 0;
    if (hasFields && pendingDeleteId !== pageId) {
      setPendingDeleteId(pageId);
      return;
    }
    setPendingDeleteId(null);
    const nextPages = removePage(pages, pageId);
    if (nextPages.length === 0) {
      onRemoveTemplate?.();
      return;
    }
    commitPages(nextPages, nextPages[0].sourceName);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sube la plantilla de tu certificado</h2>
        <p className="mt-1 text-sm text-slate-600">
          Tu diseño sin los datos de cada persona, en PDF, PNG o JPG. Si tiene reverso, súbelo como otra página.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* Upload Zone (Left Column - 5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <Card className="p-5 sm:p-6 flex flex-col justify-between h-full space-y-5">
            {/* La zona de carga crece para ocupar el alto disponible y no dejar un hueco */}
            <div className="flex-1 flex flex-col space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#0F2E2B]">
                  {template ? 'Agregar otra página' : 'Cargar plantilla'}
                </h3>
                {template && (
                  <Badge variant={isFull ? 'warning' : 'success'} size="sm" icon={<Layers className="w-3 h-3" />}>
                    {pages.length} / {MAX_TEMPLATE_PAGES} páginas
                  </Badge>
                )}
              </div>

              <Dropzone
                className="flex-1"
                accept=".pdf,.png,.jpg,.jpeg"
                acceptLabel="PDF, PNG o JPG"
                maxSizeMB={MAX_FILE_MB}
                disabled={isFull || isRendering}
                title={
                  isFull
                    ? `Llegaste al máximo de ${MAX_TEMPLATE_PAGES} páginas`
                    : template
                      ? 'Arrastra aquí la siguiente página'
                      : 'Arrastra y suelta tu archivo aquí'
                }
                description={isFull ? 'Elimina o reemplaza una página' : 'o haz clic para elegir un archivo'}
                onFileSelect={handleAddFile}
              />

              {renderError && (
                <div role="alert" className="flex items-start gap-2 rounded-[6px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{renderError}</span>
                </div>
              )}
            </div>

            <p className="border-t border-slate-200 pt-4 text-sm text-slate-600">
              Deja libre el espacio del nombre: lo ubicarás en el siguiente paso. Si puedes, usa PDF; imprime con mejor
              resolución.
            </p>
          </Card>
        </div>

        {/* Template Preview Panel (Right Column - 7 cols) */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <Card className="p-5 sm:p-6 flex flex-col justify-between h-full space-y-4">
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-[#0F2E2B]">Páginas de la plantilla</h3>
                {template && onRemoveTemplate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 className="h-4 w-4" />}
                    onClick={() => setConfirmingRemove(true)}
                    disabled={isRendering}
                  >
                    Quitar plantilla
                  </Button>
                )}
              </div>

              {template && selectedPage ? (
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="relative rounded-[6px] overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center min-h-[220px] max-h-[320px]">
                    {isRendering && (
                      <div className="absolute inset-0 z-10 bg-white/80 flex flex-col items-center justify-center text-center gap-2">
                        <Loader2 className="w-7 h-7 text-[#208077] animate-spin" />
                        <p className="text-sm font-semibold text-slate-700">Procesando la página…</p>
                      </div>
                    )}
                    <img
                      src={selectedPage.previewUrl}
                      alt={`Vista previa de la página ${pages.indexOf(selectedPage) + 1}`}
                      className="w-full h-auto object-contain max-h-[310px] mx-auto block"
                    />
                  </div>

                  {/* Lista ordenada de páginas */}
                  <ol className="space-y-2" aria-label="Orden de las páginas">
                    {pages.map((page, index) => {
                      const isSelected = page.id === selectedPage.id;
                      const pageFieldCount = fieldsForPage(fields, page.id).length;
                      return (
                        <li key={page.id}>
                          <div
                            className={`flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 p-2 rounded-[6px] border transition-colors ${
                              isSelected ? 'border-[#208077] bg-[#F4F8F7]' : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedPageId(page.id)}
                              className="flex items-center gap-3 flex-1 min-w-[12rem] text-left cursor-pointer"
                              aria-current={isSelected ? 'true' : undefined}
                            >
                              <span className="w-14 h-10 shrink-0 rounded-md border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
                                <img src={page.previewUrl} alt="" className="max-w-full max-h-full object-contain" />
                              </span>
                              <span className="min-w-0 text-sm">
                                <span className="font-semibold text-[#0F2E2B] block whitespace-nowrap">Página {index + 1}</span>
                                <span className="text-xs text-slate-600 block truncate">{page.sourceName}</span>
                                <span className="text-xs text-slate-500 block tabular-nums">
                                  {orientationLabel(page)} • {Math.round(page.widthPt * 0.3528)} × {Math.round(page.heightPt * 0.3528)} mm
                                  {pageFieldCount > 0 && ` • ${pageFieldCount} ${pageFieldCount === 1 ? 'campo' : 'campos'}`}
                                </span>
                              </span>
                            </button>

                            <div className="flex items-center gap-0.5 shrink-0 ml-auto">
                              <button
                                type="button"
                                onClick={() => handleMove(index, -1)}
                                disabled={index === 0 || isRendering}
                                className={iconButton}
                                title="Subir página"
                                aria-label={`Subir página ${index + 1}`}
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMove(index, 1)}
                                disabled={index === pages.length - 1 || isRendering}
                                className={iconButton}
                                title="Bajar página"
                                aria-label={`Bajar página ${index + 1}`}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  replacingPageIdRef.current = page.id;
                                  replaceInputRef.current?.click();
                                }}
                                disabled={isRendering}
                                className={iconButton}
                                title="Reemplazar el diseño de esta página (sus campos se conservan)"
                                aria-label={`Reemplazar página ${index + 1}`}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(page.id)}
                                disabled={isRendering}
                                className={`${iconButton} hover:!bg-rose-50 hover:!text-rose-700`}
                                title="Eliminar página"
                                aria-label={`Eliminar página ${index + 1}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {pendingDeleteId === page.id && (
                            <div role="alert" className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                              <span>
                                Esta página tiene {pageFieldCount} {pageFieldCount === 1 ? 'campo' : 'campos'}. Se eliminarán
                                {fieldsForPage(fields, page.id).some(isNameField) && ' (el nombre pasará a la página 1)'}.
                              </span>
                              <span className="flex gap-1.5">
                                <Button variant="outline" size="sm" onClick={() => setPendingDeleteId(null)}>
                                  Cancelar
                                </Button>
                                <Button variant="danger" size="sm" onClick={() => handleDelete(page.id)}>
                                  Eliminar
                                </Button>
                              </span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>

                  <input
                    ref={replaceInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) handleReplaceFile(file);
                    }}
                  />
                </div>
              ) : isRendering ? (
                <div className="flex-1 min-h-[300px] rounded-[6px] border border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <Loader2 className="w-7 h-7 text-[#208077] animate-spin" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-700">Procesando la página…</p>
                </div>
              ) : (
                <div className="flex-1 min-h-[300px] rounded-[6px] border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
                  <FileText className="mb-3 h-8 w-8 stroke-[1.25] text-slate-400" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-700">Aquí verás las páginas que subas</p>
                </div>
              )}
            </div>

            <StepActions
              primaryLabel="Continuar"
              onPrimary={() => (template ? onContinue() : onRequireTemplate?.())}
              primaryDisabled={!template || isRendering}
              disabledReason={isRendering ? 'Procesando la página…' : 'Sube al menos una página'}
            />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmingRemove}
        title="¿Quitar la plantilla?"
        confirmLabel="Quitar plantilla"
        tone="danger"
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={() => {
          setConfirmingRemove(false);
          setSelectedPageId(null);
          onRemoveTemplate?.();
        }}
      >
        <p>
          Se quitan {pages.length === 1 ? 'la página' : `las ${pages.length} páginas`}. Tendrás que volver a subir el diseño para
          continuar.
        </p>
      </ConfirmDialog>
    </div>
  );
};
