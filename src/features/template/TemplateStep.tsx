import React, { useState } from 'react';
import { TemplateData, FieldBox } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Dropzone } from '../../ui/Dropzone';
import { renderPdfToPreview } from '../../infra/pdfRenderer';
import { FileText, AlertCircle, Info, Loader2, UploadCloud, CheckCircle2, Layout, Trash2, Ruler } from 'lucide-react';

interface TemplateStepProps {
  template: TemplateData | null;
  onTemplateChange: (template: TemplateData, defaultField?: Partial<FieldBox>) => void;
  onRemoveTemplate?: () => void;
  onRequireTemplate?: () => void;
  onContinue: () => void;
}

export const TemplateStep: React.FC<TemplateStepProps> = ({
  template,
  onTemplateChange,
  onRemoveTemplate,
  onRequireTemplate,
  onContinue,
}) => {
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setRenderError(null);
    setPageNotice(null);
    setIsRendering(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

      if (isPdf) {
        // Renderizar el PDF a imagen de alta definición con pdf.js
        const rendered = await renderPdfToPreview(bytes);

        if (rendered.numPages > 1) {
          setPageNotice(`El archivo tiene ${rendered.numPages} páginas. Se ha seleccionado la primera página para la plantilla.`);
        }

        onTemplateChange({
          id: `tpl_${Date.now()}`,
          name: file.name,
          kind: 'pdf',
          bytes,
          mimeType: 'application/pdf',
          widthPt: rendered.widthPt,
          heightPt: rendered.heightPt,
          previewUrl: rendered.previewUrl,
        });
      } else {
        // Imagen (PNG / JPG)
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = () => {
          // Convertir dimensiones de píxeles a puntos PDF (a 96 DPI estándar: 1px = 0.75pt)
          const widthPt = img.naturalWidth * 0.75;
          const heightPt = img.naturalHeight * 0.75;

          onTemplateChange({
            id: `tpl_${Date.now()}`,
            name: file.name,
            kind: 'image',
            bytes,
            mimeType: file.type || 'image/png',
            widthPt: Math.round(widthPt),
            heightPt: Math.round(heightPt),
            previewUrl: objectUrl,
          });
          setIsRendering(false);
        };
        img.onerror = () => {
          setRenderError('No se pudo cargar la imagen seleccionada. Intenta con otro archivo.');
          setIsRendering(false);
        };
        img.src = objectUrl;
        return;
      }
    } catch (err) {
      console.error('Error renderizando plantilla PDF:', err);
      setRenderError('Ocurrió un error al procesar el archivo PDF. Verifica que no esté protegido con contraseña.');
    } finally {
      setIsRendering(false);
    }
  };


  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Sube la plantilla de tu certificado
        </h2>
        <p className="mt-2 text-slate-600">
          Sube tu diseño en PDF o imagen de alta calidad creado en Canva, Illustrator o PowerPoint.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* Upload Zone (Left Column - 5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-full">
          <Card className="p-5 sm:p-6 flex flex-col justify-between h-full space-y-5">
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-[#208077]" />
                  {template ? 'Cargar otra plantilla' : 'Cargar plantilla'}
                </h3>
                {template && (
                  <Badge variant="success" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
                    Plantilla cargada
                  </Badge>
                )}
              </div>

              <Dropzone
                accept=".pdf,.png,.jpg,.jpeg"
                acceptLabel="PDF, PNG o JPG"
                suggestedSize="Sugerido: Horizontal / 2000×1414 px o PDF A4"
                maxSizeMB={15}
                title={template ? '¿Quieres reemplazar tu diseño?' : 'Arrastra y suelta tu archivo aquí'}
                description={template ? 'Arrastra o haz clic para sustituir el archivo actual' : 'o haz clic para explorar en tu equipo'}
                onFileSelect={handleFileUpload}
              />
            </div>

            {/* Guía y recomendaciones de diseño */}
            <div className="pt-4 border-t border-slate-100 space-y-2.5">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Recomendaciones para tu diseño
              </span>

              <div className="space-y-2">
                {/* Tamaños recomendados */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                  <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-[#208077] shrink-0" />
                    <span className="font-semibold text-slate-800 text-xs">
                      Tamaños sugeridos (Orientación Horizontal)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs space-y-1">
                      <div className="font-bold text-slate-800 flex items-center justify-between">
                        <span>Imagen (.png / .jpg)</span>
                        <span className="text-[#208077] font-mono text-[11px] font-semibold">2000 × 1414 px</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Proporción A4 estándar (Canva, Illustrator). Mínimo recomendado: 1920 × 1080 px.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs space-y-1">
                      <div className="font-bold text-slate-800 flex items-center justify-between">
                        <span>Documento (.pdf)</span>
                        <span className="text-[#208077] font-mono text-[11px] font-semibold">A4 (297 × 210 mm)</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Medida de hoja estándar (842 × 595 pt) o Carta. Calidad vectorial sin pérdida al imprimir.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <Layout className="w-4 h-4 text-[#208077] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Deja libre el espacio del nombre</span>
                    <span className="text-[11px] text-slate-500 leading-relaxed">
                      Diseña la plantilla con tus sellos y firmas, pero sin el nombre del participante; en el Paso 2 lo ubicarás con precisión.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                  <FileText className="w-4 h-4 text-[#208077] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-semibold text-slate-800 block">Formato PDF vectorial recomendado</span>
                    <span className="text-[11px] text-slate-500 leading-relaxed">
                      Los archivos PDF garantizan gráficos y textos nítidos al imprimir o descargar en alta resolución.
                    </span>
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
                  Vista previa de plantilla
                </h3>
                {template && onRemoveTemplate && (
                  <button
                    type="button"
                    onClick={onRemoveTemplate}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                    title="Quitar esta plantilla"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Quitar plantilla</span>
                  </button>
                )}
              </div>

              {isRendering ? (
                <div className="flex-1 min-h-[300px] rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-500 p-8 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-[#208077] animate-spin" />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Procesando archivo PDF...</p>
                    <p className="text-xs text-slate-400 mt-0.5">Renderizando vista previa en alta resolución</p>
                  </div>
                </div>
              ) : template ? (
                <div className="space-y-4 flex-1 flex flex-col justify-center">
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner group flex items-center justify-center min-h-[260px] max-h-[360px]">
                    <img
                      src={template.previewUrl}
                      alt="Plantilla cargada"
                      className="w-full h-auto object-contain max-h-[350px] mx-auto block"
                    />
                  </div>

                  {pageNotice && (
                    <div className="p-2.5 bg-[#f0faf9] border border-[#b2e5df] rounded-xl text-[#208077] text-xs flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>{pageNotice}</span>
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/70 text-xs space-y-1.5 text-slate-600 mt-auto">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-500">Nombre de archivo:</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[280px]">{template.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-500">Formato:</span>
                      <span className="uppercase font-semibold text-slate-800">{template.kind}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-500">Dimensiones:</span>
                      <div className="text-right">
                        <span className="font-semibold text-slate-800">{template.widthPt} × {template.heightPt} pt</span>
                        <span className="text-[11px] text-slate-400 block font-normal">
                          {template.widthPt >= template.heightPt ? 'Horizontal' : 'Vertical'} • {Math.round(template.widthPt * 0.3528)} × {Math.round(template.heightPt * 0.3528)} mm
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-[300px] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-sm">
                    <FileText className="w-7 h-7 stroke-[1.25]" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Sin plantilla cargada</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Sube tu plantilla en PDF o imagen en la columna izquierda para ver la vista previa aquí.
                  </p>
                </div>
              )}

              {renderError && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{renderError}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex justify-end">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  if (!template) {
                    onRequireTemplate?.();
                  } else {
                    onContinue();
                  }
                }}
                className={`w-full ${!template ? 'opacity-85 hover:opacity-100 cursor-pointer shadow-xs' : ''}`}
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
