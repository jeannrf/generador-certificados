import React, { useState, useEffect, useMemo } from 'react';
import { ColumnMapping } from '../../domain/types';
import { Stepper, StepDefinition } from '../../ui/Stepper';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { RecipientsStep } from '../recipients/RecipientsStep';
import { EmailDispatcherSection } from '../generation/EmailDispatcherSection';
import { ParsedTableData } from '../../infra/parsers';
import { validateRecipients } from '../../domain/validation';
import { summarizeCampaign } from '../../domain/email';
import { loadCampaign } from '../../infra/email/campaignStorage';
import { Users, Send, ChevronLeft, ChevronDown, AlertCircle, CheckCircle2, History } from 'lucide-react';

type MailerStep = 1 | 2;

const MAILER_STEPS: StepDefinition<MailerStep>[] = [
  { step: 1, title: 'Contactos', description: 'Excel o CSV', icon: Users },
  { step: 2, title: 'Redactar y Enviar', description: 'Mensaje y envío masivo', icon: Send },
];

/**
 * Servicio de envío masivo de correos: reutiliza la carga de destinatarios y el despachador
 * de correos del generador, pero sin plantilla ni certificados adjuntos.
 */
export const MailerWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<MailerStep>(1);
  const [tableData, setTableData] = useState<ParsedTableData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ nameColumn: '' });
  const [showInvalid, setShowInvalid] = useState(false);

  const recipients = useMemo(() => {
    if (!tableData || !mapping.emailColumn) return [];
    const raw = tableData.rows.map((row) => ({
      name: mapping.nameColumn ? row[mapping.nameColumn] || '' : '',
      email: row[mapping.emailColumn!] || '',
      extra: row,
    }));
    return validateRecipients(raw, { requireName: false, requireEmail: true });
  }, [tableData, mapping]);

  const validRecipients = recipients.filter((r) => !r.issues.some((i) => i.severity === 'error'));
  const invalidRecipients = recipients.filter((r) => r.issues.some((i) => i.severity === 'error'));
  const duplicateCount = recipients.filter((r) => r.issues.some((i) => i.code === 'DUPLICATE')).length;

  // Envío guardado de una sesión anterior (se relee al cambiar de paso)
  const savedCampaignSummary = useMemo(() => {
    const saved = loadCampaign('mail');
    return saved ? { ...summarizeCampaign(saved), startedAt: saved.startedAt } : null;
  }, [currentStep]);

  // Alerta antes de salir si hay una lista cargada
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (tableData) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [tableData]);

  const handleStepClick = (step: MailerStep) => {
    if (step === 2 && validRecipients.length === 0 && !savedCampaignSummary) return;
    setCurrentStep(step);
  };

  return (
    <div className="flex-1 flex flex-col">
      <Stepper currentStep={currentStep} onStepClick={handleStepClick} steps={MAILER_STEPS} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:px-6">
        {currentStep === 1 && savedCampaignSummary && (
          <div className="mb-6 p-4 rounded-2xl bg-sky-50 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-start gap-3">
              <History className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div className="text-sm text-sky-900">
                <p className="font-bold">Tienes un envío guardado</p>
                <p className="text-xs text-sky-800">
                  Iniciado el{' '}
                  {new Date(savedCampaignSummary.startedAt).toLocaleString('es-PE', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                  : {savedCampaignSummary.sent} de {savedCampaignSummary.total} enviados
                  {savedCampaignSummary.total - savedCampaignSummary.sent > 0 &&
                    `, faltan ${savedCampaignSummary.total - savedCampaignSummary.sent}`}
                  .
                </p>
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={() => setCurrentStep(2)} className="shrink-0">
              Ver envío
            </Button>
          </div>
        )}

        {currentStep === 1 && (
          <RecipientsStep
            variant="mail"
            tableData={tableData}
            mapping={mapping}
            onDataLoaded={(data, newMapping) => {
              setTableData(data);
              setMapping(newMapping);
            }}
            onMappingChange={setMapping}
            onContinue={() => setCurrentStep(2)}
            onClearData={() => {
              setTableData(null);
              setMapping({ nameColumn: '' });
            }}
          />
        )}

        {currentStep === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Redacta y envía tus correos
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Personaliza el mensaje, envíate una prueba y lanza el envío a toda tu lista.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<ChevronLeft className="w-4 h-4" />}
                onClick={() => setCurrentStep(1)}
              >
                Cambiar contactos
              </Button>
            </div>

            {/* Resumen de la lista cargada (no existe al volver a un envío guardado tras recargar) */}
            {tableData && (
              <Card className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left sm:divide-x divide-slate-100">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Contactos cargados
                    </span>
                    <p className="text-2xl font-extrabold text-slate-900">{recipients.length}</p>
                  </div>
                  <div className="space-y-0.5 sm:pl-4">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Listos para enviar
                    </span>
                    <p className="text-2xl font-extrabold text-[#208077] flex items-center justify-center sm:justify-start gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      {validRecipients.length}
                    </p>
                  </div>
                  <div className="space-y-0.5 sm:pl-4">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Se omitirán
                    </span>
                    <p
                      className={`text-2xl font-extrabold ${
                        invalidRecipients.length > 0 ? 'text-rose-600' : 'text-slate-300'
                      }`}
                    >
                      {invalidRecipients.length}
                    </p>
                  </div>
                </div>

                {duplicateCount > 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Hay {duplicateCount} {duplicateCount === 1 ? 'correo repetido' : 'correos repetidos'} en tu lista;
                    esas personas recibirán el mensaje más de una vez.
                  </p>
                )}

                {invalidRecipients.length > 0 && (
                  <div className="border border-rose-200 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowInvalid(!showInvalid)}
                      className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        Ver filas sin correo válido
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showInvalid ? 'rotate-180' : ''}`} />
                    </button>
                    {showInvalid && (
                      <ul className="max-h-48 overflow-auto divide-y divide-rose-100 text-xs bg-white">
                        {invalidRecipients.map((r) => (
                          <li key={r.id} className="px-4 py-2 flex items-center justify-between gap-3">
                            <span className="text-slate-700 truncate">
                              <span className="font-mono text-slate-400 mr-2">Fila {r.rowNumber}</span>
                              {r.email || r.name || '—'}
                            </span>
                            <span className="text-rose-600 shrink-0">
                              {r.issues.find((i) => i.severity === 'error')?.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </Card>
            )}

            <EmailDispatcherSection variant="mail" recipients={validRecipients} />
          </div>
        )}
      </main>
    </div>
  );
};
