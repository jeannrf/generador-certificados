import React, { useState, useRef, useMemo } from 'react';
import { ColumnMapping, FieldBox } from '../../domain/types';
import { columnFields, isQrField, unassignedColumnFields } from '../../domain/fields';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Dropzone } from '../../ui/Dropzone';
import { parseCSV, parseTXT, parseExcel, detectColumns, ParsedTableData } from '../../infra/parsers';
import { ChevronLeft, FileSpreadsheet, AlertCircle, AlertTriangle, CheckCircle2, RefreshCw, Trash2, QrCode } from 'lucide-react';

interface RecipientsStepProps {
  tableData: ParsedTableData | null;
  mapping: ColumnMapping;
  onDataLoaded: (data: ParsedTableData, mapping: ColumnMapping) => void;
  onMappingChange: (mapping: ColumnMapping) => void;
  onBack?: () => void;
  onContinue: () => void;
  onClearData: () => void;
  /** 'mail': el correo es obligatorio y el nombre opcional (envío de correos sin certificado) */
  variant?: 'certificates' | 'mail';
  /** Campos del certificado: los que usan una columna se asignan aquí, ya con la lista cargada */
  fields?: FieldBox[];
  onFieldsChange?: (fields: FieldBox[]) => void;
}

export const RecipientsStep: React.FC<RecipientsStepProps> = ({
  tableData,
  mapping,
  onDataLoaded,
  onMappingChange,
  onBack,
  onContinue,
  onClearData,
  variant = 'certificates',
  fields = [],
  onFieldsChange,
}) => {
  const isMail = variant === 'mail';
  // Columna principal que se resalta en la vista previa
  const keyColumn = isMail ? mapping.emailColumn : mapping.nameColumn;
  const [error, setError] = useState<string | null>(null);
  const fieldsWithColumn = columnFields(fields);
  const missingColumns = tableData ? unassignedColumnFields(fields, tableData.headers) : [];
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

      const detected = detectColumns(parsed.headers, parsed.rows);
      const fallbackName = detected.nameCol || parsed.headers[0];
      const newMapping: ColumnMapping = {
        // En modo correos el nombre es opcional: no reutilizar la columna de correo como nombre
        nameColumn: isMail && fallbackName === detected.emailCol ? '' : fallbackName,
        emailColumn: detected.emailCol,
      };

      onDataLoaded(parsed, newMapping);
    } catch (err) {
      setError(`Error al leer el archivo: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Validación de advertencia si la columna seleccionada como correo no parece contener correos
  const emailWarning = useMemo(() => {
    if (!tableData || !mapping.emailColumn) return null;

    const col = mapping.emailColumn;
    const values = tableData.rows
      .map((r) => r[col]?.trim())
      .filter((v): v is string => Boolean(v));

    if (values.length === 0) {
      return `La columna "${col}" no tiene datos en ningún registro.`;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = values.filter((v) => emailRegex.test(v));
    const validRatio = validEmails.length / values.length;

    // Si menos del 40% de los registros tienen formato de correo
    if (validRatio < 0.4) {
      const sampleValue = values[0];
      return `Los registros de esta columna no tienen formato de correo electrónico${sampleValue ? ` (ej. "${sampleValue}")` : ''}. Es probable que no sea la columna correcta.`;
    }

    return null;
  }, [tableData, mapping.emailColumn]);

  // Validación si la columna seleccionada como nombre parece contener correos
  const nameWarning = useMemo(() => {
    if (!tableData || !mapping.nameColumn) return null;

    const col = mapping.nameColumn;
    const values = tableData.rows
      .map((r) => r[col]?.trim())
      .filter((v): v is string => Boolean(v));

    if (values.length === 0) return null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailMatches = values.filter((v) => emailRegex.test(v)).length;
    if (emailMatches / values.length >= 0.5) {
      return `Esta columna parece contener correos electrónicos en lugar de nombres de personas.`;
    }

    return null;
  }, [tableData, mapping.nameColumn]);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {isMail ? 'Carga tu base de contactos' : 'Carga la lista de destinatarios'}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {isMail
              ? 'Sube tu archivo Excel o CSV con los correos de las personas a quienes quieres escribir.'
              : 'Sube tu archivo de Excel con los nombres de las personas a quienes se emitirá el certificado.'}
          </p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
          {onBack && (
            <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />} onClick={onBack}>
              Atrás
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            disabled={!tableData || !(isMail ? mapping.emailColumn : mapping.nameColumn) || missingColumns.length > 0}
            onClick={onContinue}
            className="flex-1 sm:flex-none justify-center"
          >
            {isMail ? 'Continuar a Redactar' : 'Revisar Destinatarios'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Upload Column (Left - 33% / 4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-full">
          <Card className="p-4 sm:p-5 flex-1 flex flex-col justify-center">
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
              className="flex-1 h-full"
            />

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 mt-3 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </Card>

          {/* Tarjeta de requisitos de formato del archivo */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 text-xs shrink-0">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Formato admitido del Excel</span>
            </div>
            <p className="text-[12px] text-slate-600 leading-relaxed">
              Para que el sistema funcione correctamente, tu archivo debe incluir al menos:
            </p>
            <div className="space-y-2 pt-1 text-[11px] text-slate-600">
              <div className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#208077] mt-1 shrink-0" />
                <div>
                  <strong className="text-slate-900 block text-xs">Columna de Nombres</strong>
                  <span className="text-slate-500">
                    {isMail
                      ? 'Opcional. Te permite saludar a cada persona por su nombre con {nombre}.'
                      : 'Obligatoria para personalizar el texto en cada certificado.'}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2.5 bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-[#208077] mt-1 shrink-0" />
                <div>
                  <strong className="text-slate-900 block text-xs">Columna de Correos</strong>
                  <span className="text-slate-500">
                    {isMail
                      ? 'Obligatoria. Es la dirección a la que llegará cada correo.'
                      : 'Necesaria si vas a enviar los certificados por correo electrónico.'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column Mapping & Data Preview (Right - 67% / 8 cols) */}
        <div className="lg:col-span-8 flex flex-col h-full">
          {tableData ? (
            <Card className="p-6 flex flex-col justify-between h-full space-y-5">
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 shrink-0">
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
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#208077] bg-[#f0faf9] hover:bg-[#b2e5df]/40 border border-[#b2e5df] rounded-lg transition-colors shadow-2xs cursor-pointer"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 shrink-0">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Columna de Nombres{' '}
                      {isMail ? (
                        <span className="text-slate-400 font-normal">(Opcional)</span>
                      ) : (
                        <span className="text-rose-500">*</span>
                      )}
                    </label>
                    <select
                      value={mapping.nameColumn}
                      onChange={(e) => onMappingChange({ ...mapping, nameColumn: e.target.value })}
                      className={`w-full text-xs font-semibold rounded-xl border p-2.5 focus:ring-2 focus:ring-[#208077] focus:bg-white transition-colors ${
                        nameWarning
                          ? 'border-amber-400 bg-amber-50/50 text-slate-900'
                          : 'border-[#b2e5df] bg-[#f0faf9] text-slate-900'
                      }`}
                    >
                      {isMail && <option value="">-- Ninguna --</option>}
                      {tableData.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>

                    {nameWarning && (
                      <div className="p-2 bg-amber-50 border border-amber-200/90 rounded-lg text-amber-800 text-[11px] flex items-start gap-1.5 mt-1 animate-fadeIn">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="leading-snug">{nameWarning}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Columna de Correo {isMail && <span className="text-rose-500">*</span>}
                    </label>
                    <select
                      value={mapping.emailColumn || ''}
                      onChange={(e) =>
                        onMappingChange({ ...mapping, emailColumn: e.target.value || undefined })
                      }
                      className={`w-full text-xs font-medium rounded-xl border p-2.5 focus:ring-2 focus:ring-[#208077] focus:bg-white transition-colors ${
                        emailWarning
                          ? 'border-amber-400 bg-amber-50/50 text-slate-800'
                          : 'border-slate-200 bg-slate-50 text-slate-800'
                      }`}
                    >
                      <option value="">{isMail ? '-- Selecciona una columna --' : '-- Ninguna --'}</option>
                      {tableData.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>

                    {emailWarning && (
                      <div className="p-2 bg-amber-50 border border-amber-200/90 rounded-lg text-amber-800 text-[11px] flex items-start gap-1.5 mt-1 animate-fadeIn">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="leading-snug">{emailWarning}</p>
                      </div>
                    )}
                  </div>
                
                  {/* Columnas de los campos del certificado (curso, fecha, QR…), en la misma grilla */}
                  {onFieldsChange &&
                    fieldsWithColumn.map((f) => {
                      const column = f.source.type === 'column' ? f.source.column : '';
                      const isMissing = !tableData.headers.includes(column);
                      return (
                        <div key={f.id} className="space-y-1.5">
                          <label htmlFor={`col-${f.id}`} className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            {isQrField(f) && <QrCode className="w-3.5 h-3.5 text-slate-500" aria-hidden />}
                            {f.name} <span className="text-rose-500">*</span>
                          </label>
                          <select
                            id={`col-${f.id}`}
                            value={isMissing ? '' : column}
                            onChange={(e) =>
                              onFieldsChange(
                                fields.map((x) =>
                                  x.id === f.id ? { ...x, source: { type: 'column', column: e.target.value } } : x
                                )
                              )
                            }
                            aria-label={`Columna para ${f.name}`}
                            className={`w-full text-xs font-medium rounded-xl border p-2.5 focus:ring-2 focus:ring-[#208077] focus:bg-white transition-colors ${
                              isMissing ? 'border-amber-400 bg-amber-50/50 text-slate-800' : 'border-slate-200 bg-slate-50 text-slate-800'
                            }`}
                          >
                            <option value="">-- Elige una columna --</option>
                            {tableData.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                </div>

                {missingColumns.length > 0 && onFieldsChange && (
                  <p role="alert" className="-mt-2 text-[11px] text-amber-700 shrink-0">
                    Elige la columna de {missingColumns.map((f) => `"${f.name}"`).join(', ')} para continuar.
                  </p>
                )}

                {/* Data Preview Table */}
                <div className="space-y-2 flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                    <span>Vista previa del archivo ({tableData.rows.length} filas):</span>
                    <span className="text-[11px] font-normal normal-case text-slate-400">
                      Desplaza para revisar todos los registros
                    </span>
                  </div>
                  <div className="overflow-auto rounded-xl border border-slate-200 flex-1 min-h-[220px] max-h-72 sm:max-h-80 shadow-xs">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10 shadow-xs">
                        <tr>
                          <th className="px-3 py-2 text-left w-12 bg-slate-50">#</th>
                          {tableData.headers.map((h) => (
                            <th
                              key={h}
                              className={`px-3 py-2 text-left bg-slate-50 ${
                                h === keyColumn ? 'text-[#208077] font-bold' : ''
                              }`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {tableData.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3 py-1.5 text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            {tableData.headers.map((h) => (
                              <td
                                key={h}
                                className={`px-3 py-1.5 truncate max-w-[180px] ${
                                  h === keyColumn ? 'font-medium text-slate-900 bg-[#f0faf9]/80' : 'text-slate-600'
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
