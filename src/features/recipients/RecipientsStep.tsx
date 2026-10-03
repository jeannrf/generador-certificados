import React, { useState, useRef } from 'react';
import { ColumnMapping } from '../../domain/types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Dropzone } from '../../ui/Dropzone';
import { parseCSV, parseTXT, parseExcel, detectColumns, ParsedTableData } from '../../infra/parsers';
import { ChevronLeft, FileSpreadsheet, AlertCircle, CheckCircle2, Download, RefreshCw, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface RecipientsStepProps {
  tableData: ParsedTableData | null;
  mapping: ColumnMapping;
  onDataLoaded: (data: ParsedTableData, mapping: ColumnMapping) => void;
  onMappingChange: (mapping: ColumnMapping) => void;
  onBack: () => void;
  onContinue: () => void;
  onClearData: () => void;
}

export const RecipientsStep: React.FC<RecipientsStepProps> = ({
  tableData,
  mapping,
  onDataLoaded,
  onMappingChange,
  onBack,
  onContinue,
  onClearData,
}) => {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (file: File) => {
    setError(null);
    try {
      let parsed: ParsedTableData;

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        parsed = await parseExcel(file);
      } else if (file.name.endsWith('.csv')) {
        const text = await file.text();
        parsed = parseCSV(text);
      } else if (file.name.endsWith('.txt')) {
        const text = await file.text();
        parsed = parseTXT(text);
      } else {
        setError('Por favor sube un archivo Excel (.xlsx, .xls) o CSV.');
        return;
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
            Sube tu archivo de Excel con los nombres de las personas a quienes se emitirá el certificado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-4 h-4 text-emerald-600" />}
            onClick={() => {
              const data = [
                { 'Nombre Completo': 'Ana María Pérez Rodríguez', 'Correo Electrónico': 'ana.perez@universidad.edu', 'DNI': '72345678' },
                { 'Nombre Completo': 'José Luis de la Torre y Mendoza', 'Correo Electrónico': 'jose.delatorre@correo.com', 'DNI': '73456789' },
                { 'Nombre Completo': 'Carlos Alberto Mendoza Silva', 'Correo Electrónico': 'carlos.mendoza@global.com', 'DNI': '74567890' },
              ];
              const ws = XLSX.utils.json_to_sheet(data);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'Destinatarios');
              XLSX.writeFile(wb, 'Plantilla_Ejemplo_Destinatarios.xlsx');
            }}
            title="Descargar archivo Excel (.xlsx) de ejemplo con columnas preparadas"
          >
            Descargar Plantilla Excel
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
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <Card className="p-4 sm:p-5 flex flex-col space-y-3">
            <Dropzone
              accept=".xlsx,.xls,.csv"
              acceptLabel="Excel o CSV"
              maxSizeMB={10}
              title="Arrastra tu archivo Excel aquí"
              description="o haz clic para explorar en tu equipo"
              icon={<FileSpreadsheet className="w-6 h-6 stroke-[1.75]" />}
              onFileSelect={handleFileSelect}
              compact
              hideBadge
            />

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </Card>

          {/* Tarjeta de requisitos de formato del archivo */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Formato admitido del Excel</span>
            </div>
            <p className="text-[12px] text-slate-600 leading-relaxed">
              Para que el sistema funcione correctamente, tu archivo debe incluir al menos:
            </p>
            <div className="space-y-2 pt-1 text-[11px] text-slate-600">
              <div className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-brand-500 mt-1 shrink-0" />
                <div>
                  <strong className="text-slate-900 block text-xs">Columna de Nombres</strong>
                  <span className="text-slate-500">Obligatoria para personalizar el texto en cada certificado.</span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1 shrink-0" />
                <div>
                  <strong className="text-slate-900 block text-xs">Columna de Correos</strong>
                  <span className="text-slate-500">Necesaria si vas a enviar los certificados por correo electrónico.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column Mapping & Data Preview (Right - 67% / 8 cols) */}
        <div className="lg:col-span-8 flex flex-col h-full">
          {tableData ? (
            <Card className="p-6 flex flex-col justify-between h-full space-y-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-sm font-bold text-slate-900">
                      {tableData.rows.length} registros detectados
                    </span>
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono">
                      {tableData.headers.length} {tableData.headers.length === 1 ? 'columna' : 'columnas'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                      title="Seleccionar otro archivo Excel o CSV"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Cambiar documento</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClearData}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                      title="Quitar este documento y limpiar los registros"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  </div>
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
