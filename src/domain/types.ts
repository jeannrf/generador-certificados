export type TemplateKind = 'pdf' | 'image';

/**
 * Una página de la plantilla.
 * - PDF: un PDF de una sola página (se conserva vectorial). Si trae más páginas, solo se usa la primera.
 * - Imagen: los bytes originales PNG/JPG, sin recomprimir.
 * widthPt/heightPt son las dimensiones VISIBLES (ya aplicada la rotación /Rotate o la orientación EXIF).
 */
export interface TemplatePage {
  id: string;
  sourceName: string;
  kind: TemplateKind;
  bytes: Uint8Array;
  mimeType: string;
  widthPt: number;
  heightPt: number;
  previewUrl: string; // Object URL or Data URL for previewing in UI
}

/** Plantilla de 1 a MAX_TEMPLATE_PAGES páginas, en el orden en que salen en el PDF final. */
export interface TemplateData {
  id: string;
  name: string;
  pages: TemplatePage[];
}

export type TextCase = 'original' | 'title' | 'upper';
export type TextAlign = 'left' | 'center' | 'right';
export type TextVAlign = 'top' | 'middle' | 'bottom';

export type FieldKind = 'text' | 'qr';

/**
 * De dónde sale el contenido de un campo:
 * - column: una columna de la lista; fixed: igual en todos los certificados;
 * - driveLink: el enlace al PDF de esa persona en Google Drive (solo para QR).
 */
export type FieldSource =
  | { type: 'column'; column: string }
  | { type: 'fixed'; value: string }
  | { type: 'driveLink' };

/**
 * Coordenadas NORMALIZADAS (0 a 1) relativas al ancho y alto de la página a la que pertenece.
 */
export interface FieldBox {
  id: string;
  name: string;
  /** Texto (por defecto) o código QR */
  kind?: FieldKind;
  /** Página de la plantilla donde se estampa (TemplatePage.id) */
  pageId: string;
  source: FieldSource;
  x: number; // 0.0 - 1.0 (left)
  y: number; // 0.0 - 1.0 (top)
  width: number; // 0.0 - 1.0
  height: number; // 0.0 - 1.0
  fontFamily: string;
  maxFontSize: number; // en pt
  minFontSize: number; // en pt
  color: string; // hex #RRGGBB
  align: TextAlign;
  vAlign: TextVAlign;
  textCase: TextCase;
  isBold?: boolean;
  isItalic?: boolean;
}

export type IssueSeverity = 'warning' | 'error';
export type IssueCode = 'EMPTY_NAME' | 'EMPTY_EMAIL' | 'INVALID_EMAIL' | 'DUPLICATE' | 'NAME_TOO_LONG' | 'TEXT_OVERFLOW' | 'TRIMMED' | 'EMPTY_FIELD';

export interface Issue {
  severity: IssueSeverity;
  code: IssueCode;
  message: string;
}

export interface Recipient {
  id: string;
  rowNumber: number;
  name: string;
  email?: string;
  extra: Record<string, string>;
  issues: Issue[];
  /** Ajustes individuales del campo de nombre para esta persona */
  customField?: Partial<FieldBox>;
}

export interface ColumnMapping {
  nameColumn: string;
  emailColumn?: string;
}

export interface GenerationProgress {
  total: number;
  current: number;
  status: 'idle' | 'generating' | 'zipping' | 'completed' | 'cancelled' | 'error';
  currentName?: string;
  errorMessage?: string;
  generatedCount: number;
  zipBlob?: Blob;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface EmailConfig {
  senderName: string;
  subject: string;
  htmlBody: string;
}

export type EmailDeliveryStatus = 'pending' | 'sending' | 'sent' | 'error' | 'skipped';

export interface EmailDeliveryRecord {
  recipientId: string;
  name: string;
  email: string;
  status: EmailDeliveryStatus;
  errorMessage?: string;
  sentAt?: string;
}

export interface EmailSendProgress {
  status: 'idle' | 'testing' | 'sending' | 'paused' | 'completed' | 'cancelled';
  total: number;
  current: number;
  sentCount: number;
  failedCount: number;
  currentRecipientName?: string;
  remainingQuota?: number;
  records: Record<string, EmailDeliveryRecord>;
}


/**
 * Envío masivo persistido: guarda la lista a la que se envió y el estado de cada persona
 * para poder recuperarlo y reintentarlo aunque se recargue la página.
 */
export interface EmailCampaign {
  id: string;
  startedAt: string;
  updatedAt: string;
  subject: string;
  recipients: Recipient[];
  records: Record<string, EmailDeliveryRecord>;
}

export interface EmailCampaignSummary {
  total: number;
  sent: number;
  failed: number;
  /** Se estaba enviando cuando se cerró la página: no se sabe si llegó */
  unconfirmed: number;
  pending: number;
}
