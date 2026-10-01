# 09 · Buenas prácticas y patrones de diseño

## Patrones de diseño aplicados

| Patrón | Dónde | Para qué |
|---|---|---|
| **Puertos y adaptadores** | `domain` define interfaces; `infra` las implementa | Cambiar librerías sin tocar el negocio |
| **Strategy** | `MailProvider` (AppsScript, Brevo, Resend) | Intercambiar proveedores de correo |
| **Strategy + Factory** | `FileParser` por extensión (`CsvParser`, `XlsxParser`, `TxtParser`) | Añadir formatos sin condicionales dispersos |
| **Pipeline** | Generación: normalizar → ajustar texto → dibujar → serializar | Pasos pequeños, probables y reordenables |
| **Observer / eventos** | Progreso del Worker y de la cola de envío | Desacoplar el proceso de la UI |
| **Command + Cola** | Cola de envío persistente (enviar, reintentar, cancelar) | Reanudar y controlar errores |
| **Máquina de estados** | Wizard y estados de envío | Transiciones válidas explícitas |
| **Repository** | Persistencia local (IndexedDB) | Aislar el almacenamiento |
| **Result / Either** | Operaciones que pueden fallar | Errores como valores, no excepciones sueltas |

## Interfaces clave (referencia)

```typescript
interface FileParser {
  supports(file: File): boolean;
  parse(file: File): Promise<ParsedTable>;      // { headers: string[]; rows: string[][] }
}

interface CertificateComposer {
  compose(input: { template: Template; fields: FieldBox[]; values: Record<string,string> }): Promise<Uint8Array>;
}

interface MailProvider {
  readonly id: string;
  ping(): Promise<Result<{ remainingQuota?: number }, MailError>>;
  send(msg: OutgoingMail): Promise<Result<{ remainingQuota?: number }, MailError>>;
}
```

## Convenciones de código

- **TypeScript `strict: true`**, sin `any` (usar `unknown` + validación con Zod).
- Funciones pequeñas y puras en `domain`; efectos secundarios solo en `infra` y `features`.
- Un archivo = una responsabilidad. Máximo orientativo: 250 líneas por archivo, 40 por función.
- Nombres en inglés para código, textos de interfaz en español (vía i18n).
- Componentes React: funcionales, con *hooks* personalizados para la lógica (`useRecipients`, `useGeneration`).
- Sin estado global innecesario; derivar en lugar de duplicar.
- Imports absolutos con alias (`@/domain/...`) y regla de ESLint que prohíbe imports entre capas incorrectas (`eslint-plugin-boundaries` o `import/no-restricted-paths`).

## Rendimiento

- Generación en **Web Worker**; la UI solo recibe eventos de progreso.
- Procesar en flujo: generar un PDF, añadirlo al ZIP y liberar memoria; no acumular todos los PDFs sin comprimir.
- Cargar la plantilla y las fuentes **una vez** por lote.
- *Code splitting*: pdf.js, SheetJS y fflate se importan dinámicamente solo cuando se usan.
- Presupuesto inicial: JS de la pantalla de entrada < 200 KB gzip.

## Manejo de errores

- Errores tipados y con código (`ParseError`, `ValidationError`, `RenderError`, `MailError`).
- Nunca `catch` vacío. Registrar con un logger mínimo (`shared/logger`) que **no incluya datos personales**.
- *Error boundary* global en React con opción de reiniciar sin perder el proyecto.

## Git y proceso

- **Trunk-based** con ramas cortas: `feat/…`, `fix/…`, `docs/…`.
- **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).
- Pull requests pequeños, con descripción, capturas de UI y checklist de DoD.
- Cada PR debe pasar CI (lint, tipos, pruebas, build) antes de fusionarse.

## Documentación en el código

- Comentarios para el **porqué**, no el qué.
- TSDoc en interfaces públicas.
- Toda decisión técnica relevante se registra en `12-decisiones-adr.md`.
