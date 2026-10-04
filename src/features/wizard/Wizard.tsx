import React, { useState, useEffect } from 'react';
import {
  WizardStep as WizardStepType,
  TemplateData,
  FieldBox,
  Recipient,
  ColumnMapping,
} from '../../domain/types';
import { Stepper } from '../../ui/Stepper';
import { TemplateStep } from '../template/TemplateStep';
import { FieldEditorStep } from '../field/FieldEditorStep';
import { RecipientsStep } from '../recipients/RecipientsStep';
import { ReviewStep } from '../review/ReviewStep';
import { GenerationStep } from '../generation/GenerationStep';
import { ParsedTableData } from '../../infra/parsers';
import { validateRecipients } from '../../domain/validation';
import { saveSession, loadSession, clearSession } from '../../infra/storage';
import {
  SimplePrerequisiteModal,
  PrerequisiteNoticeModalInfo,
} from '../../ui/SimplePrerequisiteModal';

const INITIAL_FIELD: FieldBox = {
  id: 'field_name',
  name: 'Nombre del Destinatario',
  source: { type: 'column', column: 'nombre' },
  x: 0.05,
  y: 0.42,
  width: 0.90,
  height: 0.13,
  fontFamily: 'Playfair Display, Georgia, serif',
  maxFontSize: 28,
  minFontSize: 20,
  color: '#0f172a',
  align: 'center',
  vAlign: 'middle',
  textCase: 'title',
  isBold: true,
  isItalic: false,
};

export const Wizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<WizardStepType>(1);
  const [maxStepUnlocked, setMaxStepUnlocked] = useState<WizardStepType>(1);

  // Estados del Wizard
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [field, setField] = useState<FieldBox>(INITIAL_FIELD);
  const [tableData, setTableData] = useState<ParsedTableData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ nameColumn: '' });
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [prereqModal, setPrereqModal] = useState<PrerequisiteNoticeModalInfo | null>(null);

  // Restaurar sesión al cargar la página (ante F5)
  useEffect(() => {
    let isMounted = true;
    loadSession().then((saved) => {
      if (!isMounted || !saved) return;
      let hasValidTemplate = false;
      if (saved.template) {
        // Ignorar plantillas demo antiguas que hayan quedado guardadas en el navegador
        const tpl = saved.template as TemplateData;
        if (tpl.id?.startsWith('tpl_demo_') || tpl.name?.includes('Diploma de Reconocimiento')) {
          setTemplate(null);
        } else {
          let restoredPreviewUrl = tpl.previewUrl;
          if (tpl.kind === 'image' && tpl.bytes && tpl.bytes.length > 0) {
            try {
              restoredPreviewUrl = URL.createObjectURL(
                new Blob([tpl.bytes as unknown as BlobPart], { type: tpl.mimeType || 'image/png' })
              );
            } catch (err) {
              console.warn('No se pudo regenerar ObjectURL para la plantilla de imagen:', err);
            }
          }
          setTemplate({ ...tpl, previewUrl: restoredPreviewUrl });
          hasValidTemplate = true;
        }
      }
      if (saved.field) {
        const f = saved.field as FieldBox;
        if (f.maxFontSize > 28 || f.width < 0.88) {
          setField({
            ...f,
            maxFontSize: 28,
            x: 0.05,
            width: 0.90,
            isBold: true,
          });
        } else {
          setField(f);
        }
      }
      if (saved.tableData) setTableData(saved.tableData);
      if (saved.mapping) setMapping(saved.mapping);
      if (saved.recipients && saved.recipients.length > 0) setRecipients(saved.recipients);

      if (!hasValidTemplate) {
        // Si no hay plantilla válida, forzar inicio en Paso 1
        setMaxStepUnlocked(1);
        setCurrentStep(1);
      } else {
        if (saved.maxStepUnlocked) setMaxStepUnlocked(saved.maxStepUnlocked as WizardStepType);
        if (saved.currentStep) setCurrentStep(saved.currentStep as WizardStepType);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Guardar sesión automáticamente con debounce
  useEffect(() => {
    if (!template && recipients.length === 0) return;
    const timer = setTimeout(() => {
      saveSession({
        currentStep,
        maxStepUnlocked,
        template,
        field,
        tableData,
        mapping,
        recipients,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [currentStep, maxStepUnlocked, template, field, tableData, mapping, recipients]);

  // Alerta antes de salir si hay datos cargados
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (recipients.length > 0 || template !== null) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [recipients.length, template]);

  const unlockStep = (step: WizardStepType) => {
    setCurrentStep(step);
    if (step > maxStepUnlocked) {
      setMaxStepUnlocked(step);
    }
  };

  const handleStepClick = (targetStep: WizardStepType) => {
    if (targetStep >= 2 && !template) {
      setPrereqModal({
        title: 'Plantilla requerida',
        message: 'Para configurar la posición o revisar los certificados, primero debes subir tu diseño de plantilla en el Paso 1.',
      });
      return;
    }
    if ((targetStep === 4 || targetStep === 5) && recipients.length === 0) {
      setPrereqModal({
        title: 'Destinatarios requeridos',
        message: 'Para revisar o generar certificados, primero debes importar tu lista de destinatarios en el Paso 3.',
      });
      return;
    }
    setCurrentStep(targetStep);
  };

  // Redirección y aviso si por alguna razón se llega a un paso sin sus requisitos
  useEffect(() => {
    if (currentStep >= 2 && !template) {
      setCurrentStep(1);
      setPrereqModal({
        title: 'Plantilla requerida',
        message: 'Para configurar la posición y estilo del texto, primero debes subir tu plantilla en el Paso 1.',
      });
    }
  }, [currentStep, template]);

  const handleTemplateChange = (newTemplate: TemplateData, defaultField?: Partial<FieldBox>) => {
    setTemplate(newTemplate);
    if (defaultField) {
      setField((prev) => ({ ...prev, ...defaultField }));
    } else {
      setField((prev) => (prev.maxFontSize > 28 || prev.width < 0.88 ? INITIAL_FIELD : prev));
    }
  };

  const handleDataLoaded = (data: ParsedTableData, newMapping: ColumnMapping) => {
    setTableData(data);
    setMapping(newMapping);
    syncRecipients(data, newMapping);
  };

  const handleMappingChange = (newMapping: ColumnMapping) => {
    setMapping(newMapping);
    if (tableData) {
      syncRecipients(tableData, newMapping);
    }
  };

  const syncRecipients = (data: ParsedTableData, currentMap: ColumnMapping) => {
    const raw = data.rows.map((row, idx) => {
      const existing = recipients[idx];
      return {
        id: existing?.id,
        name: row[currentMap.nameColumn] || '',
        email: currentMap.emailColumn ? row[currentMap.emailColumn] : undefined,
        extra: row,
        customField: existing?.customField,
      };
    });
    const validated = validateRecipients(raw, {
      field,
      templateWidthPt: template?.widthPt,
    });
    setRecipients(validated);
  };

  const handleUpdateRecipient = (updated: Recipient) => {
    setRecipients((prev) => {
      const updatedList = prev.map((r) => (r.id === updated.id ? updated : r));
      const raw = updatedList.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        extra: r.extra,
        customField: r.customField,
      }));
      const revalidated = validateRecipients(raw, {
        field,
        templateWidthPt: template?.widthPt,
      });
      return updatedList.map((r, i) => ({
        ...r,
        issues: revalidated[i]?.issues || [],
        customField: r.customField,
      }));
    });
  };

  // Mantener los destinatarios y sus advertencias siempre sincronizados con el marco y la tipografía actual
  useEffect(() => {
    if (tableData && recipients.length > 0) {
      const raw = recipients.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        extra: r.extra,
        customField: r.customField,
      }));
      const revalidated = validateRecipients(raw, {
        field,
        templateWidthPt: template?.widthPt,
      });
      setRecipients((prev) =>
        prev.map((r, i) => ({
          ...r,
          issues: revalidated[i]?.issues || [],
          customField: r.customField,
        }))
      );
    }
  }, [field, template?.widthPt]);

  const handleRemoveRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRemoveInvalid = () => {
    setRecipients((prev) =>
      prev.filter((r) => !r.issues.some((i) => i.severity === 'error'))
    );
  };

  const handleResetAll = async () => {
    await clearSession();
    setCurrentStep(1);
    setMaxStepUnlocked(1);
    setTemplate(null);
    setField(INITIAL_FIELD);
    setTableData(null);
    setRecipients([]);
  };

  return (
    <div className="flex-1 flex flex-col">
      <Stepper
        currentStep={currentStep}
        onStepClick={handleStepClick}
        maxStepUnlocked={maxStepUnlocked}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:px-6">
        {currentStep === 1 && (
          <TemplateStep
            template={template}
            onTemplateChange={handleTemplateChange}
            onRemoveTemplate={() => {
              setTemplate(null);
              setMaxStepUnlocked(1);
            }}
            onRequireTemplate={() => {
              setPrereqModal({
                title: 'Plantilla requerida',
                message: 'Para continuar al Paso 2, primero debes subir el diseño de tu certificado (PDF o imagen).',
              });
            }}
            onContinue={() => unlockStep(2)}
          />
        )}

        {currentStep === 2 && template && (
          <FieldEditorStep
            template={template}
            field={field}
            onFieldChange={setField}
            onBack={() => setCurrentStep(1)}
            onContinue={() => unlockStep(3)}
          />
        )}

        {currentStep === 3 && (
          <RecipientsStep
            tableData={tableData}
            mapping={mapping}
            onDataLoaded={handleDataLoaded}
            onMappingChange={handleMappingChange}
            onBack={() => setCurrentStep(2)}
            onContinue={() => {
              if (tableData) syncRecipients(tableData, mapping);
              unlockStep(4);
            }}
            onClearData={() => {
              setTableData(null);
              setRecipients([]);
            }}
          />
        )}

        {currentStep === 4 && template && (
          <ReviewStep
            recipients={recipients}
            template={template}
            field={field}
            onUpdateRecipient={handleUpdateRecipient}
            onRemoveRecipient={handleRemoveRecipient}
            onRemoveInvalid={handleRemoveInvalid}
            onBack={() => setCurrentStep(3)}
            onContinue={() => unlockStep(5)}
          />
        )}

        {currentStep === 5 && template && (
          <GenerationStep
            recipients={recipients}
            template={template}
            field={field}
            onBack={() => setCurrentStep(4)}
            onResetAll={handleResetAll}
          />
        )}
      </main>

      {/* Modal simple y compacto para requisitos previos */}
      <SimplePrerequisiteModal
        isOpen={prereqModal !== null}
        info={prereqModal}
        onClose={() => setPrereqModal(null)}
      />
    </div>
  );
};
