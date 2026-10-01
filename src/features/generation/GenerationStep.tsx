import React, { useState, useRef } from 'react';
import { Recipient, TemplateData, FieldBox, GenerationProgress } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';
import { composeCertificatePdf, composeCombinedCertificatePdf } from '../../infra/pdfComposer';
import { formatCertificateFileName } from '../../domain/validation';
import { createZipArchive, triggerDownload, FileToZip } from '../../infra/zipExporter';
import confetti from 'canvas-confetti';
import { clsx } from 'clsx';
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
  Mail,
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
  const [activeTab, setActiveTab] = useState<'download' | 'email'>('download');
  const [progress, setProgress] = useState<GenerationProgress>({
    total: validRecipients.length,
    current: 0,
    status: 'idle',
    generatedCount: 0,
  });

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
      } catch (err) {
        console.error(`Error generando certificado para ${rec.name}:`, err);
      }

      // Dejar un pequeño respiro para que el hilo de UI renderice la animación y barra
      if (i % 3 === 0) {
        await new Promise((res) => setTimeout(res, 10));
      }
    }

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
      triggerDownload(progress.pdfBlob, `Certificados_Consolidados_Todas_Las_Paginas_${Date.now()}.pdf`);
    }
  };

  const percentage =
    progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Generar y Distribuir Certificados
        </h2>
        <p className="text-sm text-slate-600">
          Descarga todos los certificados en tu equipo (ZIP / PDF) o envíalos automáticamente por correo con tu cuenta de Gmail.
        </p>

        {/* Selector de modo: Descarga Local vs Envío por Correo */}
        <div className="flex items-center justify-center pt-2">
          <div className="inline-flex p-1 bg-slate-200/80 rounded-2xl border border-slate-300 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('download')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all',
                activeTab === 'download'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <FileArchive className="w-4 h-4 text-brand-600" />
              <span>Descarga Local (ZIP / PDF)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all',
                activeTab === 'email'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Mail className="w-4 h-4 text-indigo-600" />
              <span>Envío por Correo (Gmail)</span>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">
                Gratis
              </span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'download' ? (
        <Card className="p-6 sm:p-8 space-y-6">
          {/* State: Idle */}
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

              <div className="space-y-1.5">
                <input
                  type="text"
                  value={fileNamePattern}
                  onChange={(e) => setFileNamePattern(e.target.value)}
                  placeholder="Ej: {nombre} - Certificado UNI"
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400">Atajos rápidos:</span>
                  {[
                    '{nombre} - Certificado UNI',
                    'Certificado - {nombre}',
                    '[nombre] - Certificado 2026',
                    'Constancia - {nombre}',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFileNamePattern(preset)}
                      className="text-[11px] font-medium bg-white hover:bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/70 text-xs flex items-center justify-between text-slate-600">
                <span className="text-slate-500 font-medium">Ejemplo de archivo resultante:</span>
                <span className="font-mono text-[11px] font-bold text-brand-700 truncate max-w-[260px]">
                  {sampleFileName}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="md" leftIcon={<ChevronLeft className="w-4 h-4" />} onClick={onBack}>
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

        {/* State: Generating or Zipping */}
        {(progress.status === 'generating' || progress.status === 'zipping') && (
          <div className="py-8 space-y-6 max-w-lg mx-auto text-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-brand-50 border border-brand-200 rounded-full text-xs font-semibold text-brand-700 animate-pulse">
                <Sparkles className="w-3.5 h-3.5" />
                {progress.status === 'zipping' ? 'Empaquetando ZIP y PDF multipágina...' : 'Generando certificados...'}
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

        {/* State: Completed */}
        {progress.status === 'completed' && (
          <div className="py-6 space-y-6 text-center animate-fadeIn">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 border border-emerald-200 shadow-md">
              <CheckCircle2 className="w-9 h-9 stroke-[2]" />
            </div>

            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-xl font-bold text-slate-900">
                ¡{progress.generatedCount} Certificados generados con éxito!
              </h3>
              <p className="text-xs text-slate-500">
                Puedes descargar los certificados individuales en un ZIP o un único PDF consolidado con todas las páginas para impresión.
              </p>
            </div>

            {/* Download Options Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto text-left">
              {/* Option 1: ZIP */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-brand-600 shadow-xs">
                    <FileArchive className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Archivo .ZIP
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {progress.generatedCount} archivos individuales
                    </span>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={handleDownloadZip}
                  className="w-full"
                >
                  Descargar ZIP
                </Button>
              </div>

              {/* Option 2: Single Combined Multipage PDF */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-emerald-600 shadow-xs">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      PDF Consolidado
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Un solo PDF ({progress.generatedCount} páginas)
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={handleDownloadCombinedPdf}
                  className="w-full bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                >
                  Descargar PDF Único
                </Button>
              </div>
            </div>

            {/* Banner de invitación a enviar por correo */}
            <div className="p-4 bg-indigo-50/70 border border-indigo-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left max-w-xl mx-auto">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-2xs border border-indigo-100 shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    ¿Quieres enviarlos por correo a los participantes?
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Conéctalo con tu cuenta de Gmail gratis y sin intermediarios.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveTab('email')}
                className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
              >
                Ir a Enviar por Correo
              </Button>
            </div>

            <div className="pt-2">
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
      ) : (
        <EmailDispatcherSection
          recipients={validRecipients}
          template={template}
          field={field}
          fileNamePattern={fileNamePattern}
        />
      )}
    </div>
  );
};
