import React from 'react';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { Button } from './Button';

interface StepActionsProps {
  onBack?: () => void;
  backLabel?: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  /** Por qué no se puede continuar; se muestra junto al botón cuando está deshabilitado */
  disabledReason?: string;
  isLoading?: boolean;
}

/**
 * Barra de acciones de cada paso: siempre fija abajo, "Atrás" a la izquierda y la acción principal a la derecha.
 * La página que la usa necesita espacio inferior (pb-28) para que la barra no tape el contenido.
 */
export const StepActions: React.FC<StepActionsProps> = ({
  onBack,
  backLabel = 'Atrás',
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  disabledReason,
  isLoading = false,
}) => (
  <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-sm">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
      {onBack ? (
        <Button variant="outline" leftIcon={<ChevronLeft className="h-4 w-4" />} onClick={onBack}>
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      <div className="flex min-w-0 items-center gap-3">
        {primaryDisabled && disabledReason && (
          <p className="hidden text-sm text-slate-500 sm:block" role="status">
            {disabledReason}
          </p>
        )}
        <Button
          onClick={onPrimary}
          disabled={primaryDisabled}
          isLoading={isLoading}
          rightIcon={<ArrowRight className="h-4 w-4" />}
          title={primaryDisabled ? disabledReason : undefined}
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
    {primaryDisabled && disabledReason && (
      <p className="px-4 pb-2 text-right text-xs text-slate-500 sm:hidden">{disabledReason}</p>
    )}
  </div>
);
