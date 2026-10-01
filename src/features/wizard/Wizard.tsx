import React, { useState } from 'react';
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

const INITIAL_FIELD: FieldBox = {
  id: 'field_name',
  name: 'Nombre del Destinatario',
  source: { type: 'column', column: 'nombre' },
  x: 0.15,
  y: 0.44,
  width: 0.7,
  height: 0.14,
  fontFamily: 'Playfair Display, Georgia, serif',
  maxFontSize: 44,
  minFontSize: 22,
  color: '#0f172a',
  align: 'center',
  vAlign: 'middle',
  textCase: 'title',
  isBold: false,
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

  const unlockStep = (step: WizardStepType) => {
    setCurrentStep(step);
    if (step > maxStepUnlocked) {
      setMaxStepUnlocked(step);
    }
  };

  const handleTemplateChange = (newTemplate: TemplateData, defaultField?: Partial<FieldBox>) => {
    setTemplate(newTemplate);
    if (defaultField) {
      setField((prev) => ({ ...prev, ...defaultField }));
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
    const raw = data.rows.map((row) => ({
      name: row[currentMap.nameColumn] || '',
      email: currentMap.emailColumn ? row[currentMap.emailColumn] : undefined,
      extra: row,
    }));
    const validated = validateRecipients(raw);
    setRecipients(validated);
  };

  const handleUpdateRecipient = (updated: Recipient) => {
    setRecipients((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
  };

  const handleRemoveRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRemoveInvalid = () => {
    setRecipients((prev) =>
      prev.filter((r) => !r.issues.some((i) => i.severity === 'error'))
    );
  };

  const handleResetAll = () => {
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
        onStepClick={(s) => setCurrentStep(s)}
        maxStepUnlocked={maxStepUnlocked}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:px-6">
        {currentStep === 1 && (
          <TemplateStep
            template={template}
            onTemplateChange={handleTemplateChange}
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
    </div>
  );
};
