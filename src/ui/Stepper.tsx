import React from 'react';
import { Check, FileText, Move, Users, CheckCircle, Download } from 'lucide-react';
import { WizardStep } from '../domain/types';

export interface StepDefinition<S extends number = number> {
  step: S;
  title: string;
  description: string;
  icon: React.ElementType;
}

interface StepperProps<S extends number = WizardStep> {
  currentStep: S;
  onStepClick?: (step: S) => void;
  maxStepUnlocked?: S;
  steps?: StepDefinition<S>[];
}

const CERTIFICATE_STEPS: StepDefinition<WizardStep>[] = [
  { step: 1 as WizardStep, title: 'Plantilla', description: 'Subir o elegir diseño', icon: FileText },
  { step: 2 as WizardStep, title: 'Campos', description: 'Ubicación y tipografía', icon: Move },
  { step: 3 as WizardStep, title: 'Participantes', description: 'CSV, Excel o texto', icon: Users },
  { step: 4 as WizardStep, title: 'Revisión', description: 'Validar y vista previa', icon: CheckCircle },
  { step: 5 as WizardStep, title: 'Generación', description: 'Descarga ZIP o PDF', icon: Download },
];

export const Stepper = <S extends number = WizardStep>({
  currentStep,
  onStepClick,
  steps = CERTIFICATE_STEPS as unknown as StepDefinition<S>[],
}: StepperProps<S>) => {
  const current = steps.find((s) => s.step === currentStep);
  const currentIndex = steps.findIndex((s) => s.step === currentStep);

  return (
    <div className="w-full bg-white/95 border-b border-slate-200 sticky top-0 z-30 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:px-6">
        <nav aria-label="Pasos">
          <ol className="flex items-center justify-between gap-2 md:gap-4">
            {steps.map((s, idx) => {
              const isCompleted = s.step < currentStep;
              const isCurrent = s.step === currentStep;
              const Icon = s.icon;

              return (
                <li key={s.step} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onStepClick?.(s.step)}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`Paso ${s.step}: ${s.title}${isCompleted ? ' (completado)' : ''}`}
                    className="group flex items-center gap-3 rounded-[6px] text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#208077] focus-visible:ring-offset-2"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] transition-colors ${
                        isCurrent
                          ? 'bg-[#208077] text-white'
                          : isCompleted
                          ? 'bg-[#E7F1EF] text-[#208077]'
                          : 'border border-slate-200 bg-white text-slate-400 group-hover:border-slate-300'
                      }`}
                      aria-hidden="true"
                    >
                      {isCompleted ? <Check className="h-4 w-4 stroke-[3]" /> : <Icon className="h-4 w-4" />}
                    </span>
                    <span className="hidden min-w-0 flex-col sm:flex" aria-hidden="true">
                      <span className="text-xs text-slate-500">Paso {s.step}</span>
                      <span
                        className={`truncate text-sm ${
                          isCurrent ? 'font-bold text-slate-900' : isCompleted ? 'font-medium text-slate-700' : 'text-slate-500'
                        }`}
                      >
                        {s.title}
                      </span>
                    </span>
                  </button>
                  {idx < steps.length - 1 && (
                    <span
                      className={`hidden h-px flex-1 lg:block ${s.step < currentStep ? 'bg-[#208077]' : 'bg-slate-200'}`}
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        {/* En móvil los nombres no entran junto a los íconos: se muestra solo el paso actual */}
        {current && (
          <p className="mt-2 text-sm sm:hidden">
            <span className="text-slate-500">
              Paso {currentIndex + 1} de {steps.length} ·{' '}
            </span>
            <span className="font-bold text-slate-900">{current.title}</span>
          </p>
        )}
      </div>
    </div>
  );
};
