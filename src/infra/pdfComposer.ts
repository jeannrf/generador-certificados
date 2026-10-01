import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { FieldBox, TemplateData, Recipient } from '../domain/types';
import { transformTextCase } from '../domain/normalization';
import { normalizedToPdfCoords, calculateOptimalFontSize } from '../domain/layout';
import { generateSafeFileName } from '../domain/validation';

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
 * Genera un PDF individual para un destinatario estampando el nombre en la plantilla.
 */
export async function composeCertificatePdf(
  template: TemplateData,
  field: FieldBox,
  recipient: Recipient
): Promise<{ fileName: string; pdfBytes: Uint8Array }> {
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

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { width: pageWidth, height: pageHeight } = firstPage.getSize();

  // Seleccionar fuente estándar de pdf-lib
  let standardFont = StandardFonts.HelveticaBold;
  if (field.fontFamily.toLowerCase().includes('serif') || field.fontFamily.toLowerCase().includes('playfair') || field.fontFamily.toLowerCase().includes('cormorant')) {
    standardFont = StandardFonts.TimesRomanBold;
  } else if (field.fontFamily.toLowerCase().includes('mono')) {
    standardFont = StandardFonts.CourierBold;
  }
  const font = await pdfDoc.embedFont(standardFont);

  // Transformar texto según configuración
  const transformedText = transformTextCase(recipient.name, field.textCase);

  // Coordenadas de la caja en puntos PDF
  const coords = normalizedToPdfCoords(field, pageWidth, pageHeight);

  // Calcular tamaño óptimo de fuente
  const { fontSize } = calculateOptimalFontSize(
    transformedText,
    field.maxFontSize,
    field.minFontSize,
    coords.widthPt,
    (txt, sz) => font.widthOfTextAtSize(txt, sz)
  );

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

  // Estampar el texto
  firstPage.drawText(transformedText, {
    x: Math.max(0, drawX),
    y: Math.max(0, drawY),
    size: fontSize,
    font,
    color: textColor,
  });

  const pdfBytes = await pdfDoc.save();
  const fileName = generateSafeFileName(transformedText);

  return {
    fileName,
    pdfBytes,
  };
}
