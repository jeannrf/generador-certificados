import React, { useRef, useState } from 'react';
import { TemplateData, TemplatePage, FieldBox } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
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
  UploadCloud,
  CheckCircle2,
  Layout,
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
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Sube la plantilla de tu certificado
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* Upload Zone (Left Column - 5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <Card className="p-5 sm:p-6 flex flex-col justify-between h-full space-y-5">
            {/* La zona de carga crece para ocupar el alto disponible y no dejar un hueco */}
            <div className="flex-1 flex flex-col space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-[#208077]" />
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
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                  <span>{renderError}</span>
                </div>
              )}
            </div>

            {/* Guía y recomendaciones de diseño */}
            <div className="pt-4 border-t border-slate-100 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Recomendaciones para tu diseño
              </span>

              <div className="space-y-2">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <Layout className="w-4 h-4 text-[#208077] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Deja libre el espacio del nombre</span>
                    <span className="text-[11px] text-slate-500">Lo ubicarás en el Paso 2.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <FileText className="w-4 h-4 text-[#208077] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Prefiere PDF</span>
                    <span className="text-[11px] text-slate-500">Mejor resolución al imprimir.</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Template Preview Panel (Right Column - 7 cols) */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <Card className="p-5 sm:p-6 flex flex-col justify-between h-full space-y-4">
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#208077]" />
                  Páginas de la plantilla
                </h3>
                {template && onRemoveTemplate && (
                  <button
                    type="button"
                    onClick={onRemoveTemplate}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                    title="Quitar todas las páginas"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="whitespace-nowrap">Quitar plantilla</span>
                  </button>
                )}
              </div>

              {template && selectedPage ? (
                <div className="space-y-4 flex-1 flex flex-col">
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner flex items-center justify-center min-h-[220px] max-h-[320px]">
                    {isRendering && (
                      <div className="absolute inset-0 z-10 bg-white/80 flex flex-col items-center justify-center text-center gap-2">
                        <Loader2 className="w-7 h-7 text-[#208077] animate-spin" />
                        <p className="text-xs font-semibold text-slate-700">Procesando archivo...</p>
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
                            className={`flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 p-2 rounded-xl border transition-colors ${isSelected ? 'border-[#208077] bg-[#f0faf9]' : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedPageId(page.id)}
                              className="flex items-center gap-3 flex-1 min-w-[12rem] text-left cursor-pointer"
                              aria-current={isSelected}
                            >
                              <span className="w-14 h-10 shrink-0 rounded-md border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center">
                                <img src={page.previewUrl} alt="" className="max-w-full max-h-full object-contain" />
                              </span>
                              <span className="min-w-0 text-xs">
                                <span className="font-semibold text-slate-900 block whitespace-nowrap">
                                  Página {index + 1}
                                  <span className="ml-1.5 uppercase text-[10px] font-bold text-slate-400">{page.kind === 'pdf' ? 'PDF' : page.mimeType.includes('png') ? 'PNG' : 'JPG'}</span>
                                </span>
                                <span className="text-[11px] text-slate-500 block truncate">{page.sourceName}</span>
                                <span className="text-[10px] text-slate-400 block">
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
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-[#208077] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                title="Subir página"
                                aria-label={`Subir página ${index + 1}`}
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMove(index, 1)}
                                disabled={index === pages.length - 1 || isRendering}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-[#208077] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-[#208077] disabled:opacity-30 cursor-pointer"
                                title="Reemplazar el diseño de esta página (sus campos se conservan)"
                                aria-label={`Reemplazar página ${index + 1}`}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(page.id)}
                                disabled={isRendering}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                                title="Eliminar página"
                                aria-label={`Eliminar página ${index + 1}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {pendingDeleteId === page.id && (
                            <div role="alert" className="mt-1.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2">
                              <span>
                                Esta página tiene {pageFieldCount} {pageFieldCount === 1 ? 'campo' : 'campos'}. Se eliminarán
                                {fieldsForPage(fields, page.id).some(isNameField) && ' (el nombre pasará a la página 1)'}.
                              </span>
                              <span className="flex gap-1.5">
                                <button type="button" onClick={() => setPendingDeleteId(null)} className="px-2 py-0.5 rounded-md border border-amber-300 bg-white font-semibold cursor-pointer">
                                  Cancelar
                                </button>
                                <button type="button" onClick={() => handleDelete(page.id)} className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-semibold cursor-pointer">
                                  Eliminar
                                </button>
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
                <div className="flex-1 min-h-[300px] rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-500 p-8 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-[#208077] animate-spin" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Procesando archivo...</p>
                    <p className="text-xs text-slate-400 mt-0.5">Renderizando vista previa en alta resolución</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-[300px] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-sm">
                    <FileText className="w-7 h-7 stroke-[1.25]" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Sin plantilla cargada</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">Aquí verás las páginas que subas.</p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex justify-end">
              <Button
                variant={template ? 'primary' : 'outline'}
                size="lg"
                disabled={isRendering}
                onClick={() => {
                  if (!template) {
                    onRequireTemplate?.();
                  } else {
                    onContinue();
                  }
                }}
                className="w-full"
              >
                Continuar al siguiente paso
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
