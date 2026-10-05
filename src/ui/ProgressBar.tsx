import React from 'react';

interface ProgressBarProps {
  progress: number; // 0 a 100
  label?: string;
  sublabel?: string;
  showPercent?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  sublabel,
  showPercent = true,
}) => {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full space-y-2">
      {(label || showPercent) && (
        <div className="flex justify-between items-center text-sm">
          <div>
            {label && <span className="font-semibold text-slate-800">{label}</span>}
            {sublabel && <p className="text-xs text-slate-500 mt-0.5">{sublabel}</p>}
          </div>
          {showPercent && (
            <span className="font-mono font-medium text-[#208077] tabular-nums">
              {Math.round(clamped)}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progreso de la tarea'}
        className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 p-0.5"
      >
        <div
          className="h-full bg-[#208077] rounded-full transition-all duration-300 ease-out shadow-xs"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};
