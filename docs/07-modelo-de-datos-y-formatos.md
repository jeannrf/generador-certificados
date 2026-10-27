# 07 · Modelo de datos y formatos

## Tipos del dominio (TypeScript, referencia)

```typescript
type TemplateKind = 'pdf' | 'image';

/** Una página de la plantilla (ver ADR-009) */
interface TemplatePage {
  id: string;                 // estable: los campos apuntan aquí
  sourceName: string;
  kind: TemplateKind;
  bytes: Uint8Array;          // PDF de 1 página (vectorial) o imagen original
  mimeType: string;
  widthPt: number;            // tamaño VISIBLE en puntos PDF (rotación ya aplicada)
  heightPt: number;
  previewUrl: string;
}

interface TemplateData {
  id: string;
  name: string;
  pages: TemplatePage[];      // 1 a 5, en el orden de salida
}

/** Coordenadas NORMALIZADAS (0–1) desde la esquina superior izquierda DE SU PÁGINA. */
interface FieldBox {
  id: string;                 // 'field_name' = nombre del destinatario (obligatorio)
  name: string;
  pageId: string;             // TemplatePage.id
  source: { type: 'column'; column: string } | { type: 'fixed'; value: string };
  x: number; y: number; width: number; height: number;
  fontFamily: string;
  maxFontSize: number;        // en pt
  minFontSize: number;
  color: string;              // #RRGGBB
  align: 'left' | 'center' | 'right';
  vAlign: 'top' | 'middle' | 'bottom';
  textCase: 'original' | 'title' | 'upper';
}

interface Recipient {
  id: string;                 // estable durante la sesión
  rowNumber: number;          // fila original (para reportes)
  name: string;
  email?: string;
  extra: Record<string, string>;
  issues: Issue[];
}

interface Issue { severity: 'warning' | 'error'; code: IssueCode; message: string }
type IssueCode = 'EMPTY_NAME' | 'EMPTY_EMAIL' | 'INVALID_EMAIL' | 'DUPLICATE' | 'NAME_TOO_LONG' | 'TEXT_OVERFLOW' | 'TRIMMED' | 'EMPTY_FIELD';
```

## Sistema de coordenadas (crítico)

- La UI trabaja con origen **arriba-izquierda** (como el DOM/canvas).
- PDF usa origen **abajo-izquierda**.
- Se almacena todo **normalizado (0–1)** respecto a la página. La conversión ocurre en un solo lugar (`domain/certificate/layout.ts`):

```
xPt = box.x * pageWidthPt
yPt = pageHeightPt - (box.y + box.height) * pageHeightPt   // base inferior de la caja
```

Esto hace que la vista previa (cualquier zoom o pantalla) y el PDF final coincidan.

## Plantillas multipágina

- De 1 a 5 páginas. Cada archivo subido agrega páginas al final; un PDF de varias páginas aporta todas y cuenta para el límite.
- Formatos: PDF, PNG y JPG, detectados por su firma (no por la extensión). Se pueden mezclar formatos, tamaños y orientaciones.
- Límites: 15 MB por archivo, 40 MB por plantilla, 8000 px por lado y 25 MP por imagen.
- Se rechazan: formatos no soportados, PDFs protegidos con contraseña o dañados, PNG con CRC inválido o truncados y JPG sin marcador de fin.
- Salida: siempre 1 PDF por persona con todas las páginas en el orden de la plantilla.

## Plantillas de imagen

- Cada imagen se convierte en una página del tamaño de la imagen (px × 0,75 → pt a 96 dpi) con la imagen original incrustada a página completa, **sin recomprimir ni redimensionar**.
- Se respetan las 8 orientaciones EXIF de los JPG (rotadas y espejadas).

## Páginas PDF

- Se conservan vectoriales. El CropBox y el `/Rotate` se aplican al generar, así la página sale como se ve en la vista previa.
- Se conservan los enlaces web (anotaciones Link con URI) en su misma posición visible; los formularios y comentarios no.

## Fuentes

- Catálogo de ~106 fuentes de Google Fonts elegidas para certificados (`domain/fontCatalog.ts`), en 5 categorías: serif, sans serif, manuscrita, decorativa y monoespaciada. Se elige con un selector con buscador (sin distinguir tildes) y filtros por categoría.
- **El PDF usa la fuente real**: el TTF (subconjunto latino, con tildes y ñ) se descarga de Fontsource la primera vez que se usa y se incrusta con **subconjunto de glifos** (`@pdf-lib/fontkit`), por lo que cada certificado pesa pocos KB más. `fontkit` se carga a demanda en un archivo aparte.
- Negrita e itálica solo se ofrecen si la fuente las tiene; nunca se simulan, para que la vista previa coincida con el PDF.
- Times New Roman y Courier siguen como fuentes estándar de PDF (no se descargan).
- Si una fuente no se puede descargar (sin conexión), se usa la fuente estándar equivalente y el certificado igual se genera. Los valores de fuente guardados por versiones anteriores se siguen reconociendo.
- Para agregar una fuente: consultar `https://api.fontsource.org/v1/fonts/<id>` y copiar sus pesos y estilos al catálogo.

## Migración de sesiones de una página

`infra/storage.ts → migrateSession` convierte al cargar una sesión guardada con el formato anterior: `template` → `template.pages` con 1 página (si era un PDF de varias páginas se usa la primera, como ya avisaba la app) y `field` → `fields` con ese campo en la página 1. Es idempotente y no toca los certificados ya descargados.

## Formatos de lista

| Formato | Reglas |
|---|---|
| **CSV** | UTF-8 (con o sin BOM); delimitador autodetectado (`,` `;` tab); primera fila = encabezados |
| **XLSX/XLS** | Primera hoja por defecto; selector si hay varias; primera fila = encabezados |
| **TXT** | Una persona por línea; `nombre` o `nombre,correo` / `nombre;correo` |

Archivo de ejemplo recomendado:

```csv
nombre,correo
Ana María Pérez,ana@ejemplo.com
José Luis Núñez,jose@ejemplo.com
```

## Normalización de nombres

- `trim` y colapsar espacios múltiples.
- Eliminar caracteres de control y de ancho cero.
- Opción **Título**: primera letra en mayúscula por palabra, excepto partículas (`de`, `del`, `la`, `las`, `los`, `y`, `e`, `van`, `von`, `da`, `di`) cuando no son la primera palabra. Respetar apóstrofes y guiones (`O'Connor`, `Pérez-Gil`).
- Opción **Original**: respeta el texto tal cual.
- Usar siempre `Intl`/`toLocaleUpperCase('es')` y normalización Unicode NFC.

## Validación

- Correo: expresión razonable (`algo@dominio.tld`); no intentar cubrir todo el RFC. Se valida la forma, no la existencia.
- Duplicados: por correo (si existe) o por nombre normalizado en minúsculas.
- Nombre vacío = error. Nombre más largo que el mínimo permitido en la caja = advertencia.
- Límite de seguridad: máx. 5.000 filas por lote (configurable).

## Nombres de archivo seguros

Eliminar `/ \ : * ? " < > |` y caracteres de control, recortar a 100 caracteres, y evitar duplicados con sufijo ` (2)`, ` (3)`.

## Fuentes

- Cada fuente declara `{ family, file, license }` en un registro tipado (`infra/pdf/fonts.ts`).
- Se embeben **solo los glifos usados** (`subset: true` en pdf-lib/fontkit) para PDFs pequeños.
- Verificar que la fuente soporte los caracteres de la lista; si falta un glifo, mostrar advertencia por fila.
