import { useEffect, useMemo, useRef, useState } from 'react';
import { FieldBox, Recipient, TemplateData } from '../../domain/types';
import { FieldContext, usesDriveLink } from '../../domain/fields';
import {
  defaultFolderName,
  DriveBatch,
  driveBatchKey,
  driveFileUrl,
  driveFolderUrl,
  sameAccount,
  pendingRecipientIds,
} from '../../domain/drive';
import { DriveAuthError, DriveSession, getGoogleClientId, prepareDriveSession } from '../../infra/drive/googleAuth';
import { createDriveClient, DriveClient } from '../../infra/drive/driveClient';
import { clearDriveBatch, loadDriveBatch, saveDriveBatch } from '../../infra/drive/driveBatchStorage';
import { createTaskPool } from '../../shared/taskPool';

const UPLOAD_CONCURRENCY = 3;

export type DriveUploadStatus = 'idle' | 'preparing' | 'uploading' | 'done' | 'needsAuth' | 'error';

interface UseDriveUploadArgs {
  template: TemplateData;
  fields: FieldBox[];
  recipients: Recipient[];
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado con Google Drive.';
}

/**
 * Guarda cada certificado en el Google Drive del organizador. Los IDs se reservan antes de generar
 * los PDFs para que el QR de cada uno ya apunte a su archivo definitivo.
 */
export function useDriveUpload({ template, fields, recipients }: UseDriveUploadArgs) {
  const clientId = getGoogleClientId();
  const needsDrive = usesDriveLink(fields);
  const recipientIds = useMemo(() => recipients.map((r) => r.id), [recipients]);
  const batchKey = useMemo(() => driveBatchKey(template.id, recipientIds), [template.id, recipientIds]);

  const [enabled, setEnabled] = useState<boolean>(Boolean(clientId) && needsDrive);
  const [folderName, setFolderName] = useState(() => defaultFolderName(template.name, new Date()));
  // Cuenta de Google conectada (donde se crea la carpeta); null hasta pulsar "Conectar con Google"
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<DriveUploadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [batch, setBatch] = useState<DriveBatch | null>(() => loadDriveBatch(batchKey));
  const [failedIds, setFailedIds] = useState<string[]>([]);

  const sessionRef = useRef<DriveSession | null>(null);
  const clientRef = useRef<DriveClient | null>(null);
  const batchRef = useRef<DriveBatch | null>(batch);
  const poolRef = useRef<ReturnType<typeof createTaskPool> | null>(null);
  const authLostRef = useRef(false);

  const active = enabled && Boolean(clientId);

  // Cargar el script de Google al activar la opción, para que la ventana de acceso se abra
  // directamente en el clic de "Conectar con Google" sin que el navegador la bloquee.
  useEffect(() => {
    if (!active || sessionRef.current || !clientId) return;
    let cancelled = false;
    prepareDriveSession(clientId)
      .then((session) => {
        if (cancelled) return;
        sessionRef.current = session;
        clientRef.current = createDriveClient({ getToken: session.getToken, onUnauthorized: session.invalidate });
      })
      .catch((err) => !cancelled && setErrorMessage(describeError(err)));
    return () => {
      cancelled = true;
    };
  }, [active, clientId]);

  const updateBatch = (next: DriveBatch) => {
    batchRef.current = next;
    setBatch(next);
    saveDriveBatch(next);
  };

  /** Botón "Conectar con Google" / "Cambiar cuenta": abre la ventana de Google para elegir cuenta. */
  const connect = async (): Promise<void> => {
    const session = sessionRef.current;
    const client = clientRef.current;
    if (!session || !client) {
      setErrorMessage('El inicio de sesión de Google todavía se está cargando. Inténtalo en unos segundos.');
      return;
    }
    setConnecting(true);
    setErrorMessage(null);
    try {
      await session.signIn();
      setAccountEmail(await client.getAccountEmail());
    } catch (err) {
      setAccountEmail(null);
      setErrorMessage(describeError(err));
    } finally {
      setConnecting(false);
    }
  };

  /**
   * Primer paso al pulsar "Comenzar Generación". Debe llamarse antes de cualquier otro `await`
   * del clic: si el token venció, vuelve a abrir la ventana de Google. Devuelve false si Drive no está activo.
   */
  const begin = async (): Promise<boolean> => {
    if (!active) return false;
    const session = sessionRef.current;
    const client = clientRef.current;
    if (!session || !client || !accountEmail) {
      throw new DriveAuthError('Conecta tu cuenta de Google para guardar los certificados en Drive.');
    }

    setStatus('preparing');
    setErrorMessage(null);
    setFailedIds([]);
    authLostRef.current = false;
    try {
      await session.getToken(accountEmail);

      // Si hubo que volver a entrar, confirmar que sigue siendo la misma cuenta antes de crear nada
      const connectedEmail = await client.getAccountEmail();
      if (!sameAccount(connectedEmail, accountEmail)) {
        setAccountEmail(connectedEmail);
        throw new DriveAuthError(`Ahora estás conectado como ${connectedEmail}. Revisa la cuenta y vuelve a generar.`);
      }

      const saved = loadDriveBatch(batchKey);
      if (saved && (!saved.accountEmail || sameAccount(saved.accountEmail, connectedEmail))) {
        // Reanudar en la misma carpeta con los mismos IDs: nada se duplica
        updateBatch(saved);
      } else {
        const name = folderName.trim() || defaultFolderName(template.name, new Date());
        const folder = await client.createFolder(name);
        await client.shareWithAnyoneReader(folder.id);

        const ids = await client.generateIds(recipientIds.length);
        updateBatch({
          batchKey,
          folderId: folder.id,
          folderName: name,
          accountEmail: connectedEmail,
          fileIds: Object.fromEntries(recipientIds.map((id, i) => [id, ids[i]])),
          uploaded: [],
          createdAt: new Date().toISOString(),
        });
      }
      poolRef.current = createTaskPool(UPLOAD_CONCURRENCY);
      setStatus('uploading');
      return true;
    } catch (err) {
      setStatus('error');
      setErrorMessage(describeError(err));
      throw err;
    }
  };

  const contextFor = (recipientId: string): FieldContext => {
    const fileId = batchRef.current?.fileIds[recipientId];
    return fileId ? { driveUrl: driveFileUrl(fileId) } : {};
  };

  const uploadOne = async (recipientId: string, fileName: string, bytes: Uint8Array): Promise<void> => {
    const current = batchRef.current;
    const client = clientRef.current;
    if (!current || !client || current.uploaded.includes(recipientId)) return;
    if (authLostRef.current) {
      setFailedIds((prev) => (prev.includes(recipientId) ? prev : [...prev, recipientId]));
      return;
    }
    try {
      await client.uploadPdf({ id: current.fileIds[recipientId], name: fileName, folderId: current.folderId, bytes });
      const latest = batchRef.current!;
      updateBatch({ ...latest, uploaded: [...latest.uploaded, recipientId] });
      setFailedIds((prev) => prev.filter((id) => id !== recipientId));
    } catch (err) {
      if (err instanceof DriveAuthError) authLostRef.current = true;
      setFailedIds((prev) => (prev.includes(recipientId) ? prev : [...prev, recipientId]));
      if (!(err instanceof DriveAuthError)) setErrorMessage(describeError(err));
    }
  };

  /** Encola la subida de un certificado ya generado (espera si hay demasiadas en curso). */
  const enqueue = async (recipientId: string, fileName: string, bytes: Uint8Array): Promise<void> => {
    if (!poolRef.current) return;
    await poolRef.current.add(() => uploadOne(recipientId, fileName, bytes));
  };

  /** Espera a que terminen las subidas en curso y deja el estado final. */
  const finish = async (): Promise<void> => {
    if (!poolRef.current) return;
    await poolRef.current.drain();
    const current = batchRef.current;
    const pending = current ? pendingRecipientIds(current, recipientIds) : recipientIds;
    if (authLostRef.current && pending.length > 0) {
      setStatus('needsAuth');
      setErrorMessage('La sesión de Google expiró antes de terminar. Vuelve a conectar para subir el resto.');
    } else {
      setStatus(pending.length === 0 ? 'done' : 'error');
    }
  };

  /**
   * Sube lo que falta (fallidos o pendientes por sesión vencida). Llamar desde un clic,
   * porque puede abrir la ventana de Google.
   */
  const retryPending = async (pdfs: Record<string, { fileName: string; pdfBytes: Uint8Array }>): Promise<void> => {
    const session = sessionRef.current;
    const current = batchRef.current;
    if (!session || !current) return;
    setErrorMessage(null);
    try {
      await session.getToken(accountEmail ?? undefined);
    } catch (err) {
      setStatus('needsAuth');
      setErrorMessage(describeError(err));
      return;
    }
    authLostRef.current = false;
    poolRef.current = createTaskPool(UPLOAD_CONCURRENCY);
    setStatus('uploading');
    for (const id of pendingRecipientIds(current, recipientIds)) {
      const pdf = pdfs[id];
      if (pdf) await enqueue(id, pdf.fileName, pdf.pdfBytes);
    }
    await finish();
  };

  /** Empieza de cero en una carpeta nueva (descarta la subida guardada). */
  const startOver = () => {
    clearDriveBatch();
    batchRef.current = null;
    setBatch(null);
    setStatus('idle');
    setFailedIds([]);
    setErrorMessage(null);
  };

  const uploadedCount = batch ? batch.uploaded.filter((id) => recipientIds.includes(id)).length : 0;
  const resumable = status === 'idle' && batch !== null && uploadedCount < recipientIds.length;

  return {
    clientId,
    needsDrive,
    enabled,
    setEnabled,
    active,
    folderName,
    setFolderName,
    accountEmail,
    connecting,
    connect,
    status,
    errorMessage,
    batch,
    uploadedCount,
    failedIds,
    resumable,
    folderUrl: batch ? driveFolderUrl(batch.folderId) : undefined,
    /** Enlace público del PDF de una persona, solo si ya está en Drive */
    linkFor: (recipientId: string) =>
      batch?.uploaded.includes(recipientId) ? driveFileUrl(batch.fileIds[recipientId]) : undefined,
    begin,
    contextFor,
    enqueue,
    finish,
    retryPending,
    startOver,
  };
}
