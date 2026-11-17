import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { detectColumns, parseCSV, parseExcel, parseTXT } from '../src/infra/parsers';

/** Arma un .xlsx en memoria con las hojas indicadas. */
function excelFile(sheets: Record<string, XLSX.WorkSheet>): File {
  const workbook = XLSX.utils.book_new();
  for (const [name, sheet] of Object.entries(sheets)) XLSX.utils.book_append_sheet(workbook, sheet, name);
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([bytes], 'lista.xlsx');
}

const sheet = (rows: unknown[][]) => XLSX.utils.aoa_to_sheet(rows);

describe('parseCSV', () => {
  it('lee comas, tildes y ñ', () => {
    const { headers, rows } = parseCSV('Nombre,Correo\nÍñigo Peña Núñez,inigo@uni.pe\n');
    expect(headers).toEqual(['Nombre', 'Correo']);
    expect(rows).toEqual([{ Nombre: 'Íñigo Peña Núñez', Correo: 'inigo@uni.pe' }]);
  });

  it('detecta punto y coma y tabulador como separador', () => {
    expect(parseCSV('Nombre;Correo\nAna;a@uni.pe').rows).toEqual([{ Nombre: 'Ana', Correo: 'a@uni.pe' }]);
    expect(parseCSV('Nombre\tCorreo\nAna\ta@uni.pe').rows).toEqual([{ Nombre: 'Ana', Correo: 'a@uni.pe' }]);
  });

  it('ignora el BOM que agrega Excel al exportar', () => {
    expect(parseCSV('﻿Nombre;Correo\nAna;a@uni.pe').headers).toEqual(['Nombre', 'Correo']);
  });

  it('respeta separadores, comillas y saltos de línea dentro de un campo entre comillas', () => {
    const { rows } = parseCSV('Nombre,Nota\n"Pérez, Ana ""la profe""","línea 1\nlínea 2"\n');
    expect(rows).toEqual([{ Nombre: 'Pérez, Ana "la profe"', Nota: 'línea 1\nlínea 2' }]);
  });

  it('acepta saltos de línea de Windows y descarta filas vacías o solo con espacios', () => {
    const { rows } = parseCSV('Nombre,Correo\r\nAna,a@uni.pe\r\n\r\n , \r\nLuis,l@uni.pe\r\n\r\n');
    expect(rows.map((r) => r.Nombre)).toEqual(['Ana', 'Luis']);
  });

  it('limpia espacios en los encabezados y renombra los repetidos', () => {
    expect(parseCSV(' Nombre , Nombre \nA,B\n')).toEqual({
      headers: ['Nombre', 'Nombre_1'],
      rows: [{ Nombre: 'A', Nombre_1: 'B' }],
    });
  });

  it('un archivo vacío o solo con encabezados no da filas', () => {
    expect(parseCSV('')).toEqual({ headers: [], rows: [] });
    expect(parseCSV('Nombre,Correo\n')).toEqual({ headers: ['Nombre', 'Correo'], rows: [] });
  });
});

describe('parseTXT', () => {
  it('un nombre por línea, con saltos de Windows y líneas vacías', () => {
    expect(parseTXT('Ana Pérez\r\n\r\n  Luis Soto  \r\n')).toEqual({
      headers: ['Nombre'],
      rows: [{ Nombre: 'Ana Pérez' }, { Nombre: 'Luis Soto' }],
    });
  });

  it('separa nombre y correo con coma o punto y coma', () => {
    expect(parseTXT('Ana Pérez, ana@uni.pe\nLuis Soto;luis@uni.pe\nSolo Nombre').rows).toEqual([
      { Nombre: 'Ana Pérez', Correo: 'ana@uni.pe' },
      { Nombre: 'Luis Soto', Correo: 'luis@uni.pe' },
      { Nombre: 'Solo Nombre', Correo: '' },
    ]);
  });

  it('"Apellido, Nombre" sin correos se conserva como un nombre completo', () => {
    expect(parseTXT('Pérez Gil, Ana María\nSoto, Luis')).toEqual({
      headers: ['Nombre'],
      rows: [{ Nombre: 'Pérez Gil, Ana María' }, { Nombre: 'Soto, Luis' }],
    });
  });

  it('un archivo vacío no da filas', () => {
    expect(parseTXT(' \r\n \n')).toEqual({ headers: ['Nombre'], rows: [] });
  });
});

describe('parseExcel', () => {
  it('lee solo la primera hoja', async () => {
    const file = excelFile({
      Lista: sheet([['Nombre', 'Correo'], ['Ana', 'a@uni.pe']]),
      Otra: sheet([['X'], ['no debe aparecer']]),
    });
    expect(await parseExcel(file)).toEqual({
      headers: ['Nombre', 'Correo'],
      rows: [{ Nombre: 'Ana', Correo: 'a@uni.pe' }],
    });
  });

  it('descarta filas en blanco intermedias y finales, y deja vacías las celdas sin dato', async () => {
    const file = excelFile({
      Lista: sheet([['Nombre', 'Correo', 'Curso'], ['Ana', null, 'IA'], [], [' ', '', null], ['Luis', 'l@uni.pe'], [], []]),
    });
    expect((await parseExcel(file)).rows).toEqual([
      { Nombre: 'Ana', Correo: '', Curso: 'IA' },
      { Nombre: 'Luis', Correo: 'l@uni.pe', Curso: '' },
    ]);
  });

  it('nombra las columnas sin encabezado', async () => {
    const file = excelFile({ Lista: sheet([['Nombre', null, 'Curso'], ['Ana', 'x', 'IA']]) });
    expect((await parseExcel(file)).headers).toEqual(['Nombre', 'Columna 2', 'Curso']);
  });

  it('dos columnas con el mismo encabezado no se pisan', async () => {
    const file = excelFile({ Lista: sheet([['Nombre', 'Nota', 'Nombre', 'Nombre'], ['Ana', '18', 'Soto', 'x']]) });
    expect(await parseExcel(file)).toEqual({
      headers: ['Nombre', 'Nota', 'Nombre_1', 'Nombre_2'],
      rows: [{ Nombre: 'Ana', Nota: '18', Nombre_1: 'Soto', Nombre_2: 'x' }],
    });
  });

  it('una fecha llega como se ve en Excel y no como número de serie', async () => {
    const ws = sheet([['Nombre', 'Fecha', 'Emisión'], ['Ana', 'x', 'x']]);
    // 46342 = 16 de noviembre de 2026
    ws.B2 = { t: 'n', v: 46342, z: 'dd/mm/yyyy' };
    // "m/d/yy" es el formato corto del sistema: Excel lo muestra según la región del usuario
    ws.C2 = { t: 'n', v: 46342, z: 'm/d/yy' };
    const { rows } = await parseExcel(excelFile({ Lista: ws }));
    expect(rows[0].Fecha).toBe('16/11/2026');
    expect(rows[0].Emisión).toBe('16/11/2026');
  });

  it('los números se leen como texto, sin perder ceros ni decimales', async () => {
    const ws = sheet([['DNI', 'Nota', 'Horas', 'Código'], [45678912, 15.5, 0, '007']]);
    expect((await parseExcel(excelFile({ Lista: ws }))).rows).toEqual([
      { DNI: '45678912', Nota: '15.5', Horas: '0', Código: '007' },
    ]);
  });

  it('una hoja vacía no da encabezados ni filas', async () => {
    expect(await parseExcel(excelFile({ Lista: sheet([]) }))).toEqual({ headers: [], rows: [] });
  });
});

describe('detectColumns', () => {
  it('sin palabras clave usa la primera columna como nombre', () => {
    expect(detectColumns(['Participante X', 'Dato'])).toEqual({ nameCol: 'Participante X', emailCol: undefined });
    expect(detectColumns(['A', 'B'])).toEqual({ nameCol: 'A', emailCol: undefined });
  });

  it('sin columnas no sugiere nada', () => {
    expect(detectColumns([])).toEqual({ nameCol: undefined, emailCol: undefined });
  });

  it('reconoce el correo por contenido solo si al menos el 40 % de las filas con dato lo son', () => {
    const rows = (emails: number) =>
      Array.from({ length: 10 }, (_, i) => ({ Persona: `P${i}`, Dato: i < emails ? `p${i}@uni.pe` : 'texto' }));
    expect(detectColumns(['Persona', 'Dato'], rows(4)).emailCol).toBe('Dato');
    expect(detectColumns(['Persona', 'Dato'], rows(3)).emailCol).toBeUndefined();
  });
});
