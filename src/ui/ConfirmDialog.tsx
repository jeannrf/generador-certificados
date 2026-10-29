import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** danger: acción destructiva (borra datos); primary: acción importante pero no destructiva */
  tone?: 'primary' | 'danger';
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

/**
 * Confirmación dentro de la app para acciones irreversibles. Reemplaza a window.confirm:
 * muestra el detalle de lo que va a pasar y deja el foco en "Cancelar" para evitar confirmar sin leer.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  confirmLabel,
  cancelLabel = 'Cancelar',
  tone = 'primary',
  isConfirming = false,
  onConfirm,
  onCancel,
  children,
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isConfirming) {
        e.preventDefault();
        onCancel();
        return;
      }
      // Mantener el foco dentro del diálogo
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, isConfirming, onCancel]);

  if (!isOpen) return null;

  // En un portal: un ancestro animado (transform) limitaría el z-index y el encabezado quedaría encima
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0F2E2B]/40 p-4 sm:items-center" onClick={() => !isConfirming && onCancel()}>
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-[8px] bg-white p-6 shadow-[0_24px_48px_-24px_rgba(15,46,43,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-xl font-bold tracking-[-0.01em] text-[#0F2E2B]">
          {title}
        </h2>
        <div className="mt-4 text-sm text-[#0F2E2B]">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="outline" onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} isLoading={isConfirming}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
