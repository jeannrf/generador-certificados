# 08 · Seguridad y privacidad

La política pública para usuarios está en [`public/privacidad.html`](../public/privacidad.html) (`/privacidad.html`). Si cambia el manejo de datos, actualizar ambos documentos.

## Principio rector

**Los datos personales (nombres y correos) se procesan en el navegador.** Solo salen cuando el usuario lo ordena: al enviar un correo (función de Vercel → Gmail) o al guardar en su propio Google Drive.

## Datos tratados

| Dato | Dónde vive | Se envía a |
|---|---|---|
| Plantilla y lista | Memoria y `localStorage` del navegador | Nadie, salvo como PDF adjunto o a Drive |
| Configuración y registro de correos | `localStorage` | Nadie |
| Correo (destinatario, asunto, cuerpo, PDF) | — | `/api/send-email` → Gmail. Queda copia en "Enviados" de la cuenta remitente |
| Token de Google | Solo en memoria de la página | Solo a las API de Google |
| PDFs en Drive | Drive del organizador | Quien tenga el enlace (ver riesgos) |

## Medidas

1. **Secretos solo en el servidor**: `GMAIL_USER` y `GMAIL_APP_PASSWORD` viven en las variables de entorno de Vercel y en `.env.local` (ignorado por git). Nunca con prefijo `VITE_`, porque esas variables terminan en el código del navegador.
2. **`VITE_GOOGLE_CLIENT_ID` es público** por diseño (es un ID de cliente OAuth, no un secreto). No existe secreto de cliente en este flujo.
3. **Permiso mínimo en Drive**: solo `drive.file` (la app ve únicamente lo que ella creó).
4. **Sanitización**: las variables del correo se escapan como HTML. Nombres de archivo saneados.
5. **Validación de entradas**: formato real del archivo (no solo la extensión), 15 MB por archivo, 40 MB por plantilla, 8000 px y 25 MP por imagen.
6. **Dependencias**: revisar `npm audit` antes de cada versión.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| La función `/api/send-email` acepta peticiones de cualquier origen (CORS `*`) | Pendiente: restringir el origen y añadir un límite de envíos por IP. Hoy cualquiera que conozca la URL podría usar la cuenta Gmail de la app. |
| La carpeta de Drive es pública por enlace | Pendiente: compartir cada PDF por separado (doc 04). |
| QR falsificado (PDF falso en otro Drive) | Pendiente: página de verificación propia con backend (doc 04). |
| Correos marcados como spam | Envío escalonado, contador de cupo, remitente reconocible |
| Destinatario equivocado | Revisión previa + envío de prueba |
| Cerrar la pestaña a mitad | Campaña y subida a Drive se reanudan sin duplicar |

## Privacidad y cumplimiento

- El organizador es el responsable del tratamiento de los datos de sus destinatarios.
- Revisar la normativa aplicable (por ejemplo, la Ley 29733 de protección de datos personales del Perú) y consultar con un asesor legal si se ofrece como servicio.
