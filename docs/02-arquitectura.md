# 02 · Arquitectura

## Visión general

SPA (Single Page Application) estática. Toda la lógica corre en el navegador. Una única pieza externa, opcional y propiedad del usuario, envía correos: un Google Apps Script desplegado en su propia cuenta.

```
┌───────────────────────── Navegador del usuario ─────────────────────────┐
│  UI (React)  ──►  Features  ──►  Dominio (TS puro)                      │
│                       │                                                 │
│                       ▼                                                 │
│               Adaptadores (infra)                                       │
│   pdf.js · pdf-lib · PapaParse · SheetJS · JSZip · IndexedDB            │
│                       │                                                 │
│        Web Worker (generación de PDFs, parseo pesado)                   │
└───────────────────────┬─────────────────────────────────────────────────┘
                        │ HTTPS (solo Fase 2, opcional)
                        ▼
         Google Apps Script (cuenta Gmail del organizador) ──► Gmail
```

## Principios

1. **Dominio puro**: la lógica de negocio no importa React, DOM ni librerías de PDF.
2. **Puertos y adaptadores (hexagonal)**: el dominio define interfaces; la infraestructura las implementa.
3. **Features verticales**: cada funcionalidad agrupa su UI, estado y lógica.
4. **Trabajo pesado fuera del hilo principal**: Web Workers.
5. **Sin estado oculto**: un único store tipado por feature, flujo de datos unidireccional.

## Capas

| Capa | Responsabilidad | Puede importar |
|---|---|---|
| `ui/` | Componentes visuales reutilizables, sin lógica de negocio | `shared` |
| `features/*` | Casos de uso: UI de la feature + estado + orquestación | `domain`, `infra` (vía puertos), `ui`, `shared` |
| `domain/` | Tipos, reglas, cálculos (layout, normalización, validación) | solo `shared` |
| `infra/` | Adaptadores: PDF, parsers, ZIP, correo, almacenamiento | `domain` (interfaces) |
| `workers/` | Tareas pesadas en segundo plano | `domain`, `infra` |
| `shared/` | Utilidades genéricas, constantes, i18n | nada |

## Estructura de carpetas

```
/
├─ docs/                       # esta documentación
├─ apps-script/                # código del script de correo + instrucciones
│  ├─ Code.gs
│  └─ README.md
├─ public/fonts/               # fuentes TTF/OTF con licencia libre (OFL)
├─ src/
│  ├─ app/                     # bootstrap, rutas/wizard, providers
│  ├─ ui/                      # botones, inputs, modal, stepper, toasts…
│  ├─ features/
│  │  ├─ template/             # subir plantilla, vista previa, editor de campo
│  │  ├─ recipients/           # subir lista, mapear columnas, validar, tabla
│  │  ├─ generation/           # generar PDFs, progreso, ZIP
│  │  ├─ mailing/              # (Fase 2) conexión, plantilla de correo, envío
│  │  └─ project/              # (Fase 3) guardar/cargar proyecto
│  ├─ domain/
│  │  ├─ certificate/          # tipos, layout, autoajuste de texto
│  │  ├─ recipient/            # tipos, normalización, validación
│  │  └─ mailing/              # tipos, cola, estados
│  ├─ infra/
│  │  ├─ pdf/                  # PdfRenderer (pdf.js), PdfComposer (pdf-lib)
│  │  ├─ parsers/              # CsvParser, XlsxParser, TxtParser
│  │  ├─ zip/                  # ZipExporter
│  │  ├─ mail/                 # AppsScriptProvider (+ Brevo/Resend en Fase 3)
│  │  └─ storage/              # IndexedDB / localStorage
│  ├─ workers/                 # generator.worker.ts
│  └─ shared/                  # utils, i18n, constantes, tipos comunes
└─ tests/                      # unitarias, integración y e2e
```

## Flujo de datos (Fase 1)

1. `template` carga el archivo → `PdfRenderer` genera una vista previa → el usuario define `FieldBox`.
2. `recipients` parsea el archivo (según extensión) → normaliza → valida → produce `Recipient[]`.
3. `generation` envía al Worker: bytes de plantilla + `FieldBox` + `Recipient[]`.
4. El Worker produce un PDF por destinatario, emite eventos de progreso y los entrega al `ZipExporter`.
5. La UI descarga el ZIP y muestra el resumen.

## Wizard como máquina de estados

Pasos: `plantilla → campo → lista → revisión → generar → (enviar)`. Cada paso expone `canContinue` según su estado. Estado global mínimo; navegación hacia atrás sin perder datos.

## Gestión de errores

- Errores de dominio tipados (`ParseError`, `ValidationError`, `RenderError`, `MailError`).
- La UI traduce cada error a un mensaje comprensible con acción sugerida.
- Un destinatario fallido no detiene el lote: se registra y se continúa.
