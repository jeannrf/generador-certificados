import React, { useState } from 'react';
import { Recipient, TemplateData, FieldBox } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { transformTextCase } from '../../domain/normalization';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  ChevronLeft,
  Eye,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface ReviewStepProps {
  recipients: Recipient[];
  template: TemplateData;
  field: FieldBox;
  onUpdateRecipient: (updated: Recipient) => void;
  onRemoveRecipient: (id: string) => void;
  onRemoveInvalid: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  recipients,
  template,
  field,
  onUpdateRecipient,
  onRemoveRecipient,
  onRemoveInvalid,
  onBack,
  onContinue,
}) => {
  const [filter, setFilter] = useState<'all' | 'valid' | 'issues'>('all');
  const [previewIndex, setPreviewIndex] = useState<number>(0);

  // Estadísticas
  const totalCount = recipients.length;
  const errorCount = recipients.filter((r) => r.issues.some((i) => i.severity === 'error')).length;
  const warningCount = recipients.filter(
    (r) =>
      r.issues.some((i) => i.severity === 'warning') &&
      !r.issues.some((i) => i.severity === 'error')
  ).length;
  const validCount = recipients.filter((r) => r.issues.length === 0).length;

  // Encontrar el nombre más largo
  const longestRecipientIndex = recipients.reduce((maxIdx, curr, idx, arr) => {
    return curr.name.length > (arr[maxIdx]?.name.length || 0) ? idx : maxIdx;
  }, 0);

  // Destinatario activo en la vista previa
  const currentPreviewRecipient = recipients[previewIndex] || recipients[0];

  const filteredRecipients = recipients.filter((r) => {
    if (filter === 'valid') return r.issues.length === 0;
    if (filter === 'issues') return r.issues.length > 0;
    return true;
  });

  const previewName = currentPreviewRecipient
    ? transformTextCase(currentPreviewRecipient.name, field.textCase)
    : '';

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Revisión y validación de datos
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Verifica los nombres antes de generar los PDFs y prueba cómo queda el nombre más largo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />} onClick={onBack}>
            Atrás
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={validCount + warningCount === 0}
            onClick={onContinue}
          >
            Continuar a Generación ({validCount + warningCount})
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setFilter('all')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-xs uppercase tracking-wider font-semibold opacity-80 block">
            Total Lista
          </span>
          <span className="text-2xl font-bold font-mono">{totalCount}</span>
        </div>

        <div
          onClick={() => setFilter('valid')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            filter === 'valid'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold opacity-80 block">
              Listos ✔
            </span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-2xl font-bold font-mono text-emerald-600">{validCount}</span>
        </div>

        <div
          onClick={() => setFilter('issues')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            filter === 'issues'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold opacity-80 block">
              Advertencias ⚠
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-bold font-mono text-amber-600">{warningCount}</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 block">
              Errores ✖
            </span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-rose-600">{errorCount}</span>
            {errorCount > 0 && (
              <button
                onClick={onRemoveInvalid}
                className="text-[11px] font-semibold text-rose-600 hover:underline hover:text-rose-700"
              >
                Descartar errores
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Recipients Table */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-700">Filtro actual:</span>
                <span className="text-xs font-semibold text-brand-600 uppercase">
                  {filter === 'all'
                    ? 'Todos los registros'
                    : filter === 'valid'
                    ? 'Solo válidos'
                    : 'Con advertencias / errores'}
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {filteredRecipients.length} de {totalCount}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[440px]">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left w-10">#</th>
                    <th className="px-3 py-2 text-left">Nombre del Destinatario</th>
                    <th className="px-3 py-2 text-left w-28">Estado</th>
                    <th className="px-3 py-2 text-center w-20">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRecipients.map((rec) => {
                    const hasError = rec.issues.some((i) => i.severity === 'error');
                    const hasWarning = rec.issues.some((i) => i.severity === 'warning');
                    const isSelectedInPreview = currentPreviewRecipient?.id === rec.id;

                    return (
                      <tr
                        key={rec.id}
                        onClick={() => {
                          const realIdx = recipients.findIndex((r) => r.id === rec.id);
                          if (realIdx !== -1) setPreviewIndex(realIdx);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelectedInPreview
                            ? 'bg-brand-50/70 hover:bg-brand-50'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="px-3 py-2 text-slate-400 font-mono text-[11px]">
                          {rec.rowNumber}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900">
                          <input
                            type="text"
                            value={rec.name}
                            onChange={(e) =>
                              onUpdateRecipient({ ...rec, name: e.target.value })
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-500 focus:outline-none py-0.5"
                          />
                          {rec.email && (
                            <span className="block text-[11px] text-slate-400 font-normal">
                              {rec.email}
                            </span>
                          )}
                          {rec.issues.length > 0 && (
                            <span className="block text-[10px] text-amber-600 mt-0.5">
                              {rec.issues.map((i) => i.message).join(' • ')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {hasError ? (
                            <Badge variant="error" size="sm">
                              Error
                            </Badge>
                          ) : hasWarning ? (
                            <Badge variant="warning" size="sm">
                              Aviso
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm">
                              Válido
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onRemoveRecipient(rec.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Eliminar fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Live Preview & Longest Name Test */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-brand-600" />
                Vista previa real del certificado
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPreviewIndex(0)}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all ${
                    previewIndex === 0
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Primero
                </button>
                <button
                  onClick={() => setPreviewIndex(longestRecipientIndex)}
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all ${
                    previewIndex === longestRecipientIndex
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Más largo 🔥
                </button>
              </div>
            </div>

            {/* Template with live stamped name */}
            <div
              className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 shadow-md"
              style={{ aspectRatio: `${template.widthPt} / ${template.heightPt}` }}
            >
              <img
                src={template.previewUrl}
                alt="Vista previa"
                className="w-full h-full object-contain"
              />

              {/* Dynamic Name Box */}
              <div
                style={{
                  left: `${field.x * 100}%`,
                  top: `${field.y * 100}%`,
                  width: `${field.width * 100}%`,
                  height: `${field.height * 100}%`,
                }}
                className="absolute flex items-center justify-center px-1 pointer-events-none"
              >
                <span
                  className="truncate leading-none select-none transition-all"
                  style={{
                    fontFamily: field.fontFamily,
                    fontWeight: field.isBold ? 700 : 400,
                    fontStyle: field.isItalic ? 'italic' : 'normal',
                    fontSize: `clamp(${field.minFontSize * 0.4}px, 2.2vw, ${field.maxFontSize * 0.55}px)`,
                    color: field.color,
                    textAlign: field.align,
                    width: '100%',
                  }}
                >
                  {previewName || '—'}
                </span>
              </div>
            </div>

            {/* Navigation controls */}
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600 border-t border-slate-100 pt-3">
              <button
                disabled={previewIndex === 0}
                onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Anterior
              </button>
              <span className="font-mono text-slate-500 font-medium">
                {previewIndex + 1} de {recipients.length}
              </span>
              <button
                disabled={previewIndex === recipients.length - 1}
                onClick={() => setPreviewIndex((prev) => Math.min(recipients.length - 1, prev + 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
              >
                Siguiente <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
