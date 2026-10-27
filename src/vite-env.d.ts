/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** OAuth Client ID de Google Cloud para guardar certificados en Drive (opcional) */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
