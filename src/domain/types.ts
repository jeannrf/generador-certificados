export type TemplateKind = 'pdf' | 'image';

export interface TemplateData {
  id: string;
  name: string;
  kind: TemplateKind;
  bytes: Uint8Array;
  mimeType: string;
  widthPt: number;
  heightPt: number;
  previewUrl: string; // Object URL or Data URL for previewing in UI
}

export type TextCase = 'original' | 'title' | 'upper';
export type TextAlign = 'left' | 'center' | 'right';
export type TextVAlign = 'top' | 'middle' | 'bottom';

/**
 * Coordenadas NORMALIZADAS (0 a 1) relativas al ancho y alto de la plantilla.
 */
export interface FieldBox {
  id: string;
  name: string;
  source: { type: 'column'; column: string } | { type: 'fixed'; value: string };
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
export type IssueCode = 'EMPTY_NAME' | 'INVALID_EMAIL' | 'DUPLICATE' | 'NAME_TOO_LONG' | 'TEXT_OVERFLOW' | 'TRIMMED';

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
  pdfBlob?: Blob;
}

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface EmailConfig {
  webAppUrl: string;
  token?: string;
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

