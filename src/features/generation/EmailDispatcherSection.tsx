import React, { useState, useEffect, useRef } from 'react';
import {
  Recipient,
  EmailConfig,
  EmailCampaign,
  EmailDeliveryRecord,
} from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';
import { Badge } from '../../ui/Badge';
import {
  sendEmailViaScript,
  uint8ArrayToBase64,
  loadEmailConfigFromStorage,
  saveEmailConfigToStorage,
  EmailConfigVariant,
} from '../../infra/email/googleAppsScript';
import { saveCampaign, loadCampaign, clearCampaign } from '../../infra/email/campaignStorage';
import { loadSendLog, recordSentEmail } from '../../infra/email/sendLog';
import {
  interpolateEmailVariables,
  validateEmailConfig,
  buildDeliveryReportCsv,
  ensureHtmlEmailBody,
  getCampaignRecords,
  summarizeCampaign,
  getUnsentRecipients,
  summarizeDailyQuota,
} from '../../domain/email';
import { triggerDownload } from '../../infra/zipExporter';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Download,
  Settings,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Eye,
  Paperclip,
  History,
  Gauge,
} from 'lucide-react';

export interface EmailAttachmentFile {
  fileName: string;
  pdfBytes: Uint8Array;
}

interface EmailDispatcherSectionProps {
  recipients: Recipient[];
  /** 'certificates' adjunta un PDF por persona; 'mail' envía solo el mensaje */
  variant?: EmailConfigVariant;
  /** Genera el PDF adjunto de cada destinatario (solo en modo certificados) */
  buildAttachment?: (recipient: Recipient) => Promise<EmailAttachmentFile>;
}

// Pausa entre correos para respetar el ritmo de Gmail
const SEND_DELAY_MS = 1500;
// Espera antes de reintentar automáticamente un correo que falló
const RETRY_DELAY_MS = 4000;
// Tras esta cantidad de fallos seguidos se pausa el envío (suele ser un bloqueo temporal de Gmail)
const MAX_CONSECUTIVE_FAILURES = 5;

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

type ResultsFilter = 'all' | 'sent' | 'failed' | 'pending';

const STATUS_LABEL: Record<EmailDeliveryRecord['status'], string> = {
  sent: 'Enviado',
  error: 'Falló',
  sending: 'Sin confirmar',
  pending: 'Pendiente',
  skipped: 'Omitido',
};

const STATUS_BADGE: Record<EmailDeliveryRecord['status'], 'success' | 'error' | 'warning' | 'neutral'> = {
  sent: 'success',
  error: 'error',
  sending: 'warning',
  pending: 'neutral',
  skipped: 'neutral',
};

const COPY = {
  certificates: {
    title: 'Envío Automático de Certificados por Correo',
    subtitle: 'Despacha los certificados en PDF adjuntos a cada destinatario automáticamente con un solo clic.',
    senderPlaceholder: 'Ej: Emisión de Certificados UNI',
    subjectPlaceholder: 'Tu Certificado — {nombre}',
    bodyPlaceholder: 'Hola {nombre},\n\n¡Felicitaciones! Adjuntamos tu certificado oficial en formato PDF...\n\nSaludos cordiales,\nComité Organizador',
    testDescription: 'Envíate un certificado de muestra para confirmar que el diseño y el correo llegan perfectamente antes del despacho masivo.',
    testSuccess: (to: string) => `¡Certificado de prueba enviado con éxito a ${to}! Revisa tu bandeja de entrada o spam.`,
    massTitle: 'Envío Masivo de Certificados',
    massButton: (n: number) => `Enviar ${n} Certificados por Correo`,
    sending: 'Enviando certificados...',
    reportPrefix: 'Reporte_Envios_Certificados',
  },
  mail: {
    title: 'Personaliza tu mensaje',
    subtitle: 'Cada persona recibe un correo individual y personalizado con los datos de su fila.',
    senderPlaceholder: 'Ej: Equipo de Eventos UNI',
    subjectPlaceholder: 'Hola {nombre}, tenemos novedades para ti',
    bodyPlaceholder: 'Hola {nombre},\n\nTe escribimos para compartirte información importante...\n\nSaludos cordiales,\nEl equipo',
    testDescription: 'Envíate el correo a ti primero para revisar cómo se ve antes de mandarlo a toda la lista.',
    testSuccess: (to: string) => `¡Correo de prueba enviado con éxito a ${to}! Revisa tu bandeja de entrada o spam.`,
    massTitle: 'Envío Masivo de Correos',
    massButton: (n: number) => `Enviar ${n} ${n === 1 ? 'Correo' : 'Correos'}`,
    sending: 'Enviando correos...',
    reportPrefix: 'Reporte_Envios_Correos',
  },
};

export const EmailDispatcherSection: React.FC<EmailDispatcherSectionProps> = ({
  recipients,
  variant = 'certificates',
  buildAttachment,
}) => {
  const copy = COPY[variant];
  // Configuración cargada desde localStorage (abierta por defecto)
  const [config, setConfig] = useState<EmailConfig>(() => loadEmailConfigFromStorage(variant));
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [emailViewMode, setEmailViewMode] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertVariable = (varName: string) => {
    if (!textareaRef.current) {
      setConfig((prev) => ({ ...prev, htmlBody: prev.htmlBody + ` {${varName}}` }));
      return;
    }
    const el = textareaRef.current;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const text = config.htmlBody;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const updated = `${before}{${varName}}${after}`;
    setConfig((prev) => ({ ...prev, htmlBody: updated }));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + varName.length + 2, start + varName.length + 2);
    }, 10);
  };

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

  // Envío en curso o recuperado de una sesión anterior (persistido tras cada correo)
  // Un envío ya terminado con una lista distinta a la actual no se restaura: se empieza uno nuevo
  const [campaign, setCampaign] = useState<EmailCampaign | null>(() => {
    const saved = loadCampaign(variant);
    if (!saved || getUnsentRecipients(saved).length > 0) return saved;
    const savedEmails = new Set(saved.recipients.map((r) => (r.email ?? '').trim().toLowerCase()));
    const sameList =
      savedEmails.size === recipientsWithEmail.length &&
      recipientsWithEmail.every((r) => savedEmails.has((r.email ?? '').trim().toLowerCase()));
    if (sameList || recipientsWithEmail.length === 0) return saved;
    clearCampaign(variant);
    return null;
  });
  const campaignRef = useRef<EmailCampaign | null>(campaign);
  const [wasRestored] = useState(() => campaign !== null && getUnsentRecipients(campaign).length > 0);
  const [runStatus, setRunStatus] = useState<'idle' | 'sending' | 'paused'>('idle');
  const [runProgress, setRunProgress] = useState({ current: 0, total: 0 });
  const [currentRecipientName, setCurrentRecipientName] = useState<string>();
  // Correos enviados con éxito en las últimas 24 h (cupo diario de Gmail)
  const [sendLog, setSendLog] = useState<number[]>(() => loadSendLog());
  const [autoPauseReason, setAutoPauseReason] = useState<string | null>(null);
  const [resultsFilter, setResultsFilter] = useState<ResultsFilter>('all');

  const isCancelledRef = useRef(false);
  const isPausedRef = useRef(false);

  // Refrescar el cupo cada minuto para que se liberen los envíos que cumplen 24 h
  useEffect(() => {
    const timer = setInterval(() => setSendLog(loadSendLog()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Avisar antes de cerrar o recargar mientras se están enviando correos
  useEffect(() => {
    if (runStatus === 'idle') return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [runStatus]);

  // Guardar configuración cuando cambie
  useEffect(() => {
    saveEmailConfigToStorage(config, variant);
  }, [config, variant]);

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
      // 1. Tomar destinatario de ejemplo y generar el PDF si corresponde
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

      const attachmentFile = buildAttachment ? await buildAttachment(testRecWithTargetEmail) : undefined;

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
        htmlBody: ensureHtmlEmailBody(interpolatedBody),
        senderName: config.senderName,
        attachment: attachmentFile && {
          filename: attachmentFile.fileName,
          base64: uint8ArrayToBase64(attachmentFile.pdfBytes),
        },
      });

      if (result.ok) {
        setSendLog(recordSentEmail());
        setTestFeedback({
          type: 'success',
          text: copy.testSuccess(testEmail.trim()),
        });
      } else {
        setTestFeedback({
          type: 'error',
          text: result.error || 'Error al enviar el correo de prueba.',
        });
      }
    } catch (err: any) {
      setTestFeedback({
        type: 'error',
        text: err?.message || 'Error inesperado al enviar el correo de prueba.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const commitCampaign = (next: EmailCampaign | null) => {
    campaignRef.current = next;
    setCampaign(next);
    if (next) saveCampaign(variant, next);
    else clearCampaign(variant);
  };

  const setRecord = (record: EmailDeliveryRecord) => {
    const current = campaignRef.current;
    if (!current) return;
    commitCampaign({
      ...current,
      updatedAt: new Date().toISOString(),
      records: { ...current.records, [record.recipientId]: record },
    });
  };

  const ensureValidConfig = (): boolean => {
    const validation = validateEmailConfig(config);
    if (!validation.isValid) {
      setTestFeedback({
        type: 'error',
        text: validation.errors[0] || 'Por favor verifica la configuración de envío.',
      });
      setIsConfigOpen(true);
    }
    return validation.isValid;
  };

  const sendOne = async (rec: Recipient): Promise<{ ok: boolean; error?: string; remainingQuota?: number }> => {
    try {
      const attachmentFile = buildAttachment ? await buildAttachment(rec) : undefined;
      return await sendEmailViaScript({
        webAppUrl: config.webAppUrl,
        token: config.token,
        to: rec.email!.trim(),
        subject: interpolateEmailVariables(config.subject, rec),
        htmlBody: ensureHtmlEmailBody(
          interpolateEmailVariables(config.htmlBody, rec, { escapeForHtml: false })
        ),
        senderName: config.senderName,
        attachment: attachmentFile && {
          filename: attachmentFile.fileName,
          base64: uint8ArrayToBase64(attachmentFile.pdfBytes),
        },
      });
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Error desconocido' };
    }
  };

  // Envía a la lista indicada guardando el estado de cada persona tras cada correo
  const runSend = async (targets: Recipient[]) => {
    isCancelledRef.current = false;
    isPausedRef.current = false;
    setAutoPauseReason(null);
    setRunStatus('sending');
    setRunProgress({ current: 0, total: targets.length });

    let consecutiveFailures = 0;

    for (let i = 0; i < targets.length; i++) {
      while (isPausedRef.current && !isCancelledRef.current) {
        await wait(500);
      }
      if (isCancelledRef.current) break;

      // Sin cupo diario: pausar en vez de gastar intentos que Gmail rechazaría
      const quota = summarizeDailyQuota(loadSendLog());
      if (quota.remaining <= 0) {
        isPausedRef.current = true;
        setRunStatus('paused');
        setAutoPauseReason(
          `Llegaste al límite diario de ${quota.limit} correos${
            quota.nextReleaseAt ? ` (se libera cupo desde el ${formatDateTime(quota.nextReleaseAt)})` : ''
          }. Puedes dejarlo en pausa y pulsar Reanudar más tarde, o detenerlo y usar "Enviar a los que faltan" otro día.`
        );
        i--;
        continue;
      }

      const rec = targets[i];
      const targetEmail = rec.email!.trim();
      const base = { recipientId: rec.id, name: rec.name || targetEmail, email: targetEmail };

      setRunProgress({ current: i + 1, total: targets.length });
      setCurrentRecipientName(rec.name ? `${rec.name} (${targetEmail})` : targetEmail);

      // Se marca antes de enviar: si la página se cierra a mitad, queda como "sin confirmar"
      setRecord({ ...base, status: 'sending' });

      let result = await sendOne(rec);
      if (!result.ok && !isCancelledRef.current) {
        await wait(RETRY_DELAY_MS);
        result = await sendOne(rec);
      }

      setRecord({
        ...base,
        status: result.ok ? 'sent' : 'error',
        errorMessage: result.ok ? undefined : result.error,
        sentAt: new Date().toISOString(),
      });
      if (result.ok) setSendLog(recordSentEmail());

      consecutiveFailures = result.ok ? 0 : consecutiveFailures + 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        consecutiveFailures = 0;
        isPausedRef.current = true;
        setRunStatus('paused');
        setAutoPauseReason(
          `Pausamos el envío porque fallaron ${MAX_CONSECUTIVE_FAILURES} correos seguidos. Último error: ${
            result.error || 'desconocido'
          }. Espera unos minutos y pulsa Reanudar.`
        );
      }

      if (i < targets.length - 1) {
        await wait(SEND_DELAY_MS);
      }
    }

    setRunStatus('idle');
    setCurrentRecipientName(undefined);
  };

  // Avisa si la lista supera el cupo que queda hoy; lo que no alcance quedará pendiente
  const confirmQuota = (count: number): boolean => {
    const quota = summarizeDailyQuota(loadSendLog());
    if (count <= quota.remaining) return true;
    return window.confirm(
      `Vas a enviar ${count} correos, pero hoy solo te quedan ${quota.remaining} de ${quota.limit}. ` +
        `Se enviarán ${quota.remaining} y el envío se pausará; el resto quedará pendiente para cuando se libere el cupo. ¿Continuar?`
    );
  };

  const handleStartMassEmail = () => {
    if (!ensureValidConfig()) return;
    if (recipientsWithEmail.length === 0) return;
    if (!confirmQuota(recipientsWithEmail.length)) return;

    const now = new Date().toISOString();
    commitCampaign({
      id: `camp_${Date.now()}`,
      startedAt: now,
      updatedAt: now,
      subject: config.subject,
      recipients: recipientsWithEmail,
      records: {},
    });
    setResultsFilter('all');
    runSend(recipientsWithEmail);
  };

  const handleRetryUnsent = () => {
    if (!campaignRef.current || !ensureValidConfig()) return;
    const unsent = getUnsentRecipients(campaignRef.current);
    if (!confirmQuota(unsent.length)) return;
    runSend(unsent);
  };

  const handleCancelSend = () => {
    isCancelledRef.current = true;
  };

  const handleTogglePause = () => {
    isPausedRef.current = !isPausedRef.current;
    if (!isPausedRef.current) setAutoPauseReason(null);
    setRunStatus(isPausedRef.current ? 'paused' : 'sending');
  };

  const handleNewCampaign = () => {
    const unsent = campaignRef.current ? getUnsentRecipients(campaignRef.current).length : 0;
    if (
      unsent > 0 &&
      !window.confirm(
        `Aún hay ${unsent} ${unsent === 1 ? 'persona' : 'personas'} sin enviar. Si empiezas un envío nuevo se borrará este registro. ¿Continuar?`
      )
    ) {
      return;
    }
    commitCampaign(null);
    setAutoPauseReason(null);
  };

  const handleDownloadCsvReport = () => {
    if (!campaign) return;
    const csvContent = buildDeliveryReportCsv(getCampaignRecords(campaign));
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${copy.reportPrefix}_${Date.now()}.csv`);
  };

  const summary = campaign ? summarizeCampaign(campaign) : null;
  const unsentCount = summary ? summary.failed + summary.unconfirmed + summary.pending : 0;
  const isRunning = runStatus !== 'idle';
  const dailyQuota = summarizeDailyQuota(sendLog);
  const quotaPercent = (dailyQuota.sent / dailyQuota.limit) * 100;
  const campaignRecords = campaign ? getCampaignRecords(campaign) : [];
  const filteredRecords = campaignRecords.filter((r) => {
    if (resultsFilter === 'sent') return r.status === 'sent';
    if (resultsFilter === 'failed') return r.status === 'error' || r.status === 'sending';
    if (resultsFilter === 'pending') return r.status === 'pending';
    return true;
  });
  const formatDateTime = (date: string | number) =>
    new Date(date).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className={variant === 'certificates' ? 'mt-8 pt-8 border-t border-slate-200 space-y-6' : 'space-y-6'}>
      {/* Header de la sección de correo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#f0faf9] border border-[#b2e5df] flex items-center justify-center text-[#208077] shadow-xs">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              {copy.title}
            </h3>
            <p className="text-xs text-slate-500">
              {copy.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Settings className="w-4 h-4 text-[#208077]" />}
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
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Columna Izquierda: Remitente y Asunto */}
            <div className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Nombre del Remitente
                </label>
                <input
                  type="text"
                  value={config.senderName}
                  onChange={(e) => setConfig({ ...config, senderName: e.target.value })}
                  placeholder={copy.senderPlaceholder}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-[#208077] focus:border-[#208077]"
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
                  placeholder={copy.subjectPlaceholder}
                  className="w-full text-xs rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:ring-2 focus:ring-[#208077] focus:border-[#208077]"
                />
                <span className="text-[11px] text-slate-400 block pt-0.5">
                  Variables disponibles: <code className="text-slate-600 font-semibold">{'{nombre}'}</code>, <code className="text-slate-600 font-semibold">{'{correo}'}</code> y columnas del Excel.
                </span>
              </div>
            </div>

            {/* Columna Derecha: Mensaje del Correo */}
            <div className="space-y-1 flex flex-col">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-0.5">
                <label className="text-xs font-semibold text-slate-700">
                  Mensaje del Correo
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium mr-0.5 hidden sm:inline">Insertar:</span>
                  <button
                    type="button"
                    onClick={() => insertVariable('nombre')}
                    className="text-[10px] font-semibold text-[#208077] bg-white hover:bg-[#f0faf9] border border-[#b2e5df] px-2 py-0.5 rounded-md transition-colors cursor-pointer shadow-2xs"
                    title="Insertar {nombre} en la posición del cursor"
                  >
                    + {'{nombre}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('correo')}
                    className="text-[10px] font-semibold text-[#208077] bg-white hover:bg-[#f0faf9] border border-[#b2e5df] px-2 py-0.5 rounded-md transition-colors cursor-pointer shadow-2xs"
                    title="Insertar {correo} en la posición del cursor"
                  >
                    + {'{correo}'}
                  </button>
                  <div className="h-3.5 w-px bg-slate-200 mx-0.5" />
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs text-[11px]">
                    <button
                      type="button"
                      onClick={() => setEmailViewMode('write')}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                        emailViewMode === 'write'
                          ? 'bg-[#208077] text-white font-semibold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Escribir
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailViewMode('preview')}
                      className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                        emailViewMode === 'preview'
                          ? 'bg-[#208077] text-white font-semibold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      Vista previa
                    </button>
                  </div>
                </div>
              </div>

              {emailViewMode === 'write' ? (
                <>
                  <textarea
                    ref={textareaRef}
                    rows={7}
                    value={config.htmlBody}
                    onChange={(e) => setConfig({ ...config, htmlBody: e.target.value })}
                    placeholder={copy.bodyPlaceholder}
                    className="w-full flex-1 min-h-[175px] text-xs font-sans rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus:ring-2 focus:ring-[#208077] focus:border-[#208077] resize-y leading-relaxed shadow-2xs"
                  />
                  <span className="text-[11px] text-slate-500 leading-snug pt-0.5 flex items-start gap-1">
                    <span>💡</span>
                    <span>
                      Escribe texto normal con saltos de línea (Enter). <strong>No necesitas saber HTML</strong>: el sistema le da formato elegante automáticamente al enviar.
                    </span>
                  </span>
                </>
              ) : (
                <div className="w-full min-h-[195px] rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-2xs flex flex-col justify-between animate-fadeIn">
                  <div className="space-y-3">
                    <div className="border-b border-slate-100 pb-2 text-[11px] text-slate-500 space-y-1">
                      <p>
                        <strong className="text-slate-700">De:</strong> {config.senderName || copy.senderPlaceholder}
                      </p>
                      <p>
                        <strong className="text-slate-700">Asunto:</strong>{' '}
                        {interpolateEmailVariables(
                          config.subject,
                          recipients.length > 0
                            ? recipients[0]
                            : { id: 's', rowNumber: 1, name: 'Jeanpier Robles', email: 'jeanpier@uni.pe', extra: {}, issues: [] }
                        )}
                      </p>
                    </div>
                    <div
                      className="text-xs text-slate-800 leading-relaxed font-sans"
                      dangerouslySetInnerHTML={{
                        __html: ensureHtmlEmailBody(
                          interpolateEmailVariables(
                            config.htmlBody,
                            recipients.length > 0
                              ? recipients[0]
                              : { id: 's', rowNumber: 1, name: 'Jeanpier Robles', email: 'jeanpier@uni.pe', extra: {}, issues: [] },
                            { escapeForHtml: true }
                          )
                        ),
                      }}
                    />
                  </div>
                  {buildAttachment && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg">
                      <Paperclip className="w-3.5 h-3.5 text-[#208077]" />
                      <span className="font-semibold text-slate-800">Archivo adjunto:</span>
                      <span className="font-mono text-slate-500 truncate">
                        Certificado - {recipients.length > 0 ? recipients[0].name : 'Destinatario'}.pdf
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Cupo diario de Gmail (contado en este navegador, ventana móvil de 24 h) */}
      <Card className="p-4 sm:p-5 border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#f0faf9] border border-[#b2e5df] text-[#208077] flex items-center justify-center shrink-0">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">Cupo diario de Gmail</h4>
              <p className="text-[11px] text-slate-500">
                {dailyQuota.sent} enviados en las últimas 24 h ·{' '}
                <strong className={dailyQuota.remaining === 0 ? 'text-rose-600' : 'text-[#208077]'}>
                  te quedan {dailyQuota.remaining}
                </strong>{' '}
                de {dailyQuota.limit}
              </p>
            </div>
          </div>
          {dailyQuota.nextReleaseAt && (
            <span className="text-[11px] text-slate-500">
              Próximo cupo libre: {formatDateTime(dailyQuota.nextReleaseAt)}
            </span>
          )}
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              quotaPercent >= 90 ? 'bg-rose-500' : quotaPercent >= 70 ? 'bg-amber-500' : 'bg-[#208077]'
            }`}
            style={{ width: `${Math.min(100, quotaPercent)}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 leading-snug">
          Google cuenta 24 horas desde cada envío, no se reinicia a medianoche. Este contador solo incluye lo enviado
          desde esta app en este navegador; los correos que mandes directamente desde Gmail también consumen el cupo.
        </p>
      </Card>

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
              {copy.testDescription}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="tu.correo@ejemplo.com"
                className="flex-1 text-xs rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#208077] focus:border-[#208077]"
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
                {testFeedback.type === 'error' && !isConfigOpen && (
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
          {!campaign && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#f0faf9] border border-[#b2e5df] text-[#208077] flex items-center justify-center shrink-0">
                    <Send className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">{copy.massTitle}</h4>
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
                  className="w-full bg-[#208077] hover:bg-[#18655e] shadow-sm justify-center py-2.5 text-xs font-semibold"
                >
                  {copy.massButton(recipientsWithEmail.length)}
                </Button>
              </div>
            </>
          )}

          {campaign && summary && (
            <div className="space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900">
                    {runStatus === 'sending'
                      ? copy.sending
                      : runStatus === 'paused'
                      ? 'Envío en pausa'
                      : unsentCount === 0
                      ? '¡Envío completado!'
                      : 'Envío incompleto'}
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    Iniciado el {formatDateTime(campaign.startedAt)}
                  </p>
                </div>
                <span className="font-bold text-[#208077] text-xs shrink-0">
                  {summary.sent} de {summary.total} enviados
                </span>
              </div>

              <ProgressBar
                progress={summary.total > 0 ? (summary.sent / summary.total) * 100 : 0}
                label={
                  isRunning
                    ? `Lote actual: ${runProgress.current} de ${runProgress.total}`
                    : `${summary.sent} enviados, ${summary.failed + summary.unconfirmed} fallidos, ${summary.pending} pendientes`
                }
              />

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Badge variant="success" size="sm">{summary.sent} enviados</Badge>
                {summary.failed + summary.unconfirmed > 0 && (
                  <Badge variant="error" size="sm">{summary.failed + summary.unconfirmed} fallidos</Badge>
                )}
                {summary.pending > 0 && (
                  <Badge variant="neutral" size="sm">{summary.pending} pendientes</Badge>
                )}
              </div>

              {isRunning && currentRecipientName && (
                <p className="text-[11px] text-slate-500 font-mono truncate">{currentRecipientName}</p>
              )}

              {isRunning && (
                <p className="text-[11px] text-slate-500 leading-snug">
                  Mantén esta pestaña abierta y visible. El progreso se guarda después de cada correo.
                </p>
              )}

              {autoPauseReason && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">{autoPauseReason}</span>
                </div>
              )}

              {!isRunning && wasRestored && unsentCount > 0 && (
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex items-start gap-2 animate-fadeIn">
                  <History className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    Recuperamos tu envío anterior (último avance: {formatDateTime(campaign.updatedAt)}).
                    Puedes continuar con las personas a las que aún no les llegó.
                  </span>
                </div>
              )}

              {!isRunning && summary.unconfirmed > 0 && (
                <p className="text-[11px] text-amber-700 leading-snug">
                  {summary.unconfirmed === 1 ? '1 correo quedó' : `${summary.unconfirmed} correos quedaron`} sin
                  confirmar porque la página se cerró mientras se enviaba. Se incluirá en el reintento, así que esa
                  persona podría recibirlo dos veces.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                {isRunning ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={runStatus === 'paused' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      onClick={handleTogglePause}
                    >
                      {runStatus === 'paused' ? 'Reanudar' : 'Pausar'}
                    </Button>
                    <Button variant="danger" size="sm" onClick={handleCancelSend}>
                      Detener
                    </Button>
                  </>
                ) : (
                  <>
                    {unsentCount > 0 && (
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                        onClick={handleRetryUnsent}
                        className="flex-1 justify-center"
                      >
                        Enviar a los {unsentCount} que faltan
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Download className="w-3.5 h-3.5" />}
                      onClick={handleDownloadCsvReport}
                    >
                      Reporte CSV
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleNewCampaign}
                      className="text-slate-500 hover:text-slate-900"
                    >
                      Nuevo envío
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Detalle por persona: a quién le llegó y a quién no */}
      {campaign && summary && (
        <Card className="p-5 sm:p-6 border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-slate-900">Detalle del envío por persona</h4>
            <div className="inline-flex flex-wrap rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
              {([
                ['all', `Todos (${summary.total})`],
                ['sent', `Enviados (${summary.sent})`],
                ['failed', `Fallidos (${summary.failed + summary.unconfirmed})`],
                ['pending', `Pendientes (${summary.pending})`],
              ] as [ResultsFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setResultsFilter(key)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    resultsFilter === key
                      ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-auto rounded-xl border border-slate-200 max-h-80">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left w-10">#</th>
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-left">Correo</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRecords.map((r, idx) => (
                    <tr key={r.recipientId}>
                      <td className="px-3 py-1.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                      <td className="px-3 py-1.5 text-slate-800 truncate max-w-[180px]">{r.name}</td>
                      <td className="px-3 py-1.5 text-slate-600 truncate max-w-[220px]">{r.email}</td>
                      <td className="px-3 py-1.5">
                        <Badge variant={STATUS_BADGE[r.status]} size="sm">
                          {r.status === 'sending' && isRunning ? 'Enviando…' : STATUS_LABEL[r.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 text-rose-600 text-[11px] max-w-[260px] truncate" title={r.errorMessage}>
                        {r.errorMessage || ''}
                      </td>
                    </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                      No hay personas en esta categoría.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
