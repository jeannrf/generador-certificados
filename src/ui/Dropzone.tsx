import React, { useRef, useState } from 'react';
import { UploadCloud, File, AlertCircle } from 'lucide-react';

interface DropzoneProps {
  accept: string;
  acceptLabel?: string;
  maxSizeMB?: number;
  onFileSelect: (file: File) => void;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  accept,
  acceptLabel = 'PDF, PNG o JPG',
  maxSizeMB = 15,
  onFileSelect,
  title = 'Arrastra y suelta tu archivo aquí',
  description = 'o haz clic para explorar en tu equipo',
  icon,
  className = '',
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
        className={`relative group cursor-pointer border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all duration-200 flex-1 flex flex-col items-center justify-center ${
          isDragOver
            ? 'border-brand-500 bg-brand-50/50 scale-[0.99] ring-4 ring-brand-100'
            : 'border-slate-300 hover:border-brand-400 bg-slate-50/50 hover:bg-slate-50'
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
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-200 group-hover:scale-110 ${
            isDragOver
              ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30'
              : 'bg-white text-brand-600 shadow-card border border-slate-200'
          }`}
        >
          {icon || <UploadCloud className="w-8 h-8 stroke-[1.75]" />}
        </div>

        <h3 className="text-base font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>

        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-medium text-slate-600 shadow-sm">
          <File className="w-3.5 h-3.5 text-slate-400" />
          <span>Formatos: {acceptLabel} (Máx. {maxSizeMB} MB)</span>
        </div>
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
