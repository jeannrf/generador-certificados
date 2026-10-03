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
      setIsConfigOpen(true);
      setTestFeedback({
        type: 'error',
        text: 'Debes configurar la URL de la Web App de Google Apps Script para poder enviar correos.',
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
              Envío Automático de Certificados por Correo
            </h3>
            <p className="text-xs text-slate-500">
              Despacha los certificados en PDF adjuntos a cada destinatario automáticamente con un solo clic.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Settings className="w-4 h-4 text-brand-600" />}
            onClick={() => setIsConfigOpen(!isConfigOpen)}
          >
            {isConfigOpen ? 'Cerrar Ajustes' : 'Personalizar Mensaje'}
          </Button>
        </div>
      </div>

      {/* Configuración desplegable */}
      {isConfigOpen && (
        <Card className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Personalización del Correo
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Backend de Vercel listo
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Columna Izquierda: Remitente, Asunto y Opciones Avanzadas */}
            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Nombre del Remitente
                </label>
                <input
                  type="text"
                  value={config.senderName}
                  onChange={(e) => setConfig({ ...config, senderName: e.target.value })}
                  placeholder="Ej: Emisión de Certificados UNI"
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Asunto del Correo
                </label>
                <input
                  type="text"
                  value={config.subject}
                  onChange={(e) => setConfig({ ...config, subject: e.target.value })}
                  placeholder="Tu Certificado — {nombre}"
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                <span className="text-[11px] text-slate-400 block pt-0.5">
                  Variables disponibles: <code className="text-slate-600 font-semibold">{'{nombre}'}</code>, <code className="text-slate-600 font-semibold">{'{correo}'}</code> y columnas del Excel.
                </span>
              </div>

              {/* Opciones Avanzadas (Google Apps Script / Servidor personalizado) */}
              <details className="text-xs border border-slate-200 rounded-xl bg-white p-3 space-y-2">
                <summary className="font-semibold text-slate-700 cursor-pointer select-none">
                  Opciones avanzadas (Google Apps Script personalizado)
                </summary>
                <div className="pt-2 space-y-2 text-slate-600">
                  <p className="text-[11px] text-slate-500">
                    Opcional: Si prefieres enviar desde tu propio Gmail institucional en vez del servidor de Vercel, pega aquí tu Web App URL.
                  </p>
                  <input
                    type="url"
                    value={config.webAppUrl}
                    onChange={(e) => setConfig({ ...config, webAppUrl: e.target.value })}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full text-xs font-mono rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-slate-900"
                  />
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setIsScriptModalOpen(true)}
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 underline"
                    >
                      Ver código de Google Apps Script y guía
                    </button>
                  </div>
                </div>
              </details>
            </div>

            {/* Columna Derecha: Mensaje del Correo */}
            <div className="space-y-1 flex flex-col">
              <label className="text-xs font-semibold text-slate-700">
                Mensaje del Correo (HTML o texto con formato)
              </label>
              <textarea
                rows={8}
                value={config.htmlBody}
                onChange={(e) => setConfig({ ...config, htmlBody: e.target.value })}
                placeholder="<p>Hola <strong>{nombre}</strong>,</p>..."
                className="w-full flex-1 min-h-[175px] text-xs font-mono rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-y leading-relaxed"
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
              Probar Conexión del Servidor
            </Button>
          </div>
        </Card>
      )}

      {/* Grid de 2 bloques en paralelo: Prueba Individual vs Envío Masivo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Bloque Izquierdo: Prueba Individual */}
        <Card className="p-5 sm:p-6 border border-slate-200 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Envío de Prueba Individual</h4>
            </div>
            <p className="text-xs text-slate-500">
              Envíate un certificado de muestra para confirmar que el diseño y el correo llegan perfectamente antes del despacho masivo.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="tu.correo@ejemplo.com"
                className="flex-1 text-xs rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
              <Button
                variant="primary"
                size="md"
                isLoading={isSendingTest}
                leftIcon={<Send className="w-3.5 h-3.5" />}
                onClick={handleSendTestEmail}
                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 px-4 py-2.5 text-xs font-semibold shadow-xs"
              >
                Enviar prueba
              </Button>
            </div>

            {testFeedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 animate-fadeIn border ${
                  testFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {testFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="leading-snug text-xs">{testFeedback.text}</span>
                </div>
                {testFeedback.type === 'error' && !config.webAppUrl && (
                  <button
                    type="button"
                    onClick={() => setIsConfigOpen(true)}
                    className="font-semibold bg-rose-200/80 hover:bg-rose-300 text-rose-950 px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-xs shrink-0"
                  >
                    Configurar
                  </button>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Bloque Derecho: Envío Masivo */}
        <Card className="p-5 sm:p-6 border border-slate-200 flex flex-col justify-between gap-4">
          {sendProgress.status === 'idle' && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                    <Send className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Envío Masivo de Certificados</h4>
                </div>
                <p className="text-xs text-slate-500">
                  {recipientsWithEmail.length} de {recipients.length} personas tienen correo electrónico asignado.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Send className="w-4 h-4" />}
                  onClick={handleStartMassEmail}
                  disabled={recipientsWithEmail.length === 0}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20 justify-center py-2.5 text-xs font-semibold"
                >
                  Enviar {recipientsWithEmail.length} Certificados por Correo
                </Button>
              </div>
            </>
          )}

          {(sendProgress.status === 'sending' || sendProgress.status === 'paused') && (
            <div className="space-y-3.5 my-auto">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate max-w-[240px]">
                  {sendProgress.status === 'paused' ? 'Envíos en pausa' : 'Enviando certificados...'}
                  <span className="font-normal text-slate-500 font-mono truncate text-[11px]">
                    {sendProgress.currentRecipientName}
                  </span>
                </span>
                <span className="font-bold text-indigo-600 shrink-0">
                  {sendProgress.current} de {sendProgress.total}
                </span>
              </div>

              <ProgressBar
                progress={progressPercent}
                label={`Progreso: ${sendProgress.sentCount} exitosos, ${sendProgress.failedCount} fallidos`}
              />

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs">
                  <Badge variant="success" size="sm">
                    {sendProgress.sentCount} ok
                  </Badge>
                  {sendProgress.failedCount > 0 && (
                    <Badge variant="error" size="sm">
                      {sendProgress.failedCount} err
                    </Badge>
                  )}
                  {sendProgress.remainingQuota !== undefined && (
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Cuota: {sendProgress.remainingQuota}
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
            <div className="space-y-3.5 my-auto">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  sendProgress.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-amber-50 text-amber-600 border-amber-200'
                }`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {sendProgress.status === 'completed'
                      ? '¡Envío masivo finalizado!'
                      : 'Proceso detenido'}
                  </h4>
                  <p className="text-xs text-slate-600">
                    Se enviaron con éxito {sendProgress.sentCount} correos.
                    {sendProgress.failedCount > 0 && ` (${sendProgress.failedCount} con error).`}
                  </p>
                </div>
              </div>

              {sendProgress.failedCount > 0 && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold block">Motivo del error:</span>
                    <span className="text-[11px] leading-relaxed text-rose-700 block">
                      {Object.values(sendProgress.records).find((r) => r.status === 'error')?.errorMessage ||
                        'Error de conexión con el servicio de correo.'}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={handleDownloadCsvReport}
                  className="flex-1 justify-center text-xs"
                >
                  Reporte CSV
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
                  className="flex-1 justify-center text-xs text-slate-600 hover:text-slate-900"
                >
                  Reiniciar
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
