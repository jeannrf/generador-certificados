# 10 · Registro de decisiones (ADR)

Formato: contexto → decisión → consecuencias. Añadir una entrada nueva por cada decisión técnica relevante; no editar las antiguas, sino marcarlas como *Reemplazada por ADR-XXX*.

---

## ADR-001 · Aplicación 100 % cliente (sin backend propio)
- **Estado**: Aceptada; matizada por ADR-011 (una función de Vercel para el correo)
- **Contexto**: se exige costo cero y buena privacidad.
- **Decisión**: SPA estática; PDFs generados en el navegador.
- **Consecuencias**: sin costo de servidor ni custodia de datos; el rendimiento depende del equipo del usuario (mitigado con Web Workers); el envío de correo requiere una pieza externa.

## ADR-002 · pdf-lib + pdf.js para PDF
- **Estado**: Aceptada
- **Decisión**: pdf.js para la vista previa; pdf-lib (+ fontkit) para componer el PDF final.
- **Consecuencias**: se conserva la calidad vectorial y se embeben fuentes con tildes y ñ. Se descartó dibujar en canvas y exportar como imagen por pérdida de calidad y mayor peso.

## ADR-003 · Coordenadas normalizadas (0–1)
- **Estado**: Aceptada
- **Decisión**: los recuadros se guardan normalizados desde arriba-izquierda; conversión a puntos PDF en un único módulo.
- **Consecuencias**: la vista previa coincide con el PDF en cualquier tamaño de pantalla; se evita un tipo común de error.

## ADR-004 · Correo mediante Google Apps Script del usuario
- **Estado**: Reemplazada por ADR-011
- **Contexto**: un navegador no puede enviar correo; se busca opción gratuita, simple y con buena entregabilidad.
- **Decisión**: cada organizador despliega su propio script y la app lo invoca con URL + token. Se envía un correo por solicitud, con el PDF adjunto.
- **Consecuencias**:
  - (+) Gratis, sin dominio ni SPF/DKIM, remitente real.
  - (−) Cuota de 100/día en Gmail personal y 1.500/día en Workspace (oficial, sujeta a cambio); requiere configuración inicial; hay que validar CORS con un *spike*.
- **Alternativas descartadas**: Nodemailer con Gmail (exige servidor); Brevo/Resend desde el inicio (exigen proxy para ocultar la clave y/o verificar dominio) → pasan a la Fase 3.

## ADR-005 · Interfaz `MailProvider` desde el día uno
- **Estado**: No implementada (hay un solo proveedor; `infra/email/emailClient.ts` es el único punto de envío)
- **Decisión**: el dominio depende de una interfaz; Apps Script es el primer adaptador.
- **Consecuencias**: añadir Brevo/Resend en la Fase 3 no obliga a reescribir la cola ni la UI.

## ADR-006 · Cola de envío persistente en IndexedDB
- **Estado**: Aceptada con cambio: la campaña se guarda en `localStorage` (`infra/email/campaignStorage.ts`), no en IndexedDB
- **Decisión**: cada destinatario tiene estado; la cola se guarda y puede reanudarse.
- **Consecuencias**: tolera cierres de pestaña y agotamiento de cuota; requiere cuidado para no reenviar.

## ADR-007 · Stack: Vite + React + TypeScript + Tailwind + Zustand
- **Estado**: Aceptada sin Zustand: el estado vive en React (`useState`) por feature
- **Decisión**: ver `03-stack-tecnologico.md`.
- **Consecuencias**: ecosistema amplio, curva de aprendizaje baja. Next.js descartado por no necesitar SSR.

## ADR-008 · Generación en Web Worker con flujo hacia ZIP
- **Estado**: No implementada: la generación corre en el hilo principal y cede el control cada pocos certificados; con el PDF base reutilizado (ADR-009) es rápida (~4 ms por certificado)
- **Decisión**: el Worker genera de a un PDF y lo entrega al empaquetador; no se acumulan todos en memoria.
- **Consecuencias**: la interfaz permanece fluida y se soportan lotes grandes.

## ADR-009 · Plantillas multipágina (1 a 5 páginas)
- **Estado**: Aceptada (2026-10-26)
- **Contexto**: se necesitan certificados de varias páginas (diploma, contenido del curso, reverso), mezclando PDF, PNG y JPG, con campos en páginas distintas.
- **Decisión**:
  - `TemplateData.pages: TemplatePage[]` (máx. 5). Cada página PDF se guarda como un PDF de una sola página (`copyPages`, sigue vectorial); cada imagen, con sus bytes originales.
  - `FieldBox.pageId` apunta al `id` de la página (no al índice): reordenar no mueve los campos y reemplazar una página los conserva.
  - Varios campos de texto (`fields: FieldBox[]`): el de nombre (`field_name`) es obligatorio y es el único con ajustes individuales; los demás salen de una columna o de un texto fijo.
  - Al generar se arma **una vez por lote** un PDF base con todas las páginas normalizadas (CropBox aplicado, `/Rotate` y orientación EXIF horneados, origen en 0,0). Cada certificado solo carga ese PDF y estampa sus textos.
  - Las validaciones viven en `domain/templatePages.ts` y se ejecutan al subir y otra vez al generar. No hay backend de plantillas (ADR-001 sigue vigente).
  - Límites: 15 MB por archivo, 40 MB por plantilla, 8000 px por lado y 25 MP por imagen (el decodificador PNG de pdf-lib trabaja en memoria).
- **Consecuencias**: (+) salida vectorial y sin recompresión; ~4 ms por certificado de 3 páginas. (−) Al incrustar la página como XObject solo se conservan los enlaces web (Link con URI), recolocados según el recorte y la rotación; los formularios, comentarios y enlaces internos se descartan. Las sesiones antiguas se migran al cargar (`migrateSession`).
- **Alternativas descartadas**: guardar el PDF original completo + índice de página (duplica bytes por página); rasterizar las páginas PDF (pierde calidad vectorial).

## ADR-010 · Certificados en el Google Drive del organizador con QR único
- **Estado**: Aceptada (2026-10-26)
- **Contexto**: cada certificado debe tener un QR único que abra su PDF alojado en línea, sin montar almacenamiento propio todavía.
- **Decisión**:
  - Los PDFs se suben desde el navegador al Drive **del organizador** (Google Identity Services, modelo de token, permiso `drive.file`). Sin backend, en línea con ADR-001.
  - Los IDs se reservan con `files.generateIds` antes de generar, para estampar en el QR la URL definitiva y subir cada PDF una sola vez con ese ID. Reintentar un ID existente devuelve 409 y se trata como subido (idempotente).
  - La carpeta queda privada; cada PDF se comparte por separado como "cualquiera con el enlace puede ver", justo después de subirlo.
  - El QR se dibuja como vector (librería `qrcode` solo para calcular la matriz).
  - El progreso (carpeta, IDs, subidos) se guarda en `localStorage` para reanudar sin duplicar.
- **Consecuencias**: (+) gratis a escala, el organizador es dueño de sus archivos, la app no retiene datos personales. (−) Requiere un OAuth Client ID configurado por el dueño de la app; el QR no es una verificación fuerte de autenticidad.
- **Alternativas descartadas**: Drive central de la app con backend (consume el espacio del dueño y concentra datos personales); generar el PDF, subirlo y luego reemplazarlo con el QR (doble subida).

## ADR-011 · Correo mediante una función de Vercel con Gmail
- **Estado**: Aceptada (2026-10)
- **Contexto**: desplegar un Apps Script por organizador (ADR-004) resultó difícil para usuarios no técnicos.
- **Decisión**: `api/send-email.ts` (función de Vercel) envía con nodemailer usando una cuenta Gmail de la app (`GMAIL_USER` + contraseña de aplicación en variables de entorno). El navegador envía un correo por solicitud con el PDF en base64.
- **Consecuencias**: (+) cero configuración para el usuario. (−) Todos los correos salen de la misma cuenta y comparten su cupo diario de Gmail; la función no guarda datos y solo acepta peticiones de la propia app, con límite por IP (doc 08); el cuerpo de una petición tiene un máximo de 4,5 MB en Vercel.
- **Alternativas descartadas**: Apps Script por usuario (ADR-004); Brevo/Resend (requieren dominio verificado; quedan como opción si el cupo no alcanza).

## Plantilla para nuevas ADR

```
## ADR-XXX · Título
- Estado: Propuesta | Aceptada | Reemplazada por ADR-YYY
- Contexto:
- Decisión:
- Consecuencias (+/−):
- Alternativas descartadas:
```
