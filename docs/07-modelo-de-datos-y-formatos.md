# 07 · Modelo de datos y formatos

## Tipos del dominio (TypeScript, referencia)

```typescript
type TemplateKind = 'pdf' | 'image';

interface Template {
  kind: TemplateKind;
  bytes: Uint8Array;          // archivo original
  mimeType: string;
  widthPt: number;            // tamaño de página en puntos PDF
  heightPt: number;
}

/** Coordenadas NORMALIZADAS (0–1) desde la esquina superior izquierda. */
interface FieldBox {
  id: string;
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
type IssueCode = 'EMPTY_NAME' | 'INVALID_EMAIL' | 'DUPLICATE' | 'NAME_TOO_LONG' | 'TRIMMED';
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

## Plantillas de imagen

- Se crea un PDF con una página del tamaño de la imagen (px × 0,75 → pt a 96 dpi) y la imagen incrustada a página completa.
- PNG/JPG se incrustan sin recomprimir cuando es posible; si supera el límite, se redimensiona antes.

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
