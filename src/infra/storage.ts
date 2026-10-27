import { FieldBox, TemplateData } from '../domain/types';
import { migrateLegacyFields, migrateLegacyTemplate } from '../domain/templatePages';

/**
 * Almacenamiento local persistente con IndexedDB para guardar el estado del Wizard
 * evitando la pérdida de datos ante recargas (F5) o cierres accidentales.
 */

const DB_NAME = 'GeneradorCertificadosDB';
const DB_VERSION = 1;
const STORE_NAME = 'wizardState';
const STATE_KEY = 'activeSession';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB no soportado en este entorno.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface PersistedSession {
  currentStep: number;
  maxStepUnlocked: number;
  template: TemplateData | null;
  fields: FieldBox[];
  tableData: any;
  mapping: any;
  recipients: any[];
  fileNamePattern?: string;
  savedAt: number;
}

/**
 * Guarda la sesión actual de forma asíncrona en IndexedDB.
 */
export async function saveSession(session: Partial<PersistedSession>): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const request = store.put({ ...session, savedAt: Date.now() }, STATE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('No se pudo guardar la sesión en IndexedDB:', err);
  }
}

/**
 * Recupera la sesión guardada si existe.
 */
export async function loadSession(): Promise<PersistedSession | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const request = store.get(STATE_KEY);
      request.onsuccess = () => resolve(request.result ? migrateSession(request.result) : null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('No se pudo recuperar la sesión de IndexedDB:', err);
    return null;
  }
}

/**
 * Migración de sesiones guardadas antes de las plantillas multipágina:
 * `template` de un solo archivo → `template.pages` con 1 página, y `field` → `fields` en esa página.
 * Es idempotente: una sesión ya migrada se devuelve igual.
 */
export function migrateSession(raw: Record<string, unknown>): PersistedSession {
  const template = migrateLegacyTemplate(raw.template);
  const fields = migrateLegacyFields(raw.fields, raw.field, template) ?? [];
  const { field: _legacyField, ...rest } = raw;
  return { ...(rest as unknown as PersistedSession), template, fields };
}

/**
 * Borra la sesión persistida (ej. al reiniciar el lote o crear uno nuevo).
 */
export async function clearSession(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const request = store.delete(STATE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('No se pudo borrar la sesión de IndexedDB:', err);
  }
}
