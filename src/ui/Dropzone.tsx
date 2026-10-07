import React, { useRef, useState } from 'react';
import { UploadCloud, File, AlertCircle } from 'lucide-react';

interface DropzoneProps {
  accept: string;
  acceptLabel?: string;
  suggestedSize?: string;
  maxSizeMB?: number;
  onFileSelect: (file: File) => void;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  compact?: boolean;
  hideBadge?: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  accept,
  acceptLabel = 'PDF, PNG o JPG',
  suggestedSize,
  maxSizeMB = 15,
  onFileSelect,
  title = 'Arrastra y suelta tu archivo aquí',
  description = 'o haz clic para explorar en tu equipo',
  icon,
  className = '',
  compact = false,
  hideBadge = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    setError(null);
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      setError(`El archivo supera el límite máximo permitido de ${maxSizeMB} MB.`);
      return;
    }

    onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className={`w-full flex flex-col ${className}`}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative group cursor-pointer border-2 border-dashed rounded-2xl ${
          compact ? 'p-5 sm:p-6' : 'p-8 sm:p-12'
        } text-center transition-all duration-200 flex-1 flex flex-col items-center justify-center ${
          isDragOver
            ? 'border-[#208077] bg-[#f0faf9] scale-[0.99] ring-4 ring-[#b2e5df]/50'
            : 'border-slate-300 hover:border-[#208077] bg-slate-50/50 hover:bg-slate-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div
          className={`${
            compact ? 'w-12 h-12 mb-3' : 'w-16 h-16 mb-4'
          } rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${
            isDragOver
              ? 'bg-[#208077] text-white shadow-md'
              : 'bg-white text-[#208077] shadow-sm border border-slate-200'
          }`}
        >
          {icon || <UploadCloud className={compact ? 'w-6 h-6 stroke-[1.75]' : 'w-8 h-8 stroke-[1.75]'} />}
        </div>

        <h3 className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-slate-900 group-hover:text-[#208077] transition-colors`}>
          {title}
        </h3>
        <p className={`${compact ? 'text-xs mt-0.5' : 'text-sm mt-1'} text-slate-500 max-w-sm`}>{description}</p>

        {!hideBadge && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 shadow-sm">
              <File className="w-3.5 h-3.5 text-slate-400" />
              <span>Formatos: {acceptLabel} (Máx. {maxSizeMB} MB)</span>
            </div>
            {suggestedSize && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#f0faf9] border border-[#b2e5df] rounded-full text-xs font-semibold text-[#208077] shadow-2xs">
                <span>{suggestedSize}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
