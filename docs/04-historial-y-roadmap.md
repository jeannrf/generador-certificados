# 04 · Historial y roadmap

Qué se construyó en cada fase y qué falta. Reemplaza a los antiguos planes por fase (Fase 1 MVP, Fase 2 correo, Fase 3 avanzado).

## Hecho

### Fase 1 — Certificados en ZIP
- Wizard de 5 pasos: plantilla → campos → lista → revisión → generación.
- Plantilla PDF, PNG o JPG; lista en CSV, XLSX, XLS o TXT con detección de columnas.
- Validación de filas (vacías, duplicadas, correos inválidos) y corrección en la revisión.
- Autoajuste del tamaño de letra para nombres largos.
- Descarga de un ZIP con un PDF por persona y nombres de archivo seguros.

### Fase 2 — Envío por correo
- Plantilla de correo con variables (`{nombre}`, `{correo}`, columnas del Excel y `{enlace}` con Drive).
- Envío de prueba, envío masivo con progreso, reintentos, reanudación y reporte CSV.
- Contador del cupo diario de Gmail.
- Se envía con la función `/api/send-email` de Vercel y una cuenta Gmail (ver ADR-011). El diseño inicial con un Google Apps Script por organizador se retiró.
- Servicio aparte "Correos" para envíos masivos sin certificado.

### Fase 3 — Funciones avanzadas
- **Plantillas multipágina** (1 a 5 páginas, PDF/PNG/JPG mezclados) con campos por página (ADR-009).
- **Varios campos de texto**: nombre (obligatorio), columnas de la lista o texto fijo.
- **Catálogo de ~100 fuentes** de Google Fonts con buscador, incrustadas de verdad en el PDF.
- **Editor**: deshacer/rehacer, atajos de teclado, centrar y restablecer.
- **QR único por certificado** que abre su PDF en el Google Drive del organizador (ADR-010, doc 12).
- Política de privacidad pública en `/privacidad.html`.

### Retirado
- **PDF consolidado** (todos los certificados en un solo archivo): se quitó por poco uso; el ZIP y Drive cubren la necesidad.
- **Google Apps Script** como medio de envío (ver arriba).

## Pendiente

| Prioridad | Tema | Notas |
|---|---|---|
| Alta | Compartir cada PDF de Drive por separado | Hoy la carpeta es pública por enlace: quien abre un PDF con su cuenta de Google puede llegar a los demás. Dejar la carpeta privada y compartir archivo por archivo. |
| Alta | Backend con cuentas e historial | Supabase. Guardar plantilla, campos y lista (no los PDFs) y regenerar cuando se necesite. |
| Media | Página de verificación propia | `/verificar/<id>` en el dominio de la app, para que el QR pruebe autenticidad y no solo "hay un PDF en Drive". Depende del backend. |
| Media | Aviso de caracteres no soportados | Cuando un nombre usa glifos que la fuente elegida no tiene. |
| Baja | Proveedores de correo alternativos | Brevo o Resend detrás de la función de Vercel, si el cupo de Gmail no alcanza. |
| Baja | i18n, PWA, modo oscuro | Sin fecha. |
