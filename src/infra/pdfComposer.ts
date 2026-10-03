import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { FieldBox, TemplateData, Recipient } from '../domain/types';
import { transformTextCase } from '../domain/normalization';
import { normalizedToPdfCoords, calculateOptimalFontSize } from '../domain/layout';
import { formatCertificateFileName } from '../domain/validation';

/**
 * Convierte color hex (#RRGGBB) a valores rgb de pdf-lib (0-1)
 */
function hexToPdfRgb(hex: string) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return rgb(isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b);
}

/**
 * Determina la fuente estándar de pdf-lib según la configuración del campo
 */
function getStandardFont(field: FieldBox): StandardFonts {
  const isSerif =
    field.fontFamily.toLowerCase().includes('serif') ||
    field.fontFamily.toLowerCase().includes('playfair') ||
    field.fontFamily.toLowerCase().includes('cormorant');
  const isMono = field.fontFamily.toLowerCase().includes('mono');
  const isBold = field.isBold ?? true;
  const isItalic = field.isItalic ?? false;

  if (isSerif) {
    if (isBold && isItalic) return StandardFonts.TimesRomanBoldItalic;
    if (isBold) return StandardFonts.TimesRomanBold;
    if (isItalic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (isMono) {
    if (isBold && isItalic) return StandardFonts.CourierBoldOblique;
    if (isBold) return StandardFonts.CourierBold;
    if (isItalic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique;
  if (isBold) return StandardFonts.HelveticaBold;
  if (isItalic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

/**
 * Estampa el nombre del destinatario en la página de un PDF según el FieldBox
 */
function drawRecipientText(
  page: PDFPage,
  field: FieldBox,
  font: any,
  name: string
): string {
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const transformedText = transformTextCase(name, field.textCase);
  const coords = normalizedToPdfCoords(field, pageWidth, pageHeight);

  // Autoajuste exacto usando las métricas reales de la fuente PDF
  const targetWidthPt = Math.max(10, coords.widthPt - 8);
  const optimal = calculateOptimalFontSize(
    transformedText,
    field.maxFontSize,
    field.minFontSize || 14,
    targetWidthPt,
    (txt, sz) => font.widthOfTextAtSize(txt, sz)
  );
  const fontSize = optimal.fontSize;

  const textWidth = font.widthOfTextAtSize(transformedText, fontSize);
  const textHeight = font.heightAtSize(fontSize);

  // Posicionamiento horizontal
  let drawX = coords.xPt;
  if (field.align === 'center') {
    drawX = coords.xPt + (coords.widthPt - textWidth) / 2;
  } else if (field.align === 'right') {
    drawX = coords.xPt + (coords.widthPt - textWidth);
  }

  // Posicionamiento vertical dentro de la caja
  let drawY = coords.yPt;
  if (field.vAlign === 'middle') {
    drawY = coords.yPt + (coords.heightPt - textHeight) / 2;
  } else if (field.vAlign === 'top') {
    drawY = coords.yPt + coords.heightPt - textHeight;
  }

  const textColor = hexToPdfRgb(field.color);

  page.drawText(transformedText, {
    x: Math.max(0, drawX),
    y: Math.max(0, drawY),
    size: fontSize,
    font,
    color: textColor,
  });

  return transformedText;
}

/**
 * Genera un PDF individual para un destinatario estampando el nombre en la plantilla.
 */
export async function composeCertificatePdf(
  template: TemplateData,
  baseField: FieldBox,
  recipient: Recipient,
  fileNamePattern?: string
): Promise<{ fileName: string; pdfBytes: Uint8Array }> {
  const field = recipient.customField ? { ...baseField, ...recipient.customField } : baseField;
  let pdfDoc: PDFDocument;

  if (template.kind === 'pdf') {
    pdfDoc = await PDFDocument.load(template.bytes);
  } else {
    // Plantilla de imagen (PNG / JPG)
    pdfDoc = await PDFDocument.create();
    let embeddedImg;
    if (template.mimeType.includes('png')) {
      embeddedImg = await pdfDoc.embedPng(template.bytes);
    } else {
      embeddedImg = await pdfDoc.embedJpg(template.bytes);
    }
    const page = pdfDoc.addPage([template.widthPt, template.heightPt]);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: template.widthPt,
      height: template.heightPt,
    });
  }

  const firstPage = pdfDoc.getPages()[0];
  const standardFont = getStandardFont(field);
  const font = await pdfDoc.embedFont(standardFont);
  const transformedText = drawRecipientText(firstPage, field, font, recipient.name);

  const pdfBytes = await pdfDoc.save();
  const fileName = formatCertificateFileName(
    fileNamePattern || '{nombre} - Certificado',
    transformedText,
    recipient.extra
  );

  return {
    fileName,
    pdfBytes,
  };
}

/**
 * Genera un ÚNICO archivo PDF multipágina que consolida todos los certificados juntos (ideal para imprenta).
 */
export async function composeCombinedCertificatePdf(
  template: TemplateData,
  baseField: FieldBox,
  recipients: Recipient[],
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  const combinedDoc = await PDFDocument.create();

  if (template.kind === 'pdf') {
    const srcDoc = await PDFDocument.load(template.bytes);
    for (let i = 0; i < recipients.length; i++) {
      const rec = recipients[i];
      const field = rec.customField ? { ...baseField, ...rec.customField } : baseField;
      const [copiedPage] = await combinedDoc.copyPages(srcDoc, [0]);
      combinedDoc.addPage(copiedPage);

      const standardFont = getStandardFont(field);
      const font = await combinedDoc.embedFont(standardFont);
      drawRecipientText(copiedPage, field, font, rec.name);

      if (onProgress) onProgress(i + 1, recipients.length);
    }
  } else {
    // Plantilla de imagen
    let embeddedImg;
    if (template.mimeType.includes('png')) {
      embeddedImg = await combinedDoc.embedPng(template.bytes);
    } else {
      embeddedImg = await combinedDoc.embedJpg(template.bytes);
    }

    for (let i = 0; i < recipients.length; i++) {
      const rec = recipients[i];
      const field = rec.customField ? { ...baseField, ...rec.customField } : baseField;
      const page = combinedDoc.addPage([template.widthPt, template.heightPt]);
      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: template.widthPt,
        height: template.heightPt,
      });

      const standardFont = getStandardFont(field);
      const font = await combinedDoc.embedFont(standardFont);
      drawRecipientText(page, field, font, rec.name);

      if (onProgress) onProgress(i + 1, recipients.length);
    }
  }

  return await combinedDoc.save();
}
