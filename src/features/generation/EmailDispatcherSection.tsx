import React, { useState, useEffect, useRef } from 'react';
import {
  Recipient,
  TemplateData,
  FieldBox,
  EmailConfig,
  EmailSendProgress,
  EmailDeliveryRecord,
} from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';
import { Badge } from '../../ui/Badge';
import {
  pingAppsScript,
  sendEmailViaScript,
  uint8ArrayToBase64,
  loadEmailConfigFromStorage,
  saveEmailConfigToStorage,
} from '../../infra/email/googleAppsScript';
import {
  interpolateEmailVariables,
  validateEmailConfig,
  buildDeliveryReportCsv,
} from '../../domain/email';
import { composeCertificatePdf } from '../../infra/pdfComposer';
import { triggerDownload } from '../../infra/zipExporter';
import { EmailModalCode } from './EmailModalCode';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Download,
  Settings,
  Flame,
  Check,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';

interface EmailDispatcherSectionProps {
  recipients: Recipient[];
  template: TemplateData;
  field: FieldBox;
  fileNamePattern: string;
}

export const EmailDispatcherSection: React.FC<EmailDispatcherSectionProps> = ({
  recipients,
  template,
  field,
  fileNamePattern,
}) => {
  // Configuración cargada desde localStorage
  const [config, setConfig] = useState<EmailConfig>(loadEmailConfigFromStorage());
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);

  // Estado de prueba de conexión
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{
    ok: boolean;
    quota?: number;
    message?: string;
  } | null>(null);

  // Sección chiquita requerida: "pon tu correo y prueba"
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Envío masivo
  const recipientsWithEmail = recipients.filter(
    (r) => r.email && r.email.trim() !== '' && !r.issues.some((i) => i.severity === 'error')
  );

  const [sendProgress, setSendProgress] = useState<EmailSendProgress>({
    status: 'idle',
    total: recipientsWithEmail.length,
    current: 0,
    sentCount: 0,
    failedCount: 0,
    records: {},
  });

  const isCancelledRef = useRef(false);
  const isPausedRef = useRef(false);

  // Guardar configuración cuando cambie
  useEffect(() => {
    saveEmailConfigToStorage(config);
  }, [config]);

  // Probar conexión y obtener cuota
  const handleTestConnection = async () => {
    if (!config.webAppUrl.trim()) {
      setPingResult({
        ok: false,
        message: 'Ingresa primero la URL de la Web App de Apps Script.',
      });
      return;
    }

    setIsPinging(true);
    setPingResult(null);

    const res = await pingAppsScript(config.webAppUrl, config.token);
    setIsPinging(false);

    if (res.ok) {
      setPingResult({
        ok: true,
        quota: res.remainingQuota,
        message: `¡Conexión exitosa! Cuota disponible: ${res.remainingQuota ?? 'N/A'} correos.`,
      });
      if (res.remainingQuota !== undefined) {
        setSendProgress((prev) => ({ ...prev, remainingQuota: res.remainingQuota }));
      }
    } else {
      setPingResult({
        ok: false,
        message: res.error || 'Error al conectar con el script.',
      });
    }
  };

  // Enviar correo de prueba unitario ("pon tu correo y prueba")
  const handleSendTestEmail = async () => {
    if (!testEmail.trim() || !testEmail.includes('@')) {
      setTestFeedback({
        type: 'error',
        text: 'Por favor ingresa un correo electrónico válido.',
      });
      return;
    }

    const validation = validateEmailConfig(config);
    if (!validation.isValid) {
      setTestFeedback({
        type: 'error',
        text: validation.errors[0] || 'Configura la URL de Google Apps Script primero.',
      });
      return;
    }

    setIsSendingTest(true);
    setTestFeedback(null);

    try {
      // 1. Tomar destinatario de ejemplo y generar PDF
      const sampleRec: Recipient = recipientsWithEmail[0] || {
        id: 'sample_test',
        rowNumber: 1,
        name: 'Participante de Prueba',
        email: testEmail.trim(),
        extra: { Curso: 'Taller de Certificación' },
        issues: [],
      };

      const testRecWithTargetEmail: Recipient = {
        ...sampleRec,
        email: testEmail.trim(),
      };

      const { fileName, pdfBytes } = await composeCertificatePdf(
        template,
        field,
        testRecWithTargetEmail,
        fileNamePattern
      );

      const base64Pdf = uint8ArrayToBase64(pdfBytes);
      const interpolatedSubject = interpolateEmailVariables(config.subject, testRecWithTargetEmail);
      const interpolatedBody = interpolateEmailVariables(config.htmlBody, testRecWithTargetEmail, {
        escapeForHtml: false,
      });

      // 2. Enviar a través de Google Apps Script
      const result = await sendEmailViaScript({
        webAppUrl: config.webAppUrl,
        token: config.token,
        to: testEmail.trim(),
        subject: interpolatedSubject,
        htmlBody: interpolatedBody,
        senderName: config.senderName,
        attachment: {
          filename: fileName,
          base64: base64Pdf,
        },
      });

      if (result.ok) {
        setTestFeedback({
          type: 'success',
          text: `¡Certificado de prueba enviado con éxito a ${testEmail.trim()}! Revisa tu bandeja de entrada o spam.`,
        });
        if (result.remainingQuota !== undefined) {
          setPingResult({
            ok: true,
            quota: result.remainingQuota,
            message: `Cuota restante: ${result.remainingQuota} correos`,
          });
        }
      } else {
        setTestFeedback({
          type: 'error',
          text: result.error || 'Error al enviar el correo de prueba.',
        });
      }
    } catch (err: any) {
      setTestFeedback({
        type: 'error',
        text: err?.message || 'Error inesperado generando o enviando el certificado.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Iniciar envío masivo
  const handleStartMassEmail = async () => {
    const validation = validateEmailConfig(config);
    if (!validation.isValid) {
      setTestFeedback({
        type: 'error',
        text: validation.errors[0] || 'Por favor verifica la configuración de envío.',
      });
      setIsConfigOpen(true);
      return;
    }

    if (recipientsWithEmail.length === 0) {
      alert('Ningún destinatario de la lista tiene correo electrónico.');
      return;
    }

    isCancelledRef.current = false;
    isPausedRef.current = false;

    setSendProgress({
      status: 'sending',
      total: recipientsWithEmail.length,
      current: 0,
      sentCount: 0,
      failedCount: 0,
      records: {},
    });

    const newRecords: Record<string, EmailDeliveryRecord> = {};
    let sentCounter = 0;
    let failedCounter = 0;

    for (let i = 0; i < recipientsWithEmail.length; i++) {
      if (isCancelledRef.current) {
        setSendProgress((prev) => ({ ...prev, status: 'cancelled' }));
        return;
      }

      while (isPausedRef.current) {
        await new Promise((res) => setTimeout(res, 500));
        if (isCancelledRef.current) {
          setSendProgress((prev) => ({ ...prev, status: 'cancelled' }));
          return;
        }
      }

      const rec = recipientsWithEmail[i];
      const targetEmail = rec.email!.trim();

      setSendProgress((prev) => ({
        ...prev,
        current: i + 1,
        currentRecipientName: `${rec.name} (${targetEmail})`,
      }));

      try {
        // Generar PDF para este destinatario
        const { fileName, pdfBytes } = await composeCertificatePdf(
          template,
          field,
          rec,
          fileNamePattern
        );

        const base64Pdf = uint8ArrayToBase64(pdfBytes);
        const subject = interpolateEmailVariables(config.subject, rec);
        const htmlBody = interpolateEmailVariables(config.htmlBody, rec, { escapeForHtml: false });

        // Enviar vía Apps Script
        const result = await sendEmailViaScript({
          webAppUrl: config.webAppUrl,
          token: config.token,
          to: targetEmail,
          subject,
          htmlBody,
          senderName: config.senderName,
          attachment: {
            filename: fileName,
            base64: base64Pdf,
          },
        });

        if (result.ok) {
          sentCounter++;
          newRecords[rec.id] = {
            recipientId: rec.id,
            name: rec.name,
            email: targetEmail,
            status: 'sent',
            sentAt: new Date().toISOString(),
          };
        } else {
          failedCounter++;
          newRecords[rec.id] = {
            recipientId: rec.id,
            name: rec.name,
            email: targetEmail,
            status: 'error',
            errorMessage: result.error,
            sentAt: new Date().toISOString(),
          };
        }

        setSendProgress((prev) => ({
          ...prev,
          sentCount: sentCounter,
          failedCount: failedCounter,
          remainingQuota: result.remainingQuota ?? prev.remainingQuota,
          records: { ...newRecords },
        }));
      } catch (err: any) {
        failedCounter++;
        newRecords[rec.id] = {
          recipientId: rec.id,
          name: rec.name,
          email: targetEmail,
          status: 'error',
          errorMessage: err?.message || 'Error desconocido',
          sentAt: new Date().toISOString(),
        };
        setSendProgress((prev) => ({
          ...prev,
          failedCount: failedCounter,
          records: { ...newRecords },
        }));
      }

      // Pausa de 1.5s entre envíos para respetar cuotas y ritmo de Gmail
      if (i < recipientsWithEmail.length - 1) {
        await new Promise((res) => setTimeout(res, 1500));
      }
    }

    setSendProgress((prev) => ({
      ...prev,
      status: 'completed',
    }));
  };

  const handleCancelSend = () => {
    isCancelledRef.current = true;
  };

  const handleTogglePause = () => {
    isPausedRef.current = !isPausedRef.current;
    setSendProgress((prev) => ({
      ...prev,
      status: isPausedRef.current ? 'paused' : 'sending',
    }));
  };

  const handleDownloadCsvReport = () => {
    const recordsList = Object.values(sendProgress.records);
    if (recordsList.length === 0) return;
    const csvContent = buildDeliveryReportCsv(recordsList);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `Reporte_Envios_Certificados_${Date.now()}.csv`);
  };

  const progressPercent =
    sendProgress.total > 0 ? (sendProgress.current / sendProgress.total) * 100 : 0;

  return (
    <div className="mt-8 pt-8 border-t border-slate-200 space-y-6">
      <EmailModalCode
        isOpen={isScriptModalOpen}
        onClose={() => setIsScriptModalOpen(false)}
      />

      {/* Header de la sección de correo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              Envío Automático por Correo (Gmail)
              <Badge variant="brand" size="sm">
                Fase 2 Gratis
              </Badge>
            </h3>
            <p className="text-xs text-slate-500">
              Envía los certificados adjuntos a cada destinatario usando tu propia cuenta de Gmail.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<HelpCircle className="w-4 h-4 text-brand-600" />}
            onClick={() => setIsScriptModalOpen(true)}
          >
            Ver Script y Guía
          </Button>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Settings className="w-4 h-4" />}
            onClick={() => setIsConfigOpen(!isConfigOpen)}
          >
            {isConfigOpen ? 'Ocultar Ajustes' : 'Configurar'}
          </Button>
        </div>
      </div>

      {/* Configuración desplegable */}
      {isConfigOpen && (
        <Card className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Credenciales de Google Apps Script
            </span>
            {pingResult?.quota !== undefined && (
              <Badge variant="success" size="sm">
                Cuota: {pingResult.quota} correos
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">
                URL de la Web App (termina en /exec)
              </label>
              <input
                type="url"
                value={config.webAppUrl}
                onChange={(e) => setConfig({ ...config, webAppUrl: e.target.value })}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full text-xs font-mono rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Token Secreto (Opcional si lo configuraste en el script)
              </label>
              <input
                type="password"
                value={config.token || ''}
                onChange={(e) => setConfig({ ...config, token: e.target.value })}
                placeholder="Ej: mi-clave-secreta-2026"
                className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Nombre del Remitente
              </label>
              <input
                type="text"
                value={config.senderName}
                onChange={(e) => setConfig({ ...config, senderName: e.target.value })}
                placeholder="Ej: Universidad Nacional de Ingeniería"
                className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">
                Asunto del Correo
              </label>
              <input
                type="text"
                value={config.subject}
                onChange={(e) => setConfig({ ...config, subject: e.target.value })}
                placeholder="Tu Certificado Oficial — {nombre}"
                className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              <span className="text-[11px] text-slate-400">
                Variables disponibles: <code>{'{nombre}'}</code>, <code>{'{correo}'}</code> y cualquier columna del Excel.
              </span>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">
                Mensaje del Correo (HTML o texto con formato)
              </label>
              <textarea
                rows={3}
                value={config.htmlBody}
                onChange={(e) => setConfig({ ...config, htmlBody: e.target.value })}
                className="w-full text-xs font-sans rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <div className="text-xs">
              {pingResult && (
                <span
                  className={
                    pingResult.ok
                      ? 'text-emerald-700 font-medium inline-flex items-center gap-1'
                      : 'text-rose-600 font-medium inline-flex items-center gap-1'
                  }
                >
                  {pingResult.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {pingResult.message}
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              isLoading={isPinging}
              onClick={handleTestConnection}
            >
              Probar Conexión con Gmail
            </Button>
          </div>
        </Card>
      )}

      {/* SECCIÓN CHIQUITA REQUERIDA POR EL USUARIO: "Pon tu correo y prueba" */}
      <div className="p-4 bg-gradient-to-r from-amber-50/80 to-amber-100/40 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="space-y-0.5">
          <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-600" />
            Pon tu correo y prueba:
          </span>
          <p className="text-[11px] text-slate-600">
            Envíate un certificado de muestra para confirmar que el diseño y el correo llegan perfectamente.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="tu.correo@ejemplo.com"
            className="flex-1 sm:w-64 text-xs rounded-xl border border-amber-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-2xs"
          />
          <Button
            variant="primary"
            size="sm"
            isLoading={isSendingTest}
            leftIcon={<Send className="w-3.5 h-3.5" />}
            onClick={handleSendTestEmail}
            className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
          >
            Enviar prueba
          </Button>
        </div>
      </div>

      {/* Retroalimentación del envío de prueba */}
      {testFeedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-fadeIn ${
            testFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {testFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{testFeedback.text}</span>
        </div>
      )}

      {/* Envío Masivo Card */}
      <Card className="p-5 sm:p-6 border border-slate-200 space-y-4">
        {sendProgress.status === 'idle' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900">
                Envío Masivo de Certificados
              </h4>
              <p className="text-xs text-slate-600">
                {recipientsWithEmail.length} de {recipients.length} personas tienen correo electrónico asignado.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              leftIcon={<Send className="w-4 h-4" />}
              onClick={handleStartMassEmail}
              disabled={recipientsWithEmail.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20"
            >
              Enviar {recipientsWithEmail.length} Certificados por Correo
            </Button>
          </div>
        )}

        {(sendProgress.status === 'sending' || sendProgress.status === 'paused') && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-2">
                {sendProgress.status === 'paused' ? 'Envíos en pausa' : 'Enviando certificados...'}
                <span className="font-normal text-slate-500 font-mono">
                  {sendProgress.currentRecipientName}
                </span>
              </span>
              <span className="font-medium text-slate-600">
                {sendProgress.current} de {sendProgress.total}
              </span>
            </div>

            <ProgressBar
              progress={progressPercent}
              label={`Enviando... ${sendProgress.sentCount} exitosos, ${sendProgress.failedCount} con error`}
            />

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="success" size="sm">
                  Enviados: {sendProgress.sentCount}
                </Badge>
                {sendProgress.failedCount > 0 && (
                  <Badge variant="error" size="sm">
                    Fallidos: {sendProgress.failedCount}
                  </Badge>
                )}
                {sendProgress.remainingQuota !== undefined && (
                  <span className="text-[11px] text-slate-400">
                    Cuota restante: {sendProgress.remainingQuota}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={sendProgress.status === 'paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  onClick={handleTogglePause}
                >
                  {sendProgress.status === 'paused' ? 'Reanudar' : 'Pausar'}
                </Button>
                <Button variant="danger" size="sm" onClick={handleCancelSend}>
                  Detener
                </Button>
              </div>
            </div>
          </div>
        )}

        {(sendProgress.status === 'completed' || sendProgress.status === 'cancelled') && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  {sendProgress.status === 'completed'
                    ? '¡Envío masivo finalizado!'
                    : 'Proceso detenido'}
                </h4>
                <p className="text-xs text-slate-600">
                  Se enviaron con éxito {sendProgress.sentCount} correos.
                  {sendProgress.failedCount > 0 && ` (${sendProgress.failedCount} presentaron error).`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleDownloadCsvReport}
              >
                Descargar Reporte de Envíos (.CSV)
              </Button>

              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCcw className="w-4 h-4" />}
                onClick={() =>
                  setSendProgress({
                    status: 'idle',
                    total: recipientsWithEmail.length,
                    current: 0,
                    sentCount: 0,
                    failedCount: 0,
                    records: {},
                  })
                }
              >
                Reiniciar Módulo de Envío
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
