import React, { useState, useRef, useMemo } from 'react';
import { Recipient, TemplateData, FieldBox, GenerationProgress } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { StepActions } from '../../ui/StepActions';
import { ProgressBar } from '../../ui/ProgressBar';
import { composeCertificatePdf } from '../../infra/pdfComposer';
import { formatCertificateFileName } from '../../domain/validation';
import { TemplateFileError } from '../../domain/templatePages';
import { createZipArchive, triggerDownload, FileToZip } from '../../infra/zipExporter';
import { EmailDispatcherSection } from './EmailDispatcherSection';
import { useDriveUpload } from './useDriveUpload';
import { DriveUploadOptions, DriveDeliveryRow } from './DriveUploadPanel';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Download, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

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

  const [confirmingReset, setConfirmingReset] = useState<boolean>(false);

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

    // Empaquetar ZIP
    setProgress((prev) => ({ ...prev, status: 'zipping' }));
    await new Promise((res) => setTimeout(res, 50));

    try {
      const zipBlob = createZipArchive(results);

      // Esperar a que terminen las subidas a Drive que sigan en curso
      await drive.finish();

      setProgress({
        total: validRecipients.length,
        current: validRecipients.length,
        status: 'completed',
        generatedCount: results.length,
        zipBlob,
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

  const percentage =
    progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const certificateLabel = (n: number) => `${n} ${n === 1 ? 'certificado' : 'certificados'}`;

  // Antes de generar: hoja de ajustes; durante: progreso; al terminar: entrega y correo
  if (progress.status === 'completed') {
    return (
      <div className="mx-auto max-w-5xl space-y-8 animate-fadeIn">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-[#208077]" aria-hidden="true" />
            {progress.generatedCount} {progress.generatedCount === 1 ? 'certificado generado' : 'certificados generados'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Descárgalos, ábrelos en Drive o envíalos por correo a cada persona.
          </p>
        </div>

        <section aria-labelledby="entrega-title">
          <h3 id="entrega-title" className="mb-3 text-base font-bold text-[#0F2E2B]">Entrega</h3>
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <caption className="sr-only">Dónde quedaron los certificados</caption>
              <thead className="bg-[#E7F1EF] text-left text-xs font-semibold uppercase tracking-[0.08em] [font-stretch:80%] text-[#0F2E2B]">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold sm:px-5">Destino</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Estado</th>
                  <th scope="col" className="px-4 py-2 sm:px-5">
                    <span className="sr-only">Acción</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0F2E2B]/[0.08]">
                <tr className="align-top">
                  <th scope="row" className="px-4 py-4 text-left font-semibold text-[#0F2E2B] sm:px-5">
                    Tu equipo
                    <span className="hidden text-sm font-normal text-slate-600 sm:block">Un .zip con un PDF por persona</span>
                  </th>
                  <td className="px-4 py-4 tabular-nums text-slate-700">{progress.generatedCount} PDF listos</td>
                  <td className="px-4 py-4 text-right sm:px-5">
                    <Button size="sm" className="whitespace-nowrap" leftIcon={<Download className="h-4 w-4" />} onClick={handleDownloadZip}>
                      Descargar ZIP
                    </Button>
                  </td>
                </tr>
                <DriveDeliveryRow
                  drive={drive}
                  total={validRecipients.length}
                  onRetry={() => drive.retryPending(pregeneratedPdfs)}
                />
              </tbody>
            </table>
          </Card>
        </section>

        <EmailDispatcherSection
          recipients={emailRecipients}
          extraVariables={drive.active ? ['enlace'] : []}
          buildAttachment={async (rec) =>
            pregeneratedPdfs?.[rec.id] ??
            composeCertificatePdf(template, fields, rec, fileNamePattern, drive.contextFor(rec.id))
          }
        />

        <div className="border-t border-slate-200 pt-6">
          <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => setConfirmingReset(true)}>
            Empezar otro lote
          </Button>
        </div>

        <ConfirmDialog
          isOpen={confirmingReset}
          title="¿Empezar otro lote?"
          confirmLabel="Empezar de cero"
          tone="danger"
          onCancel={() => setConfirmingReset(false)}
          onConfirm={() => {
            setConfirmingReset(false);
            onResetAll();
          }}
        >
          <p>
            Se borran la plantilla, los campos y la lista de esta sesión. Si aún no descargaste el ZIP, hazlo antes.
          </p>
          {drive.active && <p className="mt-2 text-slate-600">Los PDF guardados en Google Drive se quedan allí.</p>}
        </ConfirmDialog>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Genera los certificados</h2>
        <p className="mt-1 text-sm text-slate-600">
          {validRecipients.length} {validRecipients.length === 1 ? 'persona' : 'personas'} en la lista. Revisa cómo se
          guardarán antes de generarlos.
        </p>
      </div>

      {progress.status === 'idle' && (
        <>
          <Card className="divide-y divide-[#0F2E2B]/[0.08] p-0">
            <div className="grid gap-3 px-4 py-5 sm:grid-cols-[180px_1fr] sm:px-6">
              <label htmlFor="file-name-pattern" className="text-sm font-semibold text-[#0F2E2B]">
                Nombre de cada PDF
              </label>
              <div>
                <input
                  id="file-name-pattern"
                  type="text"
                  value={fileNamePattern}
                  onChange={(e) => setFileNamePattern(e.target.value)}
                  placeholder="{nombre} - Certificado"
                  className="w-full rounded-[6px] border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F2E2B] focus:border-[#208077] focus:outline-none focus:ring-2 focus:ring-[#208077]/20"
                />
                <p className="mt-1.5 text-sm text-slate-600">
                  Así se verá: <span className="break-all font-mono text-sm text-[#0F2E2B]">{sampleFileName}</span>
                </p>
              </div>
            </div>
            <div className="grid gap-3 px-4 py-5 sm:grid-cols-[180px_1fr] sm:px-6">
              <span className="text-sm font-semibold text-[#0F2E2B]">Google Drive</span>
              <DriveUploadOptions drive={drive} />
            </div>
          </Card>

          <StepActions
            onBack={onBack}
            primaryLabel={`Generar ${certificateLabel(validRecipients.length)}`}
            onPrimary={startGeneration}
            primaryDisabled={drive.active && !drive.accountEmail}
            disabledReason="Conecta tu cuenta de Google o desactiva Drive"
          />
        </>
      )}

      {(progress.status === 'generating' || progress.status === 'zipping') && (
        <Card className="space-y-5 p-6 sm:p-8">
          <div aria-live="polite">
            <h3 className="text-lg font-bold text-[#0F2E2B]">
              {progress.status === 'zipping' ? 'Preparando el ZIP…' : 'Generando certificados…'}
            </h3>
            {progress.status === 'generating' && progress.currentName && (
              <p className="mt-1 truncate text-sm text-slate-600">{progress.currentName}</p>
            )}
            {drive.active && (
              <p className="mt-1 text-sm text-slate-600">
                {drive.status === 'preparing'
                  ? 'Preparando la carpeta en Google Drive…'
                  : `Guardados en Google Drive: ${drive.uploadedCount} de ${validRecipients.length}`}
              </p>
            )}
          </div>
          <ProgressBar progress={percentage} label={`Certificado ${progress.current} de ${progress.total}`} />
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Cancelar
          </Button>
        </Card>
      )}

      {(progress.status === 'cancelled' || progress.status === 'error') && (
        <Card className="p-6 sm:p-8">
          <div role="alert" className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
            <div>
              <h3 className="text-base font-bold text-[#0F2E2B]">
                {progress.status === 'cancelled'
                  ? 'Cancelaste la generación'
                  : progress.errorMessage || 'No se pudieron generar los certificados'}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                No se descargó nada. Puedes intentarlo de nuevo con los mismos datos.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" onClick={startGeneration}>
              Generar de nuevo
            </Button>
            <Button variant="outline" size="sm" onClick={onBack}>
              Volver a la revisión
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
