import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker de pdf.js usando el worker compilado de pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface RenderedPdfInfo {
  previewUrl: string;
  widthPt: number;
  heightPt: number;
  numPages: number;
}

/**
 * Renderiza la primera página de un archivo PDF a una imagen de alta resolución en base64
 * para su visualización interactiva en el Canvas y vista previa del navegador.
 */
export async function renderPdfToPreview(pdfBytes: Uint8Array): Promise<RenderedPdfInfo> {
  // Crear una copia del buffer para evitar desacoplamientos
  const data = pdfBytes.slice();

  const loadingTask = pdfjsLib.getDocument({
    data,
    cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  // Obtener la primera página
  const page = await pdfDoc.getPage(1);

  // Escala base (1.0 representa dimensiones en puntos PDF a 72 DPI)
  const unscaledViewport = page.getViewport({ scale: 1.0 });
  const widthPt = Math.round(unscaledViewport.width);
  const heightPt = Math.round(unscaledViewport.height);

  // Renderizar a 2x de escala para que se vea súper nítido en pantallas Retina/HD
  const renderScale = Math.max(1.5, Math.min(2.5, 2000 / Math.max(widthPt, heightPt)));
  const viewport = page.getViewport({ scale: renderScale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new Error('No se pudo inicializar el contexto 2D del canvas');
  }

  // Fondo blanco por defecto para PDFs transparentes
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: context,
    viewport,
  };

  await page.render(renderContext).promise;

  const previewUrl = canvas.toDataURL('image/png', 0.95);

  return {
    previewUrl,
    widthPt,
    heightPt,
    numPages,
  };
}
