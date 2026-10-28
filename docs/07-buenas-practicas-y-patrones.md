# 07 · Buenas prácticas y patrones de diseño

## Patrones aplicados

| Patrón | Dónde | Para qué |
|---|---|---|
| **Dominio puro + adaptadores** | `domain/` no conoce librerías; `infra/` las envuelve | Cambiar librerías sin tocar las reglas |
| **Pipeline** | `pdfComposer`: PDF base de la plantilla → estampar campos por persona → serializar | Pasos pequeños y probables |
| **Caché por lote** | PDF base (WeakMap por plantilla) y fuentes incrustadas | No reconstruir lo mismo en cada certificado |
| **Pool de tareas** | `shared/taskPool.ts` (3 subidas a Drive en paralelo) | Concurrencia acotada |
| **Idempotencia** | IDs reservados de Drive (409 = ya subido); estado por destinatario en correos | Reintentar sin duplicar |
| **Historial de deshacer** | `shared/undoHistory.ts` con agrupación de cambios rápidos | Ctrl+Z / Ctrl+Y en el editor |
| **Wizard por pasos** | `features/wizard` | Transiciones explícitas y navegación atrás sin perder datos |

## Convenciones de código

- **TypeScript `strict: true`** con `noUnusedLocals`. Evitar `any`; para datos externos usar `unknown` y validar.
- Funciones pequeñas y puras en `domain`; efectos secundarios solo en `infra` y `features`.
- Nombres en inglés para el código; textos de la interfaz y comentarios en español.
- Componentes funcionales; la lógica con estado va en *hooks* (`useDriveUpload`).
- Derivar en lugar de duplicar estado.
- Seguir el estilo del archivo que se edita (densidad de comentarios, nombres, formato).

## Rendimiento

- La plantilla se normaliza **una vez por lote**; cada certificado solo estampa sus campos.
- Las fuentes se descargan y se incrustan una vez, con subconjunto de glifos.
- `fontkit` y las librerías de PDF van en chunks separados (`vite.config.ts`).
- Ceder el hilo cada pocos certificados para que la barra de progreso se actualice.

## Manejo de errores

- Errores tipados donde aportan (`TemplateFileError`, `DriveApiError`, `DriveAuthError`).
- Nunca `catch` vacío sin comentario que explique por qué.
- Los mensajes dicen **qué pasó y qué hacer**. Nunca registrar nombres ni correos en la consola.

## Git y proceso

- Ramas cortas: `feat/…`, `fix/…`, `refactor/…`, `chore/…`, `docs/…`.
- **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
- Cada PR pasa el CI (tipos, Vitest, build y Playwright) antes de fusionarse.

## Documentación

- Comentarios para el **porqué**, no el qué.
- Toda decisión técnica relevante se registra en `10-decisiones-adr.md`.

## Textos y mensajes

- Español neutro, trato de "tú".
- Interfaz **minimalista**: pocas palabras, sin repetir lo que ya dice la etiqueta.
