/**
 * Inicio de sesión con Google en el navegador (Google Identity Services, modelo de token).
 * Solo se pide el permiso drive.file: la app ve únicamente los archivos que ella misma crea.
 */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
/** Se renueva el token si le quedan menos de 2 minutos */
const TOKEN_MARGIN_MS = 2 * 60 * 1000;

interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string; login_hint?: string }) => void;
}

interface GoogleOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => TokenClient;
  hasGrantedAllScopes: (response: TokenResponse, ...scopes: string[]) => boolean;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

export class DriveAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveAuthError';
  }
}

export function getGoogleClientId(): string | undefined {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  return id || undefined;
}

let scriptPromise: Promise<GoogleOAuth2> | null = null;

function loadGoogleIdentity(): Promise<GoogleOAuth2> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        const oauth2 = window.google?.accounts?.oauth2;
        if (oauth2) resolve(oauth2);
        else reject(new DriveAuthError('No se pudo inicializar el inicio de sesión de Google.'));
      };
      script.onerror = () => {
        scriptPromise = null;
        reject(new DriveAuthError('No se pudo cargar el inicio de sesión de Google. Revisa tu conexión.'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export interface DriveSession {
  /**
   * Devuelve un token válido. Si hace falta uno nuevo abre la ventana de Google, por eso la
   * primera llamada debe ocurrir dentro de un clic del usuario (los navegadores bloquean popups).
   * `loginHint`: correo de la cuenta que se quiere usar; Google la preselecciona.
   */
  getToken: (loginHint?: string) => Promise<string>;
  /** Abre siempre la ventana de Google para elegir cuenta (botón "Conectar" / "Cambiar cuenta") */
  signIn: () => Promise<string>;
  /** Fuerza pedir un token nuevo (tras un 401) */
  invalidate: () => void;
}

/**
 * Prepara la sesión. Llamar al activar la opción de Drive, ANTES del clic que sube los archivos,
 * para que el script de Google ya esté cargado y la ventana se abra sin ser bloqueada.
 */
export async function prepareDriveSession(clientId: string): Promise<DriveSession> {
  const oauth2 = await loadGoogleIdentity();
  let token: { value: string; expiresAt: number } | null = null;
  let pending: { resolve: (value: string) => void; reject: (err: Error) => void } | null = null;

  const client = oauth2.initTokenClient({
    client_id: clientId,
    scope: DRIVE_SCOPE,
    callback: (response) => {
      const current = pending;
      pending = null;
      if (!current) return;
      if (response.error || !response.access_token) {
        current.reject(new DriveAuthError(response.error_description || 'Google no concedió el acceso a Drive.'));
        return;
      }
      if (!oauth2.hasGrantedAllScopes(response, DRIVE_SCOPE)) {
        current.reject(new DriveAuthError('Debes permitir que la app cree archivos en tu Google Drive.'));
        return;
      }
      token = {
        value: response.access_token,
        expiresAt: Date.now() + Number(response.expires_in ?? 3600) * 1000,
      };
      current.resolve(token.value);
    },
    error_callback: (error) => {
      const current = pending;
      pending = null;
      current?.reject(
        new DriveAuthError(
          error.type === 'popup_closed'
            ? 'Cerraste la ventana de Google antes de terminar.'
            : 'No se pudo abrir la ventana de Google. Permite las ventanas emergentes para este sitio.'
        )
      );
    },
  });

  const requestToken = (overrides?: { prompt?: string; login_hint?: string }) =>
    new Promise<string>((resolve, reject) => {
      pending?.reject(new DriveAuthError('Se inició otra solicitud de acceso.'));
      pending = { resolve, reject };
      client.requestAccessToken(overrides);
    });

  return {
    getToken: (loginHint?: string) => {
      if (token && token.expiresAt - Date.now() > TOKEN_MARGIN_MS) return Promise.resolve(token.value);
      return requestToken(loginHint ? { login_hint: loginHint } : undefined);
    },
    signIn: () => {
      token = null;
      return requestToken({ prompt: 'select_account' });
    },
    invalidate: () => {
      token = null;
    },
  };
}
