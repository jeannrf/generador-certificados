import { FieldBox } from '../domain/types';

/**
 * Crea una imagen de plantilla de certificado elegante en un Canvas y la convierte a Uint8Array y DataURL
 */
export function createDemoCertificateCanvas(
  style: 'classic' | 'modern' | 'minimal'
): { bytes: Uint8Array; previewUrl: string; widthPt: number; heightPt: number; defaultField: Partial<FieldBox> } {
  const canvas = document.createElement('canvas');
  // Tamaño estándar A4 horizontal a 150 DPI (1754 x 1240 px) -> En puntos PDF 72 DPI (842 x 595 pt)
  const width = 1754;
  const height = 1240;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  if (style === 'classic') {
    // Fondo crema suave con bordes dorados y azul marino
    ctx.fillStyle = '#faf8f2';
    ctx.fillRect(0, 0, width, height);

    // Marco exterior azul marino
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#0f172a';
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // Marco interior dorado fino
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#d97706';
    ctx.strokeRect(65, 65, width - 130, height - 130);

    // Esquinas ornamentales
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(80, 80, 10, 0, Math.PI * 2);
    ctx.arc(width - 80, 80, 10, 0, Math.PI * 2);
    ctx.arc(80, height - 80, 10, 0, Math.PI * 2);
    ctx.arc(width - 80, height - 80, 10, 0, Math.PI * 2);
    ctx.fill();

    // Encabezado
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d97706';
    ctx.font = '600 32px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '8px';
    ctx.fillText('INSTITUTO DE ALTOS ESTUDIOS', width / 2, 220);

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 72px "Playfair Display", Georgia, serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('DIPLOMA DE RECONOCIMIENTO', width / 2, 330);

    ctx.fillStyle = '#475569';
    ctx.font = '400 28px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText('Por haber completado satisfactoriamente el programa de formación profesional, se otorga a:', width / 2, 440);

    // Línea de firma y pie
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width * 0.2, height - 240);
    ctx.lineTo(width * 0.42, height - 240);
    ctx.moveTo(width * 0.58, height - 240);
    ctx.lineTo(width * 0.8, height - 240);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '500 22px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '0px';
    ctx.fillText('Dirección Académica', width * 0.31, height - 200);
    ctx.fillText('Comité de Certificación', width * 0.69, height - 200);

    ctx.font = '400 18px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Lima, Octubre de 2026 • Registro Oficial Nº 84920-AC', width / 2, height - 120);

    return {
      bytes: dataUriToUint8Array(canvas.toDataURL('image/png')),
      previewUrl: canvas.toDataURL('image/png'),
      widthPt: 842,
      heightPt: 595,
      defaultField: {
        x: 0.05,
        y: 0.42,
        width: 0.90,
        height: 0.13,
        fontFamily: 'Playfair Display, serif',
        maxFontSize: 28,
        minFontSize: 20,
        color: '#0f172a',
        align: 'center',
        vAlign: 'middle',
        textCase: 'title',
        isBold: true,
      },
    };
  } else if (style === 'modern') {
    // Fondo moderno oscuro o gradiente tecnológico
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(0.5, '#111827');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Acentos geométricos
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, width - 120, height - 120);

    ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(80, 80, width - 160, height - 160);

    // Título
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a78bfa';
    ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '10px';
    ctx.fillText('GLOBAL TECH ACADEMY', width / 2, 220);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 68px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('CERTIFICADO DE ASISTENCIA', width / 2, 320);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '400 26px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText('Demostró excelencia y participación activa en el Bootcamp de Inteligencia Artificial', width / 2, 420);

    // Pie
    ctx.fillStyle = '#64748b';
    ctx.font = '400 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('ID de Verificación: GTA-2026-AI-8819 • Expedido el 01/10/2026', width / 2, height - 140);

    return {
      bytes: dataUriToUint8Array(canvas.toDataURL('image/png')),
      previewUrl: canvas.toDataURL('image/png'),
      widthPt: 842,
      heightPt: 595,
      defaultField: {
        x: 0.05,
        y: 0.42,
        width: 0.90,
        height: 0.13,
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        maxFontSize: 28,
        minFontSize: 20,
        color: '#38bdf8',
        align: 'center',
        vAlign: 'middle',
        textCase: 'title',
        isBold: true,
      },
    };
  } else {
    // Minimalista / Nórdico
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 50, width - 100, height - 100);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText('WORKSHOP CERTIFICATION', width / 2, 230);

    ctx.fillStyle = '#1e293b';
    ctx.font = '600 60px "Montserrat", sans-serif';
    ctx.letterSpacing = '1px';
    ctx.fillText('Constancia de Participación', width / 2, 330);

    ctx.fillStyle = '#64748b';
    ctx.font = '400 26px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Otorgado formalmente a favor de:', width / 2, 430);

    return {
      bytes: dataUriToUint8Array(canvas.toDataURL('image/png')),
      previewUrl: canvas.toDataURL('image/png'),
      widthPt: 842,
      heightPt: 595,
      defaultField: {
        x: 0.05,
        y: 0.42,
        width: 0.90,
        height: 0.13,
        fontFamily: 'Montserrat, sans-serif',
        maxFontSize: 28,
        minFontSize: 20,
        color: '#0f172a',
        align: 'center',
        vAlign: 'middle',
        textCase: 'title',
        isBold: true,
      },
    };
  }
}

function dataUriToUint8Array(dataURI: string): Uint8Array {
  const byteString = atob(dataURI.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return ia;
}

export const DEMO_CSV_CONTENT = `nombre,correo
Ana María Pérez Rodríguez,ana.perez@ejemplo.com
José Luis Núñez de la Torre,jose.nunez@ejemplo.com
Maximiliano Alejandro de la Fuente y Montalbán,maximiliano.fuente@ejemplo.com
María Elena O'Connor-Gómez,maria.oconnor@ejemplo.com
Carlos Alberto Mendoza Silva,carlos.mendoza@ejemplo.com
Sofía Valentina Ramos Vega,sofia.ramos@ejemplo.com
Lucas Gabriel Hernández Soto,lucas.hernandez@ejemplo.com
Camila Belén Castro Morales,camila.castro@ejemplo.com`;
