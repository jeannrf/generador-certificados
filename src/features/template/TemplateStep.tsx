import React, { useState } from 'react';
import { TemplateData, FieldBox } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Dropzone } from '../../ui/Dropzone';
import { createDemoCertificateCanvas } from '../../shared/demoData';
import { Sparkles, FileText } from 'lucide-react';

interface TemplateStepProps {
  template: TemplateData | null;
  onTemplateChange: (template: TemplateData, defaultField?: Partial<FieldBox>) => void;
  onContinue: () => void;
}

export const TemplateStep: React.FC<TemplateStepProps> = ({
  template,
  onTemplateChange,
  onContinue,
}) => {
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleFileUpload = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

    if (isPdf) {
      // Para PDF creamos un blob URL para el preview
      const previewUrl = URL.createObjectURL(file);
      onTemplateChange({
        id: `tpl_${Date.now()}`,
        name: file.name,
        kind: 'pdf',
        bytes,
        mimeType: 'application/pdf',
        widthPt: 842, // A4 horizontal por defecto
        heightPt: 595,
        previewUrl,
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
      };
      img.src = objectUrl;
    }
  };

  const loadDemo = (style: 'classic' | 'modern' | 'minimal') => {
    setLoadingDemo(true);
    setTimeout(() => {
      const demo = createDemoCertificateCanvas(style);
      const names = {
        classic: 'Diploma de Reconocimiento Clásico.png',
        modern: 'Certificado Tech & IA Moderno.png',
        minimal: 'Constancia Minimalista.png',
      };

      onTemplateChange(
        {
          id: `tpl_demo_${style}`,
          name: names[style],
          kind: 'image',
          bytes: demo.bytes,
          mimeType: 'image/png',
          widthPt: demo.widthPt,
          heightPt: demo.heightPt,
          previewUrl: demo.previewUrl,
        },
        demo.defaultField
      );
      setLoadingDemo(false);
    }, 150);
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Upload Zone */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="p-6">
            <Dropzone
              accept=".pdf,.png,.jpg,.jpeg"
              acceptLabel="PDF, PNG o JPG"
              maxSizeMB={15}
              onFileSelect={handleFileUpload}
            />

            {/* Quick Demo Templates Picker */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  ¿No tienes una plantilla a mano? Prueba con estas de ejemplo:
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => loadDemo('classic')}
                  disabled={loadingDemo}
                  className="p-3 text-left rounded-xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50/40 transition-all text-xs font-medium group"
                >
                  <div className="w-full h-12 bg-amber-50 rounded-lg border border-amber-200 mb-2 flex items-center justify-center text-amber-800 font-serif text-[11px] group-hover:scale-105 transition-transform">
                    Diploma
                  </div>
                  <span className="font-semibold text-slate-800 block truncate">Clásico Dorado</span>
                  <span className="text-[10px] text-slate-500">Formal institucional</span>
                </button>

                <button
                  onClick={() => loadDemo('modern')}
                  disabled={loadingDemo}
                  className="p-3 text-left rounded-xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50/40 transition-all text-xs font-medium group"
                >
                  <div className="w-full h-12 bg-slate-900 rounded-lg border border-violet-500/40 mb-2 flex items-center justify-center text-violet-300 font-sans text-[11px] group-hover:scale-105 transition-transform">
                    Bootcamp
                  </div>
                  <span className="font-semibold text-slate-800 block truncate">Moderno Tech</span>
                  <span className="text-[10px] text-slate-500">Eventos e IA</span>
                </button>

                <button
                  onClick={() => loadDemo('minimal')}
                  disabled={loadingDemo}
                  className="p-3 text-left rounded-xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50/40 transition-all text-xs font-medium group"
                >
                  <div className="w-full h-12 bg-white rounded-lg border border-slate-200 mb-2 flex items-center justify-center text-slate-700 font-sans text-[11px] group-hover:scale-105 transition-transform shadow-xs">
                    Taller
                  </div>
                  <span className="font-semibold text-slate-800 block truncate">Minimalista</span>
                  <span className="text-[10px] text-slate-500">Limpio y sutil</span>
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Template Preview Panel */}
        <div className="lg:col-span-5">
          <Card className="p-6 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-600" />
                  Vista previa de plantilla
                </h3>
              </div>

              {template ? (
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-inner group">
                    <img
                      src={template.previewUrl}
                      alt="Plantilla cargada"
                      className="w-full h-auto object-contain max-h-[320px] mx-auto block"
                    />
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/70 text-xs space-y-1.5 text-slate-600">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-500">Nombre de archivo:</span>
                      <span className="font-semibold text-slate-800 truncate max-w-[200px]">{template.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-500">Formato:</span>
                      <span className="uppercase font-semibold text-slate-800">{template.kind}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-500">Dimensiones de página:</span>
                      <span className="font-semibold text-slate-800">{template.widthPt} × {template.heightPt} pt (A4)</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[280px] rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                  <FileText className="w-10 h-10 mb-2 stroke-[1.25]" />
                  <p className="text-xs">Sube una plantilla o selecciona un diseño de ejemplo para comenzar.</p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <Button
                variant="primary"
                size="lg"
                disabled={!template}
                onClick={onContinue}
                className="w-full sm:w-auto"
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
