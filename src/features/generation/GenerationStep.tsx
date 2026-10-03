import React, { useState, useRef } from 'react';
import { Recipient, TemplateData, FieldBox, GenerationProgress } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';
import { composeCertificatePdf, composeCombinedCertificatePdf } from '../../infra/pdfComposer';
import { formatCertificateFileName } from '../../domain/validation';
import { createZipArchive, triggerDownload, FileToZip } from '../../infra/zipExporter';
import confetti from 'canvas-confetti';
import { EmailDispatcherSection } from './EmailDispatcherSection';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  FileArchive,
  RefreshCw,
  ChevronLeft,
  Sparkles,
  Zap,
  FileText,
  Settings2,
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

  const [fileNamePattern, setFileNamePattern] = useState<string>('{nombre} - Certificado');
  const [progress, setProgress] = useState<GenerationProgress>({
    total: validRecipients.length,
    current: 0,
    status: 'idle',
    generatedCount: 0,
  });

  // Mapa de PDFs generados en memoria para reutilizar instantáneamente en la descarga y en el envío por correo
  const [pregeneratedPdfs, setPregeneratedPdfs] = useState<
    Record<string, { fileName: string; pdfBytes: Uint8Array }>
  >({});

  const isCancelledRef = useRef(false);

  const sampleRecipient = validRecipients[0] || { name: 'Ana María Pérez Rodríguez' };
  const sampleFileName = formatCertificateFileName(
    fileNamePattern,
    sampleRecipient.name,
    sampleRecipient.extra
  );

  const startGeneration = async () => {
    isCancelledRef.current = false;
    setProgress({
      total: validRecipients.length,
      current: 0,
      status: 'generating',
      generatedCount: 0,
    });

    const results: FileToZip[] = [];
    const pdfsMap: Record<string, { fileName: string; pdfBytes: Uint8Array }> = {};

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
        const { fileName, pdfBytes } = await composeCertificatePdf(
          template,
          field,
          rec,
          fileNamePattern
        );
        results.push({ fileName, data: pdfBytes });
        pdfsMap[rec.id] = { fileName, pdfBytes };
      } catch (err) {
        console.error(`Error generando certificado para ${rec.name}:`, err);
      }

      // Dejar un pequeño respiro para que el hilo de UI renderice la animación y barra
      if (i % 3 === 0) {
        await new Promise((res) => setTimeout(res, 10));
      }
    }

    setPregeneratedPdfs(pdfsMap);

    // Empaquetar ZIP y compilar PDF multipágina consolidado
    setProgress((prev) => ({ ...prev, status: 'zipping' }));
    await new Promise((res) => setTimeout(res, 50));

    try {
      const zipBlob = createZipArchive(results);

      // Crear versión consolidada multipágina (todas las hojas en un solo PDF)
      const combinedBytes = await composeCombinedCertificatePdf(
        template,
        field,
        validRecipients
      );
      const pdfBlob = new Blob([combinedBytes as BlobPart], { type: 'application/pdf' });

      setProgress({
        total: validRecipients.length,
        current: validRecipients.length,
        status: 'completed',
        generatedCount: results.length,
        zipBlob,
        pdfBlob,
      });

      // Disparar confetti
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#7c3aed', '#38bdf8', '#10b981', '#f59e0b'],
      });
    } catch (err) {
      console.error('Error empaquetando archivos:', err);
      setProgress((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'Ocurrió un error al empaquetar los archivos de salida.',
      }));
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
  };

  const handleDownloadZip = () => {
    if (progress.zipBlob) {
      triggerDownload(progress.zipBlob, `Certificados_Individuales_${Date.now()}.zip`);
    }
  };

  const handleDownloadCombinedPdf = () => {
    if (progress.pdfBlob) {
      triggerDownload(
        progress.pdfBlob,
        `Certificados_Consolidados_Todas_Las_Paginas_${Date.now()}.pdf`
      );
    }
  };

  const percentage =
    progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="space-y-6 animate-fadeIn mx-auto max-w-5xl transition-all duration-300">
      {/* Encabezado según estado */}
      {progress.status !== 'completed' ? (
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Generar Certificados
          </h2>
          <p className="text-sm text-slate-600">
            Revisa el formato de los archivos y genera los certificados de tus {validRecipients.length} participantes.
          </p>
        </div>
      ) : (
        <div className="text-center max-w-2xl mx-auto space-y-2 animate-fadeIn">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 border border-emerald-200 shadow-xs">
            <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            ¡{progress.generatedCount} Certificados generados con éxito!
          </h2>
          <p className="text-sm text-slate-600">
            Descárgalos directamente en tu equipo o envíalos automáticamente por correo con Gmail.
          </p>
        </div>
      )}

      <Card className="p-6 sm:p-8 space-y-6">
        {/* Estado 1: Idle (Antes de generar) */}
        {progress.status === 'idle' && (
          <div className="py-4 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto text-brand-600 border border-brand-200 shadow-xs">
                <Zap className="w-7 h-7 stroke-[2]" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Todo listo para generar {validRecipients.length} certificados
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Los certificados se renderizan con gráficos vectoriales nítidos a máxima resolución.
              </p>
            </div>

            {/* Custom File Naming Pattern Box */}
            <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 max-w-xl mx-auto">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Settings2 className="w-4 h-4 text-brand-600" />
                <span>Formato de nombre de los archivos PDF</span>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={fileNamePattern}
                  onChange={(e) => setFileNamePattern(e.target.value)}
                  placeholder="Ej: {nombre} - Certificado UNI"
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />

                <div className="space-y-1 pt-0.5">
                  <span className="text-xs font-medium text-slate-500 block">
                    Ejemplo de archivo resultante:
                  </span>
                  <p className="font-mono text-xs font-bold text-brand-700 break-all">
                    {sampleFileName}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="md"
                leftIcon={<ChevronLeft className="w-4 h-4" />}
                onClick={onBack}
              >
                Volver a Revisión
              </Button>
              <Button
                variant="primary"
                size="lg"
                leftIcon={<Sparkles className="w-5 h-5" />}
                onClick={startGeneration}
                className="px-8 shadow-md"
              >
                Comenzar Generación
              </Button>
            </div>
          </div>
        )}

        {/* Estado 2: Generando o Zipping */}
        {(progress.status === 'generating' || progress.status === 'zipping') && (
          <div className="py-8 space-y-6 max-w-lg mx-auto text-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-brand-50 border border-brand-200 rounded-full text-xs font-semibold text-brand-700 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                {progress.status === 'zipping'
                  ? 'Empaquetando ZIP y PDF multipágina...'
                  : 'Generando certificados...'}
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {progress.status === 'zipping'
                  ? 'Compilando archivos finales'
                  : `Procesando: ${progress.currentName || '...'}`}
              </h3>
            </div>

            <ProgressBar
              progress={percentage}
              label={`Certificado ${progress.current} de ${progress.total}`}
            />

            <div>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancelar proceso
              </Button>
            </div>
          </div>
        )}

        {/* Estado 3: Completed (¡Certificados ya generados y listos para descargar o enviar!) */}
        {progress.status === 'completed' && (
          <div className="space-y-8 animate-fadeIn">
            {/* 1. Opciones de descarga en tu equipo */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wide">
                <Download className="w-4 h-4 text-brand-600" />
                <span>1. Descargar en tu equipo</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Opción A: Archivo ZIP */}
                <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-brand-600 shadow-xs shrink-0">
                      <FileArchive className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 block">
                        Archivo .ZIP
                      </span>
                      <span className="text-xs text-slate-500">
                        {progress.generatedCount} certificados individuales en PDF
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Download className="w-4 h-4" />}
                    onClick={handleDownloadZip}
                    className="w-full justify-center shadow-xs"
                  >
                    Descargar Archivo ZIP
                  </Button>
                </div>

                {/* Opción B: PDF Consolidado todas las páginas */}
                <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-emerald-600 shadow-xs shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-slate-900 block">
                        PDF Consolidado
                      </span>
                      <span className="text-xs text-slate-500">
                        Un solo PDF con todas las páginas ({progress.generatedCount} págs)
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Download className="w-4 h-4" />}
                    onClick={handleDownloadCombinedPdf}
                    className="w-full justify-center bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                  >
                    Descargar PDF Único
                  </Button>
                </div>
              </div>
            </div>

            {/* 2. Envío por correo (ahora sí, porque ya están generados) */}
            <EmailDispatcherSection
              recipients={validRecipients}
              template={template}
              field={field}
              fileNamePattern={fileNamePattern}
              pregeneratedCertificates={pregeneratedPdfs}
            />

            {/* Botón para reiniciar lote */}
            <div className="pt-6 border-t border-slate-200 text-center">
              <Button
                variant="outline"
                size="md"
                leftIcon={<RefreshCw className="w-4 h-4" />}
                onClick={onResetAll}
              >
                Crear Nuevo Lote de Certificados
              </Button>
            </div>
          </div>
        )}

        {/* Estado 4: Cancelado o Error */}
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
