import React, { useState } from 'react';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { X, Copy, Check, ExternalLink, Code2 } from 'lucide-react';

interface EmailModalCodeProps {
  isOpen: boolean;
  onClose: () => void;
}

const APPS_SCRIPT_CODE = `/**
 * Generador Automático de Certificados — Despachador de Correos (Gmail)
 * Despliegue en Google Apps Script
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, code: 'INVALID', message: 'Cuerpo de solicitud vacío' });
    }

    var body = JSON.parse(e.postData.contents);
    var scriptProperties = PropertiesService.getScriptProperties();
    var secretToken = scriptProperties.getProperty('TOKEN');

    // Validación de seguridad (si configuraste un TOKEN en Propiedades del Script)
    if (secretToken && secretToken.trim() !== '') {
      if (!body.token || body.token.trim() !== secretToken.trim()) {
        return jsonResponse({ ok: false, code: 'AUTH', message: 'Token de seguridad inválido' });
      }
    }

    var remainingQuota = MailApp.getRemainingDailyQuota();

    // 1. Ping / Comprobar conexión y cuota
    if (body.action === 'ping' || body.action === 'quota') {
      return jsonResponse({
        ok: true,
        action: body.action,
        remainingQuota: remainingQuota,
        message: 'Conexión exitosa con Gmail'
      });
    }

    // 2. Enviar correo con certificado adjunto
    if (body.action === 'send') {
      if (remainingQuota < 1) {
        return jsonResponse({
          ok: false,
          code: 'QUOTA',
          message: 'Cuota diaria de correos agotada en Google (se reinicia en 24h)',
          remainingQuota: 0
        });
      }

      var attachments = [];
      if (body.attachment && body.attachment.base64) {
        var decodedBytes = Utilities.base64Decode(body.attachment.base64);
        var fileName = body.attachment.filename || 'Certificado.pdf';
        var pdfBlob = Utilities.newBlob(decodedBytes, 'application/pdf', fileName);
        attachments.push(pdfBlob);
      }

      MailApp.sendEmail({
        to: body.to,
        subject: body.subject,
        htmlBody: body.htmlBody || '<p>Adjunto encontrarás tu certificado.</p>',
        name: body.senderName || 'Emisión de Certificados',
        attachments: attachments
      });

      return jsonResponse({
        ok: true,
        code: 'SENT',
        remainingQuota: MailApp.getRemainingDailyQuota(),
        message: 'Certificado enviado a ' + body.to
      });
    }

    return jsonResponse({ ok: false, code: 'INVALID', message: 'Acción desconocida' });
  } catch (err) {
    return jsonResponse({
      ok: false,
      code: 'UNKNOWN',
      message: err && err.message ? err.message : String(err)
    });
  }
}

function doGet(e) {
  return jsonResponse({
    ok: true,
    service: 'Generador de Certificados — Mail Dispatcher',
    status: 'online',
    remainingQuota: MailApp.getRemainingDailyQuota()
  });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;

export const EmailModalCode: React.FC<EmailModalCodeProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col p-6 shadow-2xl bg-white border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Código para Google Apps Script
              </h3>
              <p className="text-xs text-slate-500">
                Pega este script en tu Google Drive para enviar correos gratis con tu Gmail
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pasos rápidos */}
        <div className="py-3 px-4 my-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 text-slate-700">
          <p className="font-semibold text-slate-900">Pasos en 1 minuto:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-600 pl-1">
            <li>
              Abre{' '}
              <a
                href="https://script.google.com"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 font-medium underline inline-flex items-center gap-0.5"
              >
                script.google.com <ExternalLink className="w-3 h-3" />
              </a>{' '}
              y crea un <strong>Nuevo proyecto</strong>.
            </li>
            <li>Reemplaza el código con el texto de abajo y guárdalo (Ctrl+S).</li>
            <li>
              Haz clic en <strong>Implementar &gt; Nueva implementación</strong> &gt; Tipo{' '}
              <strong>Aplicación web</strong>.
            </li>
            <li>
              Configura: Ejecutar como: <strong>Yo</strong>, Acceso:{' '}
              <strong>Cualquier persona</strong>.
            </li>
            <li>Copia la URL que termina en <code>/exec</code> y pégala en la app.</li>
          </ol>
        </div>

        {/* Code box */}
        <div className="relative flex-1 min-h-[220px] max-h-[360px] overflow-hidden rounded-xl border border-slate-300 bg-slate-950 font-mono text-[11px] text-slate-200 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
            <span>Code.gs</span>
            <Button
              variant="outline"
              size="sm"
              leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              onClick={handleCopy}
              className="py-1 px-2.5 text-[11px] bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
            >
              {copied ? '¡Copiado!' : 'Copiar Código'}
            </Button>
          </div>
          <div className="p-4 overflow-y-auto flex-1 leading-relaxed">
            <pre className="whitespace-pre">{APPS_SCRIPT_CODE}</pre>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 mt-2 flex items-center justify-end gap-2 border-t border-slate-100">
          <Button variant="primary" size="sm" onClick={onClose}>
            Entendido, volver a la app
          </Button>
        </div>
      </Card>
    </div>
  );
};
