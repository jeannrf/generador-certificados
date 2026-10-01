# 05 · Fase 2 — Envío automático por correo

**Meta**: enviar cada certificado como adjunto al correo de su destinatario, sin servidor propio y sin costo.

## Decisión

Cada organizador despliega **su propio Google Apps Script** (una vez, ~5 minutos, guiado dentro de la app). Los correos salen desde **su cuenta de Gmail**, lo que da buena entregabilidad y evita configurar dominios, SPF o DKIM.

Ventajas: gratis, sin infraestructura nuestra, sin custodiar credenciales de terceros, cuota independiente por usuario.

## Límites a respetar (documentación oficial de Apps Script, verificada en sept. 2026)

| Límite | Cuenta Gmail personal | Google Workspace |
|---|---|---|
| Destinatarios de correo por día | **100** | **1.500** |
| Tamaño total de adjuntos por mensaje | 25 MB | 25 MB |
| Tamaño del cuerpo del correo | 200 KB | 400 KB |

- La cuota es por usuario y se reinicia 24 h después de la primera solicitud.
- Google indica que las cuotas pueden cambiar sin previo aviso → la app **consulta la cuota restante** en tiempo real y no la asume fija.

## Arquitectura del envío

```
App web ──POST (JSON, text/plain)──► Apps Script (doPost) ──► MailApp.sendEmail ──► Gmail
        ◄──────────── JSON {ok, error?, remainingQuota} ─────┘
```

Un correo por solicitud (un destinatario, un PDF adjunto). La app controla la cola.

## Contrato del API (Apps Script)

**Petición** (`Content-Type: text/plain;charset=utf-8` para evitar preflight CORS):

```json
{
  "token": "SECRETO_DEL_USUARIO",
  "action": "send",
  "to": "persona@correo.com",
  "subject": "Tu certificado",
  "htmlBody": "<p>Hola Ana…</p>",
  "senderName": "Organización X",
  "attachment": { "filename": "Certificado - Ana.pdf", "base64": "JVBERi0x…" }
}
```

Otras acciones: `ping` (verifica conexión y token) y `quota` (devuelve `MailApp.getRemainingDailyQuota()`).

**Respuesta**: `{ "ok": true, "remainingQuota": 87 }` o `{ "ok": false, "code": "QUOTA|AUTH|INVALID|UNKNOWN", "message": "…" }`.

## Esqueleto del script (`apps-script/Code.gs`)

```javascript
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const secret = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!secret || body.token !== secret) return json({ ok: false, code: 'AUTH', message: 'Token inválido' });

    if (body.action === 'ping' || body.action === 'quota')
      return json({ ok: true, remainingQuota: MailApp.getRemainingDailyQuota() });

    if (body.action === 'send') {
      if (MailApp.getRemainingDailyQuota() < 1) return json({ ok: false, code: 'QUOTA', message: 'Cuota diaria agotada' });
      const blob = Utilities.newBlob(Utilities.base64Decode(body.attachment.base64), 'application/pdf', body.attachment.filename);
      MailApp.sendEmail({ to: body.to, subject: body.subject, htmlBody: body.htmlBody, name: body.senderName, attachments: [blob] });
      return json({ ok: true, remainingQuota: MailApp.getRemainingDailyQuota() });
    }
    return json({ ok: false, code: 'INVALID', message: 'Acción desconocida' });
  } catch (err) {
    return json({ ok: false, code: 'UNKNOWN', message: String(err) });
  }
}
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
```

Despliegue: *Implementar → Nueva implementación → Aplicación web*; ejecutar como **"Yo"**; acceso **"Cualquier persona"** (la seguridad la da el token). El token se guarda en *Propiedades del script*.

> **Spike técnico obligatorio al iniciar la fase**: validar en un prototipo que `fetch` desde el navegador puede leer la respuesta del Web App (redirección a `googleusercontent.com`) con `text/plain`. Si hubiera restricciones, plan B: enviar en modo `no-cors` y confirmar entrega consultando una acción `status` por ID de solicitud.

## Historias de usuario

### H7 · Conectar
- Asistente paso a paso con el código para copiar, capturas y botón "Probar conexión" (`ping`).
- Guarda URL y token (por defecto solo en memoria de sesión; opción "recordar en este equipo").

### H8 · Plantilla del correo
- Asunto y cuerpo editables con variables `{nombre}`, `{correo}`, `{evento}` y vista previa.
- Texto por defecto sensato en español. Escapar HTML en las variables.

### H9 · Envío de prueba
- Botón "Enviarme una prueba" con el primer certificado a un correo indicado por el usuario. Es obligatorio antes de habilitar el envío masivo.

### H10 · Envío masivo
- Muestra antes de enviar: total, cuota restante y estimación de días necesarios si no alcanza.
- Cola persistida en IndexedDB: si se cierra la pestaña, se puede **reanudar**.
- Envío secuencial con pausa de 1–2 s entre correos (configurable) y concurrencia máxima 1–2.
- Reintentos: hasta 3 con espera exponencial para errores transitorios; **no** reintentar `AUTH`, `INVALID` ni `QUOTA`.
- Si se agota la cuota: pausa automática, estado "pendiente", mensaje claro para continuar al día siguiente.
- Nunca reenviar a quien ya figura como `enviado`.

### H11 · Reporte
- Tabla con estado por destinatario, y exportación a CSV (`nombre, correo, estado, error, fecha`).

## Estados de un envío

`pendiente → enviando → enviado` · `enviando → fallido (reintentable)` · `fallido → omitido` · `pendiente → cancelado`.

## Optimización del adjunto

Los PDFs se envían en base64 (+33 % de tamaño). Para mantener solicitudes ligeras: comprimir imágenes de plantilla a JPEG calidad ~85 y máx. 2480×1754 px; objetivo ≤ 1 MB por certificado.

## Definición de terminado

- Spike CORS resuelto y documentado.
- Prueba real con Gmail personal y con cuenta Workspace.
- Reanudación tras cerrar la pestaña verificada.
- Manejo de cuota agotada, token incorrecto y correo inválido verificado con pruebas.
- Guía de configuración publicada dentro de la app.
