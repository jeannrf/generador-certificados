# 02 · Arquitectura

## Visión general

SPA estática (Vite + React) desplegada en Vercel. La generación de PDFs, la lectura de listas y la subida a Google Drive ocurren en el navegador. La única pieza de servidor es una función de Vercel que envía los correos por Gmail.

```
┌──────────────────────────── Navegador del usuario ────────────────────────────┐
│  UI (React) ──► features/* ──► domain/ (TS puro)                              │
│                      │                                                        │
│                      ▼                                                        │
│                   infra/                                                      │
│   pdf.js · pdf-lib + fontkit · PapaParse · SheetJS · fflate · localStorage   │
└───────┬───────────────────────────────┬───────────────────────────┬───────────┘
        │ POST /api/send-email          │ OAuth (drive.file)        │ fuentes
        ▼                               ▼                           ▼
  Función de Vercel ──► Gmail     Google Drive del organizador   Google Fonts / jsDelivr
  (api/send-email.ts, nodemailer)
```

## Principios

1. **Dominio puro**: `src/domain` no importa React, DOM, `fetch` ni librerías de PDF.
2. **Features verticales**: cada paso del wizard agrupa su UI, estado y orquestación.
3. **Adaptadores en `infra/`**: todo lo que toca librerías, red o almacenamiento.
4. **Sin datos personales en servidores**: la función de correo solo reenvía; no guarda nada.

## Capas

| Capa | Responsabilidad | Puede importar |
|---|---|---|
| `ui/` | Componentes visuales reutilizables, sin lógica de negocio | `domain` (tipos) |
| `features/*` | Pasos del wizard y servicios: UI + estado + orquestación | `domain`, `infra`, `ui`, `shared` |
| `domain/` | Tipos y reglas: campos, páginas, fuentes, validación, layout, Drive, correo | `shared` |
| `infra/` | PDF, parsers, ZIP, Drive, correo, almacenamiento local, fuentes | `domain` |
| `shared/` | Utilidades genéricas (pool de tareas, historial de deshacer) | nada |

## Estructura de carpetas

```
/
├─ api/send-email.ts          # función de Vercel: envía correos con Gmail (nodemailer)
├─ docs/                      # esta documentación
├─ public/privacidad.html     # política de privacidad (estática)
├─ samples/                   # certificado de ejemplo de 3 páginas
├─ src/
│  ├─ domain/                 # fields, templatePages, fonts, fontCatalog, drive, email, validation, layout…
│  ├─ features/
│  │  ├─ landing/             # página de inicio
│  │  ├─ wizard/              # orquesta los 5 pasos de certificados
│  │  ├─ template/            # paso 1: páginas de la plantilla
│  │  ├─ field/               # paso 2: editor de campos, fuentes, QR
│  │  ├─ recipients/          # paso 3: lista y mapeo de columnas
│  │  ├─ review/              # paso 4: revisión y vista previa
│  │  ├─ generation/          # paso 5: generar, ZIP, Drive y envío por correo
│  │  └─ mailer/              # servicio "Correos" (sin certificado)
│  ├─ infra/
│  │  ├─ drive/               # googleAuth, driveClient, driveBatchStorage
│  │  ├─ email/               # emailClient, campaignStorage, sendLog
│  │  └─ …                    # pdfComposer, pdfRenderer, templateImport, parsers, qr, zipExporter, fontLoader, storage
│  ├─ shared/                 # taskPool, undoHistory
│  └─ ui/                     # Button, Stepper, Dropzone, FontPicker, PageTabs…
└─ tests/                     # Vitest (*.test.ts), Playwright (e2e/), fixtures/
```

## Flujo de datos (certificados)

1. **Plantilla**: `templateImport` convierte cada archivo en `TemplatePage` (PDF de una página o imagen) y `pdfRenderer` genera su vista previa.
2. **Campos**: el usuario ubica `FieldBox` con coordenadas normalizadas (0–1) por página.
3. **Lista**: `parsers` lee CSV/XLSX/TXT → normaliza → valida → `Recipient[]`.
4. **Generación**: `pdfComposer` arma una vez el PDF base de la plantilla y estampa los campos de cada persona. Si hay Drive, primero se reservan los IDs para el QR y cada PDF se sube al terminarlo.
5. **Salida**: ZIP (`zipExporter`), carpeta de Drive y, opcionalmente, envío por correo.

La sesión en curso se guarda en `localStorage` (`infra/storage.ts`) para no perder el trabajo al recargar.

## Gestión de errores

- Errores tipados donde importa (`TemplateFileError`, `DriveApiError`, `DriveAuthError`).
- La UI traduce cada error a un mensaje con una acción sugerida.
- Un destinatario fallido no detiene el lote: se registra y se puede reintentar.
