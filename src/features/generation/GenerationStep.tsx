import React, { useState, useRef } from 'react';
import { Recipient, TemplateData, FieldBox, GenerationProgress } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';
import { composeCertificatePdf } from '../../infra/pdfComposer';
import { createZipArchive, triggerDownload, FileToZip } from '../../infra/zipExporter';
import confetti from 'canvas-confetti';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  FileArchive,
  RefreshCw,
  ChevronLeft,
  Sparkles,
  Zap,
} from 'lucide-react';

interface GenerationStepProps {
  recipients: Recipient[];
  template: TemplateData;
  field: FieldBox;
  onBack: () => void;
  onResetAll: () => void;
}

export const GenerationStep: React.FC<GenerationStepProps> = ({
  recipients,
  template,
  field,
  onBack,
  onResetAll,
}) => {
  // Filtrar solo los válidos o con advertencia (excluyendo errores)
  const validRecipients = recipients.filter(
    (r) => !r.issues.some((i) => i.severity === 'error')
  );

  const [progress, setProgress] = useState<GenerationProgress>({
    total: validRecipients.length,
    current: 0,
    status: 'idle',
    generatedCount: 0,
  });

  const isCancelledRef = useRef(false);

  const startGeneration = async () => {
    isCancelledRef.current = false;
    setProgress({
      total: validRecipients.length,
      current: 0,
      status: 'generating',
      generatedCount: 0,
    });

    const results: FileToZip[] = [];

    for (let i = 0; i < validRecipients.length; i++) {
      if (isCancelledRef.current) {
        setProgress((prev) => ({ ...prev, status: 'cancelled' }));
        return;
      }

      const rec = validRecipients[i];
      setProgress({
        total: validRecipients.length,
        current: i + 1,
        status: 'generating',
        currentName: rec.name,
        generatedCount: results.length,
      });

      try {
        const { fileName, pdfBytes } = await composeCertificatePdf(template, field, rec);
        results.push({ fileName, data: pdfBytes });
      } catch (err) {
        console.error(`Error generando certificado para ${rec.name}:`, err);
      }

      // Dejar un pequeño respiro para que el hilo de UI renderice la animación y barra
      if (i % 3 === 0) {
        await new Promise((res) => setTimeout(res, 10));
      }
    }

    // Comprimir en ZIP
    setProgress((prev) => ({ ...prev, status: 'zipping' }));
    await new Promise((res) => setTimeout(res, 50));

    try {
      const zipBlob = createZipArchive(results);
      setProgress({
        total: validRecipients.length,
        current: validRecipients.length,
        status: 'completed',
        generatedCount: results.length,
        zipBlob,
      });

      // Disparar confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#7c3aed', '#38bdf8', '#10b981', '#f59e0b'],
      });
    } catch (err) {
      setProgress((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'Ocurrió un error al empaquetar el archivo ZIP.',
      }));
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
  };

  const handleDownloadZip = () => {
    if (progress.zipBlob) {
      triggerDownload(progress.zipBlob, `Certificados_${Date.now()}.zip`);
    }
  };

  const percentage =
    progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Generador de Certificados en Lote
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Todos los PDFs se generan a alta calidad vectorial directamente en tu navegador.
        </p>
      </div>

      <Card className="p-6 sm:p-8 space-y-6">
        {/* State: Idle */}
        {progress.status === 'idle' && (
          <div className="text-center py-6 space-y-6">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto text-brand-600 border border-brand-200/60 shadow-subtle">
              <Zap className="w-8 h-8 stroke-[2]" />
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-lg font-bold text-slate-900">
                Todo listo para emitir {validRecipients.length} certificados
              </h3>
              <p className="text-xs text-slate-500">
                El proceso tomará solo unos segundos. No se consumen datos de servidor ni se comparten datos privados.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="md" leftIcon={<ChevronLeft className="w-4 h-4" />} onClick={onBack}>
                Volver a Revisión
              </Button>
              <Button
                variant="primary"
                size="lg"
                leftIcon={<Sparkles className="w-5 h-5" />}
                onClick={startGeneration}
                className="px-8"
              >
                Comenzar Generación
              </Button>
            </div>
          </div>
        )}

        {/* State: Generating or Zipping */}
        {(progress.status === 'generating' || progress.status === 'zipping') && (
          <div className="py-8 space-y-6 max-w-lg mx-auto text-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 border border-brand-200 rounded-full text-xs font-semibold text-brand-700 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                {progress.status === 'zipping' ? 'Empaquetando archivo ZIP...' : 'Generando PDFs en tiempo real...'}
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {progress.status === 'zipping'
                  ? 'Finalizando compresión'
                  : `Procesando: ${progress.currentName || '...'}`}
              </h3>
            </div>

            <ProgressBar
              progress={percentage}
              label={`Certificado ${progress.current} de ${progress.total}`}
              sublabel="Generado localmente en tu equipo"
            />

            <div>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancelar proceso
              </Button>
            </div>
          </div>
        )}

        {/* State: Completed */}
        {progress.status === 'completed' && (
          <div className="py-6 space-y-6 text-center animate-fadeIn">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 border border-emerald-200/80 shadow-md">
              <CheckCircle2 className="w-9 h-9 stroke-[2]" />
            </div>

            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-slate-900">
                ¡{progress.generatedCount} Certificados generados con éxito!
              </h3>
              <p className="text-xs text-slate-500">
                Tu paquete ZIP está listo para ser guardado y descomprimido en tu equipo.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-md mx-auto flex items-center justify-between text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-brand-600 shadow-sm">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Certificados_{Date.now()}.zip
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {progress.generatedCount} archivos PDF vectoriales
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Listo
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="lg"
                leftIcon={<Download className="w-5 h-5" />}
                onClick={handleDownloadZip}
                className="w-full sm:w-auto px-8"
              >
                Descargar Archivo ZIP
              </Button>

              <Button
                variant="outline"
                size="lg"
                leftIcon={<RefreshCw className="w-4 h-4" />}
                onClick={onResetAll}
                className="w-full sm:w-auto"
              >
                Crear Nuevo Lote
              </Button>
            </div>
          </div>
        )}

        {/* State: Cancelled or Error */}
        {(progress.status === 'cancelled' || progress.status === 'error') && (
          <div className="py-6 space-y-4 text-center">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto text-rose-600 border border-rose-200">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {progress.status === 'cancelled'
                ? 'Generación cancelada por el usuario'
                : progress.errorMessage || 'Error durante la generación'}
            </h3>
            <div className="flex justify-center gap-3">
              <Button variant="primary" size="sm" onClick={startGeneration}>
                Reintentar
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
