/**
 * Generador Automático de Certificados — Despachador de Correos (Gmail)
 * Despliegue en Google Apps Script (Fase 2)
 *
 * Instrucciones breves:
 * 1. Abre https://script.google.com y crea un "Nuevo proyecto".
 * 2. Pega este código completo reemplazando todo el contenido de Code.gs.
 * 3. (Opcional recomendado) En "Configuración del proyecto" > "Propiedades de la secuencia de comandos",
 *    agrega una propiedad llamada TOKEN con cualquier clave secreta que elijas.
 * 4. Haz clic en "Implementar" > "Nueva implementación".
 * 5. Tipo: "Aplicación web".
 *    - Ejecutar como: "Yo" (tu cuenta de Gmail).
 *    - Quién tiene acceso: "Cualquier persona" (Anyone).
 * 6. Copia la URL de la aplicación web y pégala en la aplicación.
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        ok: false,
        code: 'INVALID',
        message: 'Cuerpo de solicitud vacío o inválido'
      });
    }

    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({
        ok: false,
        code: 'INVALID',
        message: 'El contenido recibido no es un JSON válido'
      });
    }

    // Validación opcional de token si fue configurado en las propiedades del script
    var scriptProperties = PropertiesService.getScriptProperties();
    var secretToken = scriptProperties.getProperty('TOKEN');
    if (secretToken && secretToken.trim() !== '') {
      if (!body.token || body.token.trim() !== secretToken.trim()) {
        return jsonResponse({
          ok: false,
          code: 'AUTH',
          message: 'Token de seguridad inválido o no suministrado'
        });
      }
    }

    var remainingQuota = MailApp.getRemainingDailyQuota();

    // 1. Acción: Ping / Verificar conexión y cuota disponible
    if (body.action === 'ping' || body.action === 'quota') {
      return jsonResponse({
        ok: true,
        action: body.action,
        remainingQuota: remainingQuota,
        message: 'Conexión exitosa con el servicio de Gmail'
      });
    }

    // 2. Acción: Enviar correo individual con certificado PDF adjunto
    if (body.action === 'send') {
      if (remainingQuota < 1) {
        return jsonResponse({
          ok: false,
          code: 'QUOTA',
          message: 'Cuota diaria de correos agotada en tu cuenta de Google (se reinicia en 24h)',
          remainingQuota: 0
        });
      }

      if (!body.to || !body.subject) {
        return jsonResponse({
          ok: false,
          code: 'INVALID',
          message: 'Faltan campos obligatorios (destinatario "to" o asunto "subject")'
        });
      }

      var attachments = [];
      if (body.attachment && body.attachment.base64) {
        try {
          var decodedBytes = Utilities.base64Decode(body.attachment.base64);
          var fileName = body.attachment.filename || 'Certificado.pdf';
          var pdfBlob = Utilities.newBlob(decodedBytes, 'application/pdf', fileName);
          attachments.push(pdfBlob);
        } catch (attErr) {
          return jsonResponse({
            ok: false,
            code: 'ATTACHMENT_ERROR',
            message: 'Error al decodificar el archivo adjunto: ' + String(attErr)
          });
        }
      }

      // Envío a través de la cuenta de Gmail del organizador
      MailApp.sendEmail({
        to: body.to,
        subject: body.subject,
        htmlBody: body.htmlBody || '<p>Adjunto encontrarás tu certificado.</p>',
        name: body.senderName || 'Emisión de Certificados',
        attachments: attachments
      });

      var updatedQuota = MailApp.getRemainingDailyQuota();
      return jsonResponse({
        ok: true,
        code: 'SENT',
        remainingQuota: updatedQuota,
        message: 'Certificado enviado exitosamente a ' + body.to
      });
    }

    return jsonResponse({
      ok: false,
      code: 'INVALID_ACTION',
      message: 'Acción no reconocida: ' + body.action
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      code: 'UNKNOWN',
      message: err && err.message ? err.message : String(err)
    });
  }
}

/**
 * Responde solicitudes GET para pruebas rápidas en el navegador
 */
function doGet(e) {
  var remainingQuota = MailApp.getRemainingDailyQuota();
  return jsonResponse({
    ok: true,
    service: 'Generador de Certificados — Mail Dispatcher',
    status: 'online',
    remainingQuota: remainingQuota,
    note: 'Para enviar correos envía peticiones POST con action: send'
  });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
