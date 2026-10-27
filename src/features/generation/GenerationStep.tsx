import React, { useState, useRef, useMemo } from 'react';
import { Recipient, TemplateData, FieldBox, GenerationProgress } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';
import { composeCertificatePdf, composeCombinedCertificatePdf } from '../../infra/pdfComposer';
import { formatCertificateFileName } from '../../domain/validation';
import { TemplateFileError } from '../../domain/templatePages';
import { createZipArchive, triggerDownload, FileToZip } from '../../infra/zipExporter';
import confetti from 'canvas-confetti';
import { EmailDispatcherSection } from './EmailDispatcherSection';
import { useDriveUpload } from './useDriveUpload';
import { DriveUploadOptions, DriveUploadResult } from './DriveUploadPanel';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  FileArchive,
  RefreshCw,
  ChevronLeft,
  Sparkles,
  FileText,
  Settings2,
} from 'lucide-react';

interface GenerationStepProps {
  recipients: Recipient[];
  template: TemplateData;
  fields: FieldBox[];
  onBack: () => void;
  onResetAll: () => void;
}

export const GenerationStep: React.FC<GenerationStepProps> = ({
  recipients,
  template,
  fields,
  onBack,
  onResetAll,
}) => {
  // Filtrar solo los válidos o con advertencia (excluyendo errores)
  const validRecipients = useMemo(
    () => recipients.filter((r) => !r.issues.some((i) => i.severity === 'error')),
    [recipients]
  );
  const drive = useDriveUpload({ template, fields, recipients: validRecipients });

  // Con Drive activo, los correos pueden incluir {enlace}: el PDF de cada persona en Drive
  const emailRecipients = useMemo(
    () =>
      validRecipients.map((r) => {
        const link = drive.linkFor(r.id);
        return link ? { ...r, extra: { ...r.extra, enlace: link } } : r;
      }),
    // linkFor solo cambia cuando cambia el progreso guardado (drive.batch)
    [validRecipients, drive.batch]
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
    // Drive va primero: si hace falta iniciar sesión, la ventana de Google debe abrirse en este clic
    try {
      await drive.begin();
    } catch (err) {
      setProgress((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'No se pudo preparar Google Drive.',
      }));
      return;
    }

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
          fields,
          rec,
          fileNamePattern,
          drive.contextFor(rec.id)
        );
        results.push({ fileName, data: pdfBytes });
        pdfsMap[rec.id] = { fileName, pdfBytes };
        await drive.enqueue(rec.id, fileName, pdfBytes);
      } catch (err) {
        // Un problema de la plantilla afecta a todo el lote: detenerse en vez de fallar persona por persona
        if (err instanceof TemplateFileError) {
          setProgress((prev) => ({ ...prev, status: 'error', errorMessage: err.message }));
          return;
        }
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
        fields,
        validRecipients,
        undefined,
        (rec) => drive.contextFor(rec.id)
      );
      const pdfBlob = new Blob([combinedBytes as BlobPart], { type: 'application/pdf' });

      // Esperar a que terminen las subidas a Drive que sigan en curso
      await drive.finish();

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
        colors: ['#208077', '#38bdf8', '#10b981', '#f59e0b'],
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
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900">
                Todo listo para generar {validRecipients.length} certificados
              </h3>
            </div>

            {/* Custom File Naming Pattern Box */}
            <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 max-w-xl mx-auto">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Settings2 className="w-4 h-4 text-[#208077]" />
                <span>Formato de nombre de los archivos PDF</span>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  value={fileNamePattern}
                  onChange={(e) => setFileNamePattern(e.target.value)}
                  placeholder="Ej: {nombre} - Certificado UNI"
                  className="w-full text-xs font-semibold rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-[#208077] focus:border-[#208077]"
                />

                <div className="space-y-1 pt-0.5">
                  <span className="text-xs font-medium text-slate-500 block">
                    Ejemplo de archivo resultante:
                  </span>
                  <p className="font-mono text-xs font-bold text-[#208077] break-all">
                    {sampleFileName}
                  </p>
                </div>
              </div>
            </div>

            <DriveUploadOptions drive={drive} />

            <div className="flex flex-col-reverse sm:flex-row items-center justify-center gap-3 pt-2 w-full">
              <Button
                variant="outline"
                size="md"
                leftIcon={<ChevronLeft className="w-4 h-4" />}
                onClick={onBack}
                className="w-full sm:w-auto justify-center"
              >
                Volver a Revisión
              </Button>
              <Button
                variant="primary"
                size="lg"
                leftIcon={<Sparkles className="w-5 h-5" />}
                onClick={startGeneration}
                disabled={drive.active && !drive.accountEmail}
                className="w-full sm:w-auto px-8 shadow-md justify-center"
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
              <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-[#f0faf9] border border-[#b2e5df] rounded-full text-xs font-semibold text-[#208077] animate-pulse">
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
              {drive.active && (
                <p className="text-xs text-slate-500" aria-live="polite">
                  {drive.status === 'preparing'
                    ? 'Preparando la carpeta en Google Drive...'
                    : `Guardados en Google Drive: ${drive.uploadedCount} de ${validRecipients.length}`}
                </p>
              )}
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
                <Download className="w-4 h-4 text-[#208077]" />
                <span>1. Descargar en tu equipo</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Opción A: Archivo ZIP */}
                <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-[#208077] shadow-xs shrink-0">
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
                        Un solo PDF con todas las páginas ({progress.generatedCount * template.pages.length} págs)
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

              <DriveUploadResult
                drive={drive}
                total={validRecipients.length}
                onRetry={() => drive.retryPending(pregeneratedPdfs)}
              />
            </div>

            {/* 2. Envío por correo (ahora sí, porque ya están generados) */}
            <EmailDispatcherSection
              recipients={emailRecipients}
              extraVariables={drive.active ? ['enlace'] : []}
              buildAttachment={async (rec) =>
                pregeneratedPdfs?.[rec.id] ??
                composeCertificatePdf(template, fields, rec, fileNamePattern, drive.contextFor(rec.id))
              }
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
