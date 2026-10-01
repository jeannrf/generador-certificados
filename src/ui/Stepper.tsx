import React from 'react';
import { Check, FileText, Move, Users, CheckCircle, Download } from 'lucide-react';
import { WizardStep } from '../domain/types';

interface StepperProps {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
  maxStepUnlocked?: WizardStep;
}

const STEPS = [
  { step: 1 as WizardStep, title: 'Plantilla', description: 'Subir o elegir diseño', icon: FileText },
  { step: 2 as WizardStep, title: 'Posición y Estilo', description: 'Ubicación y tipografía', icon: Move },
  { step: 3 as WizardStep, title: 'Destinatarios', description: 'CSV, Excel o texto', icon: Users },
  { step: 4 as WizardStep, title: 'Revisión', description: 'Validar y vista previa', icon: CheckCircle },
  { step: 5 as WizardStep, title: 'Generación', description: 'Descargar ZIP', icon: Download },
];

export const Stepper: React.FC<StepperProps> = ({
  currentStep,
  onStepClick,
  maxStepUnlocked = 1,
}) => {
  return (
    <div className="w-full bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-subtle backdrop-blur-md bg-white/90">
      <div className="max-w-6xl mx-auto px-4 py-3 sm:px-6">
        <nav aria-label="Progress">
          <ol className="flex items-center justify-between gap-2 md:gap-4">
            {STEPS.map((s, idx) => {
              const isCompleted = s.step < currentStep;
              const isCurrent = s.step === currentStep;
              const isClickable = s.step <= maxStepUnlocked && onStepClick;
              const Icon = s.icon;

              return (
                <li key={s.step} className="flex-1 relative">
                  <div
                    onClick={() => isClickable && onStepClick(s.step)}
                    className={`group flex items-center gap-3 transition-all duration-200 ${
                      isClickable ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    {/* Circle Icon Indicator */}
                    <div
                      className={`relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl transition-all duration-300 font-semibold text-xs sm:text-sm shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-500 text-white shadow-emerald-500/20 shadow-md'
                          : isCurrent
                          ? 'bg-brand-600 text-white shadow-brand-500/30 shadow-lg ring-4 ring-brand-100 scale-105'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>

                    {/* Step Name (Hidden on very small screens) */}
                    <div className="hidden sm:flex flex-col text-left min-w-0">
                      <span
                        className={`text-xs font-semibold tracking-wide uppercase ${
                          isCurrent
                            ? 'text-brand-600'
                            : isCompleted
                            ? 'text-emerald-700'
                            : 'text-slate-400'
                        }`}
                      >
                        Paso {s.step}
                      </span>
                      <span
                        className={`text-sm font-medium truncate ${
                          isCurrent
                            ? 'text-slate-900 font-bold'
                            : isCompleted
                            ? 'text-slate-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {s.title}
                      </span>
                    </div>

                    {/* Connector line */}
                    {idx < STEPS.length - 1 && (
                      <div
                        className={`hidden lg:block flex-1 h-0.5 ml-2 transition-colors duration-300 ${
                          s.step < currentStep ? 'bg-emerald-400' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
};
