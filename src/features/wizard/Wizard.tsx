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
import {
  autoAssignColumns,
  buildValidationOptions,
  defaultMinFontSize,
  defaultNameFontSize,
  isNameField,
  reconcileFieldsWithTemplate,
} from '../../domain/fields';
import { saveSession, loadSession, clearSession } from '../../infra/storage';
import {
  SimplePrerequisiteModal,
  PrerequisiteNoticeModalInfo,
} from '../../ui/SimplePrerequisiteModal';

export const Wizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<WizardStepType>(1);
  const [maxStepUnlocked, setMaxStepUnlocked] = useState<WizardStepType>(1);

  // Estados del Wizard
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [fields, setFields] = useState<FieldBox[]>([]);
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
      // loadSession ya migró las sesiones de una sola página al formato multipágina
      const tpl = saved.template;
      if (tpl) {
        // Ignorar plantillas demo antiguas que hayan quedado guardadas en el navegador
        if (tpl.id?.startsWith('tpl_demo_') || tpl.name?.includes('Diploma de Reconocimiento')) {
          setTemplate(null);
        } else {
          // Los Object URL de las imágenes no sobreviven a una recarga: regenerarlos desde los bytes
          const pages = tpl.pages.map((page) => {
            if (page.kind !== 'image' || !page.bytes || page.bytes.length === 0) return page;
            try {
              return {
                ...page,
                previewUrl: URL.createObjectURL(
                  new Blob([page.bytes as unknown as BlobPart], { type: page.mimeType || 'image/png' })
                ),
              };
            } catch (err) {
              console.warn('No se pudo regenerar ObjectURL para la página de imagen:', err);
              return page;
            }
          });
          const restored = { ...tpl, pages };
          setTemplate(restored);
          setFields(reconcileFieldsWithTemplate(saved.fields, restored));
          hasValidTemplate = true;
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
        fields,
        tableData,
        mapping,
        recipients,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [currentStep, maxStepUnlocked, template, fields, tableData, mapping, recipients]);

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
        title: 'Lista requerida',
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

  const handleTemplateChange = (newTemplate: TemplateData) => {
    const isNewTemplate = template?.id !== newTemplate.id;
    setTemplate(newTemplate);
    setFields((prev) => {
      const reconciled = reconcileFieldsWithTemplate(prev, newTemplate);
      if (!isNewTemplate) return reconciled;
      // Plantilla nueva: el tamaño del nombre se adapta al de la página
      const fontSize = defaultNameFontSize(newTemplate.pages[0]);
      return reconciled.map((f) =>
        isNameField(f) ? { ...f, maxFontSize: fontSize, minFontSize: defaultMinFontSize(fontSize) } : f
      );
    });
  };

  const handleDataLoaded = (data: ParsedTableData, newMapping: ColumnMapping) => {
    setTableData(data);
    // Los campos de columna creados antes de tener la lista se asignan solos si coincide el nombre
    setFields((prev) => autoAssignColumns(prev, data.headers));
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
    const validated = validateRecipients(raw, buildValidationOptions(template, fields));
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
      const revalidated = validateRecipients(raw, buildValidationOptions(template, fields));
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
      const revalidated = validateRecipients(raw, buildValidationOptions(template, fields));
      setRecipients((prev) =>
        prev.map((r, i) => ({
          ...r,
          issues: revalidated[i]?.issues || [],
          customField: r.customField,
        }))
      );
    }
  }, [fields, template]);

  // Al volver al Paso 3 con la lista ya cargada, asignar las columnas de campos agregados después
  useEffect(() => {
    if (currentStep === 3 && tableData) setFields((prev) => autoAssignColumns(prev, tableData.headers));
  }, [currentStep, tableData]);

  const handleRemoveRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRemoveRecipients = (ids: string[]) => {
    const toRemove = new Set(ids);
    setRecipients((prev) => prev.filter((r) => !toRemove.has(r.id)));
  };

  const handleResetAll = async () => {
    await clearSession();
    setCurrentStep(1);
    setMaxStepUnlocked(1);
    setTemplate(null);
    setFields([]);
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

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-8 pb-28 sm:px-6">
        {currentStep === 1 && (
          <TemplateStep
            template={template}
            fields={fields}
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
            fields={fields}
            onFieldsChange={setFields}
            availableColumns={tableData?.headers ?? []}
            sampleRow={tableData?.rows[0]}
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
            fields={fields}
            onFieldsChange={setFields}
          />
        )}

        {currentStep === 4 && template && (
          <ReviewStep
            recipients={recipients}
            template={template}
            fields={fields}
            onUpdateRecipient={handleUpdateRecipient}
            onRemoveRecipient={handleRemoveRecipient}
            onRemoveRecipients={handleRemoveRecipients}
            onBack={() => setCurrentStep(3)}
            onContinue={() => unlockStep(5)}
          />
        )}

        {currentStep === 5 && template && (
          <GenerationStep
            recipients={recipients}
            template={template}
            fields={fields}
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
