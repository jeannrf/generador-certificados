import { TextCase } from './types';

// Partículas en español que no se capitalizan salvo que sean la primera palabra
const SPANISH_PARTICLES = new Set([
  'de', 'del', 'la', 'las', 'los', 'y', 'e', 'van', 'von', 'da', 'di', 'der', 'du'
]);

/**
 * Reemplaza los tokens {clave} y [clave] en una sola pasada. `lookup` devuelve el valor, o undefined
 * para dejar el token como está. La clave nunca se usa como expresión regular (un encabezado puede
 * ser "C++" o "Nota (final") y el valor se inserta literal, sin interpretar "$&" ni volver a leerse.
 */
export function replaceTokens(text: string, lookup: (key: string) => string | undefined): string {
  return text.replace(/\{([^{}]+)\}|\[([^[\]]+)\]/g, (match: string, curly?: string, square?: string) => {
    const key = (curly ?? square)!;
    const value = lookup(key);
    if (value !== undefined) return value;
    // No es una variable: puede traer una dentro, como en "[{curso}] Tu certificado"
    return `${match[0]}${replaceTokens(key, lookup)}${match[match.length - 1]}`;
  });
}

/**
 * Limpia y normaliza caracteres invisibles, espacios redundantes y caracteres de control.
 */
export function cleanString(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFC')
    // Eliminar caracteres de control y ancho cero
    .replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '')
    // Colapsar espacios múltiples a uno solo
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convierte un nombre al formato Title Case inteligente (respetando partículas en español).
 */
export function toTitleCase(input: string): string {
  const cleaned = cleanString(input);
  if (!cleaned) return '';

  const words = cleaned.split(' ');
  return words
    .map((word, index) => {
      // Apellidos compuestos con apóstrofo y/o guion: cada parte lleva mayúscula (O'Connor-Pérez)
      if (/['’-]/.test(word)) {
        return word
          .split(/(['’-])/)
          .map((part) => capitalizeWord(part))
          .join('');
      }

      const lower = word.toLocaleLowerCase('es');
      // Si no es la primera palabra y es partícula, va en minúscula
      if (index > 0 && SPANISH_PARTICLES.has(lower)) {
        return lower;
      }
      return capitalizeWord(word);
    })
    .join(' ');
}

function capitalizeWord(word: string): string {
  if (!word) return '';
  return word.charAt(0).toLocaleUpperCase('es') + word.slice(1).toLocaleLowerCase('es');
}

/**
 * Aplica la transformación de caso seleccionada.
 */
export function transformTextCase(text: string, textCase: TextCase): string {
  const cleaned = cleanString(text);
  switch (textCase) {
    case 'title':
      return toTitleCase(cleaned);
    case 'upper':
      return cleaned.toLocaleUpperCase('es');
    case 'original':
    default:
      return cleaned;
  }
}
