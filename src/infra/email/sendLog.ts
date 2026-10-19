import { DAILY_WINDOW_MS } from '../../domain/email';

// Compartido por ambos servicios: los dos envían desde la misma cuenta de Gmail
const SEND_LOG_KEY = 'email_send_log_v1';

const prune = (timestamps: number[]) => {
  const now = Date.now();
  return timestamps.filter((t) => typeof t === 'number' && now - t < DAILY_WINDOW_MS);
};

/**
 * Marcas de tiempo de los correos enviados con éxito en las últimas 24 h desde este navegador
 */
export function loadSendLog(): number[] {
  try {
    const raw = localStorage.getItem(SEND_LOG_KEY);
    return raw ? prune(JSON.parse(raw)) : [];
  } catch (err) {
    console.warn('Error leyendo el registro de envíos desde localStorage:', err);
    return [];
  }
}

/**
 * Registra un correo enviado con éxito y devuelve el registro actualizado
 */
export function recordSentEmail(): number[] {
  const updated = [...loadSendLog(), Date.now()];
  try {
    localStorage.setItem(SEND_LOG_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('No se pudo guardar el registro de envíos en localStorage:', err);
  }
  return updated;
}
