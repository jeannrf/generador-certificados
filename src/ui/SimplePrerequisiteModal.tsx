import React from 'react';
import { AlertCircle, X } from 'lucide-react';

export interface PrerequisiteNoticeModalInfo {
  title: string;
  message: string;
}

interface SimplePrerequisiteModalProps {
  isOpen: boolean;
  info: PrerequisiteNoticeModalInfo | null;
  onClose: () => void;
}

export const SimplePrerequisiteModal: React.FC<SimplePrerequisiteModalProps> = ({
  isOpen,
  info,
  onClose,
}) => {
  if (!isOpen || !info) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200/90 max-w-sm w-full p-6 relative animate-scaleUp text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón único de cerrar (X) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center space-y-3 pt-1">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 border border-amber-200/70 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-900">{info.title}</h3>
            <p className="text-xs text-slate-600 leading-relaxed px-1">
              {info.message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
