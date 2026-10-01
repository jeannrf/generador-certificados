import React, { useState } from 'react';
import { ColumnMapping } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Dropzone } from '../../ui/Dropzone';
import { parseCSV, parseTXT, parseExcel, detectColumns, ParsedTableData } from '../../infra/parsers';
import { triggerDownload } from '../../infra/zipExporter';
import { ChevronLeft, FileSpreadsheet, AlertCircle, CheckCircle2, FileText, Download } from 'lucide-react';

interface RecipientsStepProps {
  tableData: ParsedTableData | null;
  mapping: ColumnMapping;
  onDataLoaded: (data: ParsedTableData, mapping: ColumnMapping) => void;
  onMappingChange: (mapping: ColumnMapping) => void;
  onBack: () => void;
  onContinue: () => void;
}

export const RecipientsStep: React.FC<RecipientsStepProps> = ({
  tableData,
  mapping,
  onDataLoaded,
  onMappingChange,
  onBack,
  onContinue,
}) => {
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setError(null);
    try {
      let parsed: ParsedTableData;

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        parsed = await parseExcel(file);
      } else if (file.name.endsWith('.txt')) {
        const text = await file.text();
        parsed = parseTXT(text);
      } else {
        // CSV o fallback
        const text = await file.text();
        parsed = parseCSV(text);
      }

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError('El archivo parece estar vacío o no tiene un formato válido.');
        return;
      }

      const detected = detectColumns(parsed.headers);
      const newMapping: ColumnMapping = {
        nameColumn: detected.nameCol || parsed.headers[0],
        emailColumn: detected.emailCol,
      };

      onDataLoaded(parsed, newMapping);
    } catch (err) {
      setError(`Error al leer el archivo: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Carga la lista de destinatarios
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Sube un archivo con los nombres de las personas a quienes se emitirá el certificado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={() => {
              const csvContent =
                '\uFEFF' +
                'Nombre Completo,Correo Electrónico,DNI\n' +
                'Ana María Pérez Rodríguez,ana.perez@universidad.edu,72345678\n' +
                'José Luis de la Torre y Mendoza,jose.delatorre@correo.com,73456789\n' +
                'Carlos Alberto Mendoza Silva,carlos.mendoza@global.com,74567890\n';
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              triggerDownload(blob, 'Plantilla_Ejemplo_Destinatarios.csv');
            }}
            title="Descargar archivo CSV de ejemplo con columnas preparadas"
          >
            Formato de Ejemplo
          </Button>
          <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />} onClick={onBack}>
            Atrás
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!tableData || !mapping.nameColumn}
            onClick={onContinue}
          >
            Revisar Destinatarios
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Upload Column (Left - 33% / 4 cols) */}
        <div className="lg:col-span-4 flex flex-col h-full">
          <Card className="p-5 sm:p-6 flex flex-col justify-between h-full space-y-4">
            <div className="flex-1 flex flex-col">
              <Dropzone
                accept=".csv,.txt,.xlsx,.xls"
                acceptLabel="CSV, TXT o Excel"
                maxSizeMB={10}
                title="Arrastra tu lista aquí"
                description="Archivos .CSV, .TXT o Excel (.xlsx, .xls)"
                icon={<FileSpreadsheet className="w-7 h-7 stroke-[1.75]" />}
                onFileSelect={handleFileSelect}
                className="h-full flex-1"
              />

              {error && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Subtle Footnote about supported formats */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                CSV, TXT o Excel (Máx. 10 MB)
              </span>
              <span className="text-[10px] text-slate-400">100% privado</span>
            </div>
          </Card>
        </div>

        {/* Column Mapping & Data Preview (Right - 67% / 8 cols) */}
        <div className="lg:col-span-8 flex flex-col h-full">
          {tableData ? (
            <Card className="p-6 flex flex-col justify-between h-full space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-bold text-slate-900">
                      {tableData.rows.length} registros detectados
                    </span>
                  </div>
                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono">
                    {tableData.headers.length} columnas
                  </span>
                </div>

                {/* Mapping Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Columna de Nombres <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={mapping.nameColumn}
                      onChange={(e) => onMappingChange({ ...mapping, nameColumn: e.target.value })}
                      className="w-full text-xs font-semibold rounded-xl border border-brand-300 bg-brand-50/50 p-2.5 text-slate-900 focus:ring-2 focus:ring-brand-500 focus:bg-white"
                    >
                      {tableData.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Columna de Correo <span className="text-slate-400 font-normal">(Opcional)</span>
                    </label>
                    <select
                      value={mapping.emailColumn || ''}
                      onChange={(e) =>
                        onMappingChange({ ...mapping, emailColumn: e.target.value || undefined })
                      }
                      className="w-full text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800 focus:ring-2 focus:ring-brand-500 focus:bg-white"
                    >
                      <option value="">-- Ninguna --</option>
                      {tableData.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Data Preview Table */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Primeras filas del archivo:
                  </span>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-56">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left w-12">#</th>
                          {tableData.headers.map((h) => (
                            <th
                              key={h}
                              className={`px-3 py-2 text-left ${
                                h === mapping.nameColumn ? 'bg-brand-50 text-brand-700 font-bold' : ''
                              }`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {tableData.rows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="px-3 py-1.5 text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            {tableData.headers.map((h) => (
                              <td
                                key={h}
                                className={`px-3 py-1.5 truncate max-w-[160px] ${
                                  h === mapping.nameColumn ? 'font-medium text-slate-900 bg-brand-50/40' : 'text-slate-600'
                                }`}
                              >
                                {row[h] || '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Total cargado: {tableData.rows.length} filas</span>
                <span>Listo para la fase de revisión</span>
              </div>
            </Card>
          ) : (
            <Card className="p-8 h-full flex flex-col items-center justify-center text-center text-slate-400 border-dashed">
              <FileSpreadsheet className="w-12 h-12 mb-3 stroke-[1.25] text-slate-300" />
              <p className="text-sm font-medium text-slate-600">Aún no has cargado ningún archivo</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Sube tu archivo CSV o Excel en el panel de la izquierda para mapear columnas y ver la vista previa.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
