# 10 · Seguridad y privacidad

## Principio rector

**Los datos personales (nombres y correos) nunca salen del navegador del usuario**, excepto cuando él mismo ordena enviar un correo, y en ese caso van directo a **su** Apps Script y a **su** Gmail.

## Datos tratados

| Dato | Dónde vive | Se envía a |
|---|---|---|
| Plantilla | Memoria / IndexedDB local | Nadie (solo adjunta en PDF a cada correo) |
| Lista de personas | Memoria de la sesión | Nadie, salvo el envío por correo (Fase 2) |
| URL y token del script | Memoria de sesión; opcional `localStorage` si el usuario lo acepta | Solo al propio script |
| Reporte de envíos | Local; exportable | Nadie |

## Medidas obligatorias

1. **Sin servidor propio** que almacene datos. No usar analítica que capture contenido.
2. **Content Security Policy (CSP)** estricta mediante cabeceras del hosting: `default-src 'self'`; `connect-src 'self' https://script.google.com https://script.googleusercontent.com`; `worker-src 'self' blob:`; `img-src 'self' data: blob:`; sin `unsafe-eval`. Ajustar si pdf.js lo requiere.
3. **Token del Apps Script**: cadena aleatoria larga (≥ 32 caracteres) generada por el usuario y guardada en *Propiedades del script*. Se compara en el servidor; se recomienda rotarlo si se sospecha filtración.
4. **Sanitización**: variables del correo (`{nombre}`) se escapan como HTML. Nombres de archivo saneados. Nunca usar `dangerouslySetInnerHTML` con datos del usuario.
5. **Validación de entradas**: tipo MIME y extensión, tamaño máximo (15 MB plantilla, 5 MB lista), número máximo de filas.
6. **Protección contra inyección en CSV/Excel** al exportar reportes: anteponer `'` a celdas que empiecen por `=`, `+`, `-`, `@`.
7. **Dependencias**: `npm audit` en CI, Dependabot/Renovate activo, versiones fijadas.
8. **Cabeceras adicionales**: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` restrictiva.
9. **Sin secretos en el repositorio**: ninguna clave en el código del frontend. Las integraciones con API keys (Fase 3) requieren proxy.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Filtración del token del script | Token por usuario, rotable; mensaje claro al usuario; el script solo permite enviar correos |
| Abuso del Web App si se conoce la URL | Token obligatorio + verificación de cuota; no exponer la URL en el repositorio |
| Correos marcados como spam | Envío escalonado, asunto sobrio, contenido legítimo, remitente reconocible |
| Errores de destinatario (correo equivocado) | Revisión previa + envío de prueba obligatorio |
| Pérdida de datos por cerrar la pestaña | Cola persistente y reanudación |
| Suplantación de certificados | ID único/QR y verificación (Fase 3) |

## Privacidad y cumplimiento

- Mostrar un **aviso de privacidad** breve y visible: qué datos se procesan, que se quedan en el navegador y cómo se borran.
- Botón **"Borrar todos los datos locales"**.
- El organizador es el responsable del tratamiento de los datos de sus destinatarios; la aplicación solo es una herramienta local. Revisar la normativa de protección de datos aplicable (por ejemplo, la ley de protección de datos personales de Perú u otras según el público) y, si se publica como servicio, consultar con un asesor legal.
- Los correos enviados deben identificar claramente al organizador.
