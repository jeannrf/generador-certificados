import { FieldBox, Recipient, TemplateData, TemplatePage } from './types';
import { cleanString } from './normalization';
import { getPageForField } from './templatePages';

/**
 * El campo de nombre es obligatorio y especial: su texto sale de `Recipient.name`,
 * se valida contra desbordes y admite ajustes individuales (`Recipient.customField`).
 * Los demás campos toman su texto de una columna de la lista o de un valor fijo.
 */
export const NAME_FIELD_ID = 'field_name';

type PageSize = Pick<TemplatePage, 'widthPt' | 'heightPt'>;

/**
 * Tamaño por defecto del nombre según la página: 28 pt en un A4 (842 pt) y proporcional
 * en páginas más grandes o más chicas (por ejemplo, ~50 pt en una imagen de 2000 px).
 */
export function defaultNameFontSize(page?: PageSize): number {
  if (!page) return 28;
  return Math.min(120, Math.max(16, Math.round(Math.max(page.widthPt, page.heightPt) / 30)));
}

/** El tamaño mínimo del autoajuste guarda la misma proporción que el máximo (20 pt para 28 pt). */
export function defaultMinFontSize(maxFontSize: number): number {
  return Math.round(maxFontSize * 0.7);
}

export function createNameField(pageId: string, page?: PageSize): FieldBox {
  const fontSize = defaultNameFontSize(page);
  return {
    id: NAME_FIELD_ID,
    name: 'Nombre del Destinatario',
    pageId,
    source: { type: 'column', column: 'nombre' },
    x: 0.05,
    y: 0.42,
    width: 0.90,
    height: 0.13,
    fontFamily: 'Playfair Display, Georgia, serif',
    maxFontSize: fontSize,
    minFontSize: defaultMinFontSize(fontSize),
    color: '#0f172a',
    align: 'center',
    vAlign: 'middle',
    textCase: 'title',
    isBold: true,
    isItalic: false,
  };
}

/** Corrimiento hacia arriba y a la izquierda cuando la posición por defecto ya está ocupada */
const CASCADE_STEP = { x: 0.04, y: 0.05 };
const SAME_SPOT_TOLERANCE = 0.02;

/**
 * Si en la página ya hay un campo en la posición donde se crearía el nuevo, lo corre en cascada
 * hacia arriba y a la izquierda. Así un campo nuevo nunca queda escondido exactamente debajo de otro.
 */
export function placeWithoutOverlap(field: FieldBox, existing: FieldBox[]): FieldBox {
  const samePage = existing.filter((f) => f.pageId === field.pageId);
  const isTaken = (x: number, y: number) =>
    samePage.some((f) => Math.abs(f.x - x) < SAME_SPOT_TOLERANCE && Math.abs(f.y - y) < SAME_SPOT_TOLERANCE);

  let { x, y } = field;
  for (let attempt = 0; attempt < 12 && isTaken(x, y); attempt++) {
    const nextX = x - CASCADE_STEP.x;
    const nextY = y - CASCADE_STEP.y;
    // Al llegar al borde, se reinicia la cascada más abajo para no salir de la página
    x = nextX >= 0 ? nextX : Math.min(1 - field.width, field.x);
    y = nextY >= 0 ? nextY : Math.min(1 - field.height, field.y + CASCADE_STEP.y);
  }
  return { ...field, x, y };
}

export function createTextField(pageId: string, existing: FieldBox[]): FieldBox {
  const extraCount = existing.filter((f) => f.id !== NAME_FIELD_ID).length;
  return placeWithoutOverlap({
    id: `field_${Date.now().toString(36)}_${extraCount + 1}`,
    name: `Campo ${extraCount + 1}`,
    pageId,
    source: { type: 'fixed', value: 'Texto fijo' },
    x: 0.3,
    y: 0.7,
    width: 0.4,
    height: 0.08,
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    maxFontSize: 30,
    minFontSize: defaultMinFontSize(30),
    color: '#0f172a',
    align: 'center',
    vAlign: 'middle',
    textCase: 'original',
    isBold: false,
    isItalic: false,
  }, existing);
}

/**
 * Campo QR cuadrado (en puntos) sobre la página, abajo a la derecha. Por defecto apunta al PDF en Drive.
 */
export function createQrField(page: Pick<TemplatePage, 'id' | 'widthPt' | 'heightPt'>, existing: FieldBox[]): FieldBox {
  const qrCount = existing.filter(isQrField).length;
  const sidePt = Math.min(page.widthPt, page.heightPt) * 0.18;
  const width = sidePt / page.widthPt;
  const height = sidePt / page.heightPt;
  return placeWithoutOverlap({
    id: `field_qr_${Date.now().toString(36)}_${qrCount + 1}`,
    name: qrCount === 0 ? 'Código QR' : `Código QR ${qrCount + 1}`,
    kind: 'qr',
    pageId: page.id,
    source: { type: 'driveLink' },
    x: 1 - width - 0.08,
    y: 1 - height - 0.1,
    width,
    height,
    fontFamily: 'Plus Jakarta Sans, sans-serif',
    maxFontSize: 12,
    minFontSize: 8,
    color: '#0f172a',
    align: 'center',
    vAlign: 'middle',
    textCase: 'original',
  }, existing);
}

export function isQrField(field: Pick<FieldBox, 'kind'>): boolean {
  return field.kind === 'qr';
}

/** Algún campo necesita el enlace a Google Drive (hay que subir los PDFs para que funcione). */
export function usesDriveLink(fields: FieldBox[]): boolean {
  return fields.some((f) => f.source.type === 'driveLink');
}

/** Posición y tamaño estándar del nombre para la página (botón "Restablecer"). */
export function resetNameFieldLayout(field: FieldBox, page: PageSize): FieldBox {
  const { x, y, width, height, maxFontSize, minFontSize } = createNameField(field.pageId, page);
  return { ...field, x, y, width, height, maxFontSize, minFontSize, isBold: true };
}

export function isNameField(field: Pick<FieldBox, 'id'>): boolean {
  return field.id === NAME_FIELD_ID;
}

export function getNameField(fields: FieldBox[]): FieldBox | undefined {
  return fields.find(isNameField);
}

export function fieldsForPage(fields: FieldBox[], pageId: string): FieldBox[] {
  return fields.filter((f) => f.pageId === pageId);
}

/** Aplica los ajustes individuales de la persona (solo afectan al campo de nombre). */
export function applyRecipientOverrides(field: FieldBox, recipient: Pick<Recipient, 'customField'>): FieldBox {
  if (!isNameField(field) || !recipient.customField) return field;
  // El ajuste individual nunca cambia la página ni la identidad del campo
  return { ...field, ...recipient.customField, id: field.id, pageId: field.pageId };
}

/** Datos de cada certificado que no vienen de la lista */
export interface FieldContext {
  /** URL del PDF de esta persona en Google Drive */
  driveUrl?: string;
}

/**
 * Contenido crudo (sin transformar mayúsculas) que lleva el campo para una persona:
 * el texto a escribir o, en un QR, el texto a codificar. Vacío = no se estampa.
 */
export function resolveFieldText(
  field: FieldBox,
  recipient: Pick<Recipient, 'name' | 'extra'>,
  context: FieldContext = {}
): string {
  if (isNameField(field)) return recipient.name;
  switch (field.source.type) {
    case 'fixed':
      return field.source.value;
    case 'driveLink':
      return context.driveUrl ?? '';
    case 'column':
      return cleanString(recipient.extra?.[field.source.column] ?? '');
  }
}

/**
 * Ajusta los campos a la plantilla actual:
 * - descarta los campos de páginas eliminadas (salvo el nombre, que pasa a la primera página);
 * - crea el campo de nombre si no existe.
 */
export function reconcileFieldsWithTemplate(fields: FieldBox[], template: TemplateData): FieldBox[] {
  if (template.pages.length === 0) return fields;
  const pageIds = new Set(template.pages.map((p) => p.id));
  const firstPageId = template.pages[0].id;

  const reconciled = fields.flatMap((f) => {
    if (pageIds.has(f.pageId)) return [f];
    return isNameField(f) ? [{ ...f, pageId: firstPageId }] : [];
  });

  if (!getNameField(reconciled)) {
    reconciled.unshift(createNameField(firstPageId, template.pages[0]));
  }
  return reconciled;
}

/** Opciones para `validateRecipients` según la plantilla y los campos actuales. */
export function buildValidationOptions(template: TemplateData | null, fields: FieldBox[]) {
  const nameField = getNameField(fields);
  return {
    field: nameField,
    templateWidthPt: template && nameField ? getPageForField(template, nameField).widthPt : undefined,
    extraFields: fields.filter((f) => !isNameField(f)),
  };
}

export function pageIdsInOrder(template: TemplateData): string[] {
  return template.pages.map((p) => p.id);
}

function normalizeHeader(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Campos (texto o QR) cuyo contenido sale de una columna de la lista. El nombre se mapea aparte. */
export function columnFields(fields: FieldBox[]): FieldBox[] {
  return fields.filter((f) => !isNameField(f) && f.source.type === 'column');
}

/** Campos de columna que todavía no tienen una columna válida de la lista cargada. */
export function unassignedColumnFields(fields: FieldBox[], headers: string[]): FieldBox[] {
  return columnFields(fields).filter((f) => f.source.type === 'column' && !headers.includes(f.source.column));
}

/**
 * Al cargar la lista, asigna sola la columna de cada campo cuando el encabezado coincide con la
 * columna escrita o con el nombre del campo (sin distinguir mayúsculas ni tildes). Las que no
 * coinciden quedan vacías para elegirlas a mano. Las ya válidas no se tocan.
 */
export function autoAssignColumns(fields: FieldBox[], headers: string[]): FieldBox[] {
  return fields.map((f) => {
    if (isNameField(f) || f.source.type !== 'column' || headers.includes(f.source.column)) return f;
    const wanted = [f.source.column, f.name].map(normalizeHeader).filter(Boolean);
    const match = headers.find((h) => wanted.includes(normalizeHeader(h)));
    return { ...f, source: { type: 'column', column: match ?? '' } };
  });
}
