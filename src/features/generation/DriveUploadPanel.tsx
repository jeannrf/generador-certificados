import React from 'react';
import { AlertTriangle, ExternalLink, FolderUp, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/Button';
import { useDriveUpload } from './useDriveUpload';

type DriveUpload = ReturnType<typeof useDriveUpload>;

const GoogleIcon: React.FC = () => (
  <svg viewBox="0 0 48 48" className="w-3.5 h-3.5" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

/**
 * Opciones de Google Drive antes de generar.
 */
export const DriveUploadOptions: React.FC<{ drive: DriveUpload }> = ({ drive }) => {
  if (!drive.clientId) {
    return drive.needsDrive ? (
      <div role="alert" className="p-3 max-w-xl mx-auto bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-amber-600" />
        <span>Guardar en Google Drive no está configurado en esta app, así que los QR que abren el PDF no se incluirán.</span>
      </div>
    ) : null;
  }

  return (
    <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 max-w-xl mx-auto">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={drive.enabled}
          onChange={(e) => drive.setEnabled(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[#208077] cursor-pointer"
        />
        <span className="text-xs">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <FolderUp className="w-4 h-4 text-[#208077]" /> Guardar en mi Google Drive
          </span>
          <span className="text-slate-500 block mt-0.5">Cada QR abrirá su PDF. Cualquiera con el enlace podrá verlo.</span>
        </span>
      </label>

      {drive.enabled && (
        <div className="space-y-2.5 pl-7">
          {drive.accountEmail ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-600">
                Conectado como <span className="font-semibold text-slate-800">{drive.accountEmail}</span>
              </span>
              <button
                type="button"
                onClick={drive.connect}
                disabled={drive.connecting}
                className="font-semibold text-[#208077] underline cursor-pointer disabled:opacity-50"
              >
                Cambiar cuenta
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={drive.connect}
              disabled={drive.connecting}
              leftIcon={drive.connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GoogleIcon />}
            >
              Conectar con Google
            </Button>
          )}

          {drive.resumable && drive.batch ? (
            <div className="p-2.5 bg-[#f0faf9] border border-[#b2e5df] rounded-xl text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
              <span>
                Se continuará la subida en «{drive.batch.folderName}» ({drive.uploadedCount} listos).
              </span>
              <button type="button" onClick={drive.startOver} className="font-semibold text-[#208077] underline cursor-pointer">
                Usar carpeta nueva
              </button>
            </div>
          ) : (
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-slate-700">Carpeta</span>
              <input
                type="text"
                value={drive.folderName}
                onChange={(e) => drive.setFolderName(e.target.value)}
                className="w-full text-xs font-medium bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-[#208077] focus:outline-none"
              />
            </label>
          )}

        </div>
      )}

      {drive.needsDrive && !drive.enabled && (
        <p className="text-[11px] text-amber-700 pl-7">Sin Drive, los QR que abren el PDF no se incluirán.</p>
      )}
      {drive.errorMessage && drive.status === 'idle' && (
        <p role="alert" className="text-[11px] text-rose-600 pl-7">{drive.errorMessage}</p>
      )}
    </div>
  );
};

/**
 * Resultado de la subida a Drive, con reintento si algo quedó pendiente.
 */
export const DriveUploadResult: React.FC<{
  drive: DriveUpload;
  total: number;
  onRetry: () => void;
}> = ({ drive, total, onRetry }) => {
  if (!drive.active || drive.status === 'idle') return null;
  const pending = total - drive.uploadedCount;

  return (
    <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-[#208077] shadow-xs shrink-0">
            {drive.status === 'uploading' || drive.status === 'preparing' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <FolderUp className="w-5 h-5" />
            )}
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900 block">Google Drive</span>
            <span className="text-xs text-slate-500" aria-live="polite">
              {drive.uploadedCount} de {total} guardados
            </span>
          </div>
        </div>
        {drive.folderUrl && (
          <a
            href={drive.folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#208077] hover:underline"
          >
            Abrir carpeta <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {(drive.status === 'error' || drive.status === 'needsAuth') && pending > 0 && (
        <div role="alert" className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2">
          <span>{drive.errorMessage ?? `Faltan ${pending} por subir.`}</span>
          <Button variant="outline" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={onRetry}>
            {drive.status === 'needsAuth' ? 'Reconectar y continuar' : `Reintentar (${pending})`}
          </Button>
        </div>
      )}

    </div>
  );
};
