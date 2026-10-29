import React from 'react';
import { AlertTriangle, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useDriveUpload } from './useDriveUpload';

type DriveUpload = ReturnType<typeof useDriveUpload>;

const GoogleIcon: React.FC = () => (
  <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

/**
 * Opciones de Google Drive antes de generar (fila de la hoja de ajustes del paso 5).
 */
export const DriveUploadOptions: React.FC<{ drive: DriveUpload }> = ({ drive }) => {
  if (!drive.clientId) {
    return drive.needsDrive ? (
      <p role="alert" className="flex items-start gap-2 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
        Guardar en Google Drive no está configurado en esta app, así que los QR que abren el PDF no se incluirán.
      </p>
    ) : (
      <p className="text-sm text-slate-500">No disponible en esta app.</p>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={drive.enabled}
          onChange={(e) => drive.setEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-[#208077]"
        />
        <span className="text-sm">
          <span className="font-semibold text-[#0F2E2B]">Guardar en mi Google Drive</span>
          <span className="mt-0.5 block text-slate-600">Cada QR abrirá su PDF. Cualquiera con el enlace podrá verlo.</span>
        </span>
      </label>

      {drive.enabled && (
        <div className="space-y-3 pl-7">
          {drive.accountEmail ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              <span>
                Conectado como <span className="font-semibold text-[#0F2E2B]">{drive.accountEmail}</span>
              </span>
              <button
                type="button"
                onClick={drive.connect}
                disabled={drive.connecting}
                className="font-semibold text-[#208077] underline underline-offset-2 disabled:opacity-50"
              >
                Cambiar cuenta
              </button>
            </p>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={drive.connect}
              disabled={drive.connecting}
              leftIcon={drive.connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
            >
              Conectar con Google
            </Button>
          )}

          {drive.resumable && drive.batch ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-700">
              <span>
                Se continuará en «{drive.batch.folderName}» ({drive.uploadedCount} ya guardados).
              </span>
              <button type="button" onClick={drive.startOver} className="font-semibold text-[#208077] underline underline-offset-2">
                Usar carpeta nueva
              </button>
            </p>
          ) : (
            <label className="block max-w-sm">
              <span className="mb-1.5 block text-sm font-semibold text-[#0F2E2B]">Carpeta</span>
              <input
                type="text"
                value={drive.folderName}
                onChange={(e) => drive.setFolderName(e.target.value)}
                className="w-full rounded-[6px] border border-slate-300 bg-white px-3 py-2 text-sm text-[#0F2E2B] focus:border-[#208077] focus:outline-none focus:ring-2 focus:ring-[#208077]/20"
              />
            </label>
          )}
        </div>
      )}

      {drive.needsDrive && !drive.enabled && (
        <p className="pl-7 text-sm text-amber-800">Sin Drive, los QR que abren el PDF no se incluirán.</p>
      )}
      {drive.errorMessage && drive.status === 'idle' && (
        <p role="alert" className="pl-7 text-sm text-rose-700">{drive.errorMessage}</p>
      )}
    </div>
  );
};

/**
 * Fila de Google Drive en la tabla de entrega, con reintento si algo quedó pendiente.
 */
export const DriveDeliveryRow: React.FC<{
  drive: DriveUpload;
  total: number;
  onRetry: () => void;
}> = ({ drive, total, onRetry }) => {
  if (!drive.active || drive.status === 'idle') return null;
  const pending = total - drive.uploadedCount;

  const busy = drive.status === 'uploading' || drive.status === 'preparing';
  const needsRetry = (drive.status === 'error' || drive.status === 'needsAuth') && pending > 0;

  return (
    <tr className="align-top">
      <th scope="row" className="px-4 py-4 text-left font-semibold text-[#0F2E2B] sm:px-5">
        Google Drive
        {drive.batch?.folderName && (
          <span className="block text-sm font-normal text-slate-600">Carpeta «{drive.batch.folderName}»</span>
        )}
      </th>
      <td className="px-4 py-4 text-slate-700">
        <span className="flex items-center gap-2 tabular-nums" aria-live="polite">
          {busy && <Loader2 className="h-4 w-4 animate-spin text-[#208077]" aria-hidden="true" />}
          {drive.uploadedCount} de {total} guardados
        </span>
        {needsRetry && (
          <span role="alert" className="mt-1 block text-sm text-amber-800">
            {drive.errorMessage ?? `Faltan ${pending} por subir.`}
          </span>
        )}
      </td>
      <td className="px-4 py-4 text-right sm:px-5">
        {needsRetry ? (
          <Button variant="outline" size="sm" className="whitespace-nowrap" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
            {drive.status === 'needsAuth' ? 'Reconectar y continuar' : `Reintentar (${pending})`}
          </Button>
        ) : (
          drive.folderUrl && (
            <a
              href={drive.folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-[6px] border border-slate-300 px-3 text-sm font-semibold text-[#0F2E2B] transition-colors hover:border-[#208077] hover:text-[#208077] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077]"
            >
              Abrir carpeta <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )
        )}
      </td>
    </tr>
  );
};
