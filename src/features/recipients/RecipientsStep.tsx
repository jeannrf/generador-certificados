import React, { useState, useRef, useMemo } from 'react';
import { ColumnMapping, FieldBox } from '../../domain/types';
import { columnFields, isQrField, unassignedColumnFields } from '../../domain/fields';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { StepActions } from '../../ui/StepActions';
import { Dropzone } from '../../ui/Dropzone';
import { parseCSV, parseTXT, parseExcel, detectColumns, ParsedTableData } from '../../infra/parsers';
import { triggerDownload } from '../../infra/zipExporter';
import { FileSpreadsheet, AlertCircle, AlertTriangle, RefreshCw, Trash2, QrCode, Download } from 'lucide-react';

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
  // Primer motivo por el que todavía no se puede continuar (se muestra junto al botón)
  const continueBlocker = !tableData
    ? 'Sube tu lista de participantes'
    : !keyColumn
    ? isMail
      ? 'Elige la columna de correos'
      : 'Elige la columna de nombres'
    : missingColumns.length > 0
    ? `Elige la columna para «${missingColumns[0].name}»`
    : undefined;
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

  const handleDownloadSample = () => {
    const sample = isMail
      ? 'nombre,correo\nAna María Pérez,ana.perez@example.com\nLuis Fernando Quispe,luis.quispe@example.com\n'
      : 'nombre,correo\nAna María Pérez Rodríguez,ana.perez@example.com\nLuis Fernando Quispe,luis.quispe@example.com\n';
    // BOM para que Excel abra las tildes correctamente
    triggerDownload(new Blob(['﻿' + sample], { type: 'text/csv;charset=utf-8' }), 'ejemplo-lista.csv');
  };

  const selectClass = (warn: boolean) =>
    `w-full rounded-[6px] border bg-white px-3 py-2 text-sm text-[#0F2E2B] focus:border-[#208077] focus:outline-none focus:ring-2 focus:ring-[#208077]/20 ${
      warn ? 'border-amber-400' : 'border-slate-300'
    }`;

  const columnHint = (text: string) => <span className="ml-1 font-normal text-slate-500">{text}</span>;

  const fieldWarning = (message: string) => (
    <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-amber-700">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {isMail ? 'Carga tus contactos' : 'Carga la lista de participantes'}
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          {isMail
            ? 'Un Excel o CSV con una columna de correos. Si tiene nombres, podrás saludar a cada persona.'
            : 'Un Excel o CSV con una columna de nombres. Si tiene correos, podrás enviar los certificados.'}
        </p>
      </div>

      <StepActions
        onBack={onBack}
        primaryLabel="Continuar"
        onPrimary={onContinue}
        primaryDisabled={!!continueBlocker}
        disabledReason={continueBlocker}
      />

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-[6px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!tableData ? (
        <Card className="p-4 sm:p-6">
          <Dropzone
            accept=".xlsx,.xls,.csv"
            acceptLabel="Excel o CSV"
            maxSizeMB={10}
            title="Arrastra tu Excel o CSV aquí"
            description="o haz clic para elegirlo"
            icon={<FileSpreadsheet className="w-6 h-6 stroke-[1.75]" />}
            onFileSelect={handleFileSelect}
            hideBadge
            className="min-h-[220px]"
          />
          <p className="mt-4 text-sm text-slate-600">
            La primera fila debe tener los títulos de las columnas.{' '}
            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex items-center gap-1 font-semibold text-[#208077] underline underline-offset-2 hover:text-[#18655E]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Descargar ejemplo
            </button>
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
            <p className="text-sm text-slate-700">
              <span className="font-bold tabular-nums text-[#0F2E2B]">{tableData.rows.length}</span>{' '}
              {tableData.rows.length === 1 ? 'persona en la lista' : 'personas en la lista'}
              <span className="text-slate-500">
                {' · '}
                {tableData.headers.length} {tableData.headers.length === 1 ? 'columna' : 'columnas'}
              </span>
            </p>
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
              <Button variant="outline" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => fileInputRef.current?.click()}>
                Cambiar archivo
              </Button>
              <Button variant="ghost" size="sm" leftIcon={<Trash2 className="h-4 w-4" />} onClick={onClearData}>
                Quitar
              </Button>
            </div>
          </div>

          {/* Qué columna alimenta cada dato del certificado */}
          <fieldset className="px-4 py-4 sm:px-5">
            <legend className="sr-only">Columnas</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="col-name" className="mb-1.5 block text-sm font-semibold text-[#0F2E2B]">
                  Nombres{isMail ? columnHint('opcional') : null}
                </label>
                <select
                  id="col-name"
                  value={mapping.nameColumn}
                  onChange={(e) => onMappingChange({ ...mapping, nameColumn: e.target.value })}
                  className={selectClass(Boolean(nameWarning))}
                >
                  {isMail && <option value="">Ninguna</option>}
                  {tableData.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                {nameWarning && fieldWarning(nameWarning)}
              </div>

              <div>
                <label htmlFor="col-email" className="mb-1.5 block text-sm font-semibold text-[#0F2E2B]">
                  Correos{isMail ? null : columnHint('opcional')}
                </label>
                <select
                  id="col-email"
                  value={mapping.emailColumn || ''}
                  onChange={(e) => onMappingChange({ ...mapping, emailColumn: e.target.value || undefined })}
                  className={selectClass(Boolean(emailWarning))}
                >
                  <option value="">{isMail ? 'Elige una columna' : 'Ninguna'}</option>
                  {tableData.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                {emailWarning && fieldWarning(emailWarning)}
              </div>

              {/* Columnas de los campos del certificado (curso, fecha, QR…), en la misma grilla */}
              {onFieldsChange &&
                fieldsWithColumn.map((f) => {
                  const column = f.source.type === 'column' ? f.source.column : '';
                  const isMissing = !tableData.headers.includes(column);
                  return (
                    <div key={f.id}>
                      <label htmlFor={`col-${f.id}`} className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-[#0F2E2B]">
                        {isQrField(f) && <QrCode className="h-4 w-4 text-slate-500" aria-hidden />}
                        {f.name}
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
                        className={selectClass(isMissing)}
                      >
                        <option value="">Elige una columna</option>
                        {tableData.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                      {isMissing && fieldWarning('Falta elegir la columna.')}
                    </div>
                  );
                })}
            </div>
          </fieldset>

          <div className="max-h-80 overflow-auto border-t border-slate-200">
            <table className="w-full text-sm">
              <caption className="sr-only">Contenido del archivo cargado</caption>
              <thead className="sticky top-0 z-10 bg-[#E7F1EF] text-left text-xs font-semibold uppercase tracking-[0.08em] [font-stretch:80%] text-[#0F2E2B]">
                <tr>
                  <th scope="col" className="w-12 px-4 py-2 font-semibold">Fila</th>
                  {tableData.headers.map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className={`whitespace-nowrap px-4 py-2 font-semibold ${h === keyColumn ? 'text-[#208077]' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0F2E2B]/[0.08]">
                {tableData.rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 tabular-nums text-slate-500">{idx + 1}</td>
                    {tableData.headers.map((h) => (
                      <td
                        key={h}
                        className={`max-w-[220px] truncate px-4 py-2 ${
                          h === keyColumn ? 'bg-[#F4F8F7] font-medium text-[#0F2E2B]' : 'text-slate-600'
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
        </Card>
      )}
    </div>
  );
};
