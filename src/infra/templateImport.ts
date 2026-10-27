import { PDFDocument } from 'pdf-lib';
import { TemplatePage } from '../domain/types';
import {
  assertCanAddPages,
  assertSupportedFile,
  imagePageSizePt,
  mimeTypeForFormat,
  readImageInfo,
  TemplateFileError,
} from '../domain/templatePages';
import { renderPdfToPreview } from './pdfRenderer';

let pageCounter = 0;

function newPageId(): string {
  pageCounter += 1;
  return `page_${Date.now().toString(36)}_${pageCounter}`;
}

async function loadPdf(bytes: Uint8Array, fileName: string): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes);
  } catch (err) {
    const encrypted = err instanceof Error && err.message.toLowerCase().includes('encrypt');
    throw new TemplateFileError(
      encrypted ? 'ENCRYPTED_PDF' : 'CORRUPT_FILE',
      encrypted
        ? `"${fileName}" está protegido con contraseña. Expórtalo sin protección e inténtalo de nuevo.`
        : `"${fileName}" está dañado o incompleto y no se puede leer.`
    );
  }
}

/**
 * Separa un PDF en PDFs de una sola página. `copyPages` copia solo los recursos que usa cada
 * página, así que cada una sigue siendo vectorial y no arrastra el resto del documento.
 */
export async function splitPdfPages(source: PDFDocument): Promise<Uint8Array[]> {
  const result: Uint8Array[] = [];
  for (let i = 0; i < source.getPageCount(); i++) {
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(source, [i]);
    single.addPage(copied);
    result.push(await single.save());
  }
  return result;
}

/**
 * Convierte un archivo subido en páginas de plantilla, validando formato, integridad y límites.
 * @param currentPageCount páginas que ya tiene la plantilla
 * @param replacing true si el archivo va a sustituir a una página existente
 */
export async function importTemplateFile(
  file: File,
  currentPageCount: number,
  replacing = false
): Promise<TemplatePage[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = assertSupportedFile(bytes, file.name);

  if (format === 'pdf') {
    const source = await loadPdf(bytes, file.name);
    const pageCount = source.getPageCount();
    if (pageCount === 0) {
      throw new TemplateFileError('EMPTY_PDF', `"${file.name}" no contiene páginas.`);
    }
    assertCanAddPages(currentPageCount, pageCount, file.name, replacing);

    const singlePages = await splitPdfPages(source);
    const pages: TemplatePage[] = [];
    for (let i = 0; i < singlePages.length; i++) {
      const rendered = await renderPdfToPreview(singlePages[i]);
      pages.push({
        id: newPageId(),
        sourceName: pageCount > 1 ? `${file.name} (pág. ${i + 1})` : file.name,
        kind: 'pdf',
        bytes: singlePages[i],
        mimeType: 'application/pdf',
        widthPt: rendered.widthPt,
        heightPt: rendered.heightPt,
        previewUrl: rendered.previewUrl,
      });
    }
    return pages;
  }

  assertCanAddPages(currentPageCount, 1, file.name, replacing);
  const info = readImageInfo(bytes, format, file.name);

  // Comprobar que pdf-lib (el mismo que genera los certificados) puede incrustarla
  try {
    const probe = await PDFDocument.create();
    if (format === 'png') {
      await probe.embedPng(bytes);
    } else {
      await probe.embedJpg(bytes);
    }
  } catch {
    throw new TemplateFileError('CORRUPT_FILE', `"${file.name}" está dañado o usa una variante de imagen no soportada.`);
  }

  const mimeType = mimeTypeForFormat(format);
  return [
    {
      id: newPageId(),
      sourceName: file.name,
      kind: 'image',
      bytes,
      mimeType,
      ...imagePageSizePt(info),
      previewUrl: URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType })),
    },
  ];
}
