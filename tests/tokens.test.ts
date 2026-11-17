import { describe, it, expect } from 'vitest';
import { replaceTokens, toTitleCase } from '../src/domain/normalization';
import { buildDeliveryReportCsv, ensureHtmlEmailBody, interpolateEmailVariables } from '../src/domain/email';
import { formatCertificateFileName, validateRecipients } from '../src/domain/validation';
import { validateEmailRequest } from '../api/_lib/emailGuard';
import { Recipient } from '../src/domain/types';

const person = (extra: Record<string, string> = {}, name = 'Ana Pérez'): Recipient => ({
  id: 'rec_1',
  rowNumber: 1,
  name,
  email: 'ana@uni.pe',
  extra,
  issues: [],
});

describe('replaceTokens', () => {
  it('reemplaza {clave} y [clave] y deja como están los tokens desconocidos', () => {
    const lookup = (key: string) => (key === 'a' ? 'X' : undefined);
    expect(replaceTokens('{a} [a] {b} [b] {} []', lookup)).toBe('X X {b} [b] {} []');
  });

  it('no vuelve a leer el valor insertado', () => {
    expect(replaceTokens('{a}', (key) => (key === 'a' ? '{a}{b}' : 'NUNCA'))).toBe('{a}{b}');
  });
});

describe('Variables del correo - encabezados y valores con caracteres especiales', () => {
  it('acepta encabezados con símbolos de expresión regular', () => {
    const rec = person({ 'C++': 'avanzado', 'Nota (final': '18', 'N.º': '7', 'a|b': 'x', '¿Aprobó?': 'sí' });
    expect(interpolateEmailVariables('{C++} · {Nota (final} · [N.º] · {a|b} · {¿Aprobó?}', rec)).toBe(
      'avanzado · 18 · 7 · x · sí'
    );
  });

  it('un punto en el encabezado no hace de comodín', () => {
    expect(interpolateEmailVariables('{N.º} {Nxº}', person({ 'N.º': '7' }))).toBe('7 {Nxº}');
  });

  it('inserta el valor tal cual aunque tenga $&, $1 o $\'', () => {
    const rec = person({ monto: "US$& 100 $1 $' $$" });
    expect(interpolateEmailVariables('Pago {monto} fin', rec)).toBe("Pago US$& 100 $1 $' $$ fin");
  });

  it('un valor con forma de variable no se interpola otra vez', () => {
    expect(interpolateEmailVariables('Hola {nombre}', person({}, 'X {correo}'))).toBe('Hola X {correo}');
  });

  it('no distingue mayúsculas y {nombre}/{correo} ganan a una columna con ese encabezado', () => {
    const rec = person({ Nombre: 'OTRO', CURSO: 'IA' });
    expect(interpolateEmailVariables('{NOMBRE} · {Correo} · {curso}', rec)).toBe('Ana Pérez · ana@uni.pe · IA');
  });

  it('una columna vacía deja el texto vacío, y una variable que no existe se queda escrita', () => {
    expect(interpolateEmailVariables('[{curso}] {sede}', person({ curso: '' }))).toBe('[] {sede}');
  });

  it('escapa los datos de la lista para HTML, pero no el HTML que escribió el organizador', () => {
    const rec = person({ curso: 'I+D & <b>IA</b>' }, "O'Connor <Ana>");
    const html = ensureHtmlEmailBody(
      interpolateEmailVariables('<p>Hola <strong>{nombre}</strong>: {curso}</p>', rec, { escapeForHtml: true })
    );
    expect(html).toBe('<p>Hola <strong>O&#039;Connor &lt;Ana&gt;</strong>: I+D &amp; &lt;b&gt;IA&lt;/b&gt;</p>');
  });
});

describe('Nombre de archivo del certificado - casos límite', () => {
  it('acepta columnas con símbolos de expresión regular', () => {
    expect(formatCertificateFileName('{nombre} {Nota (final} {C++}', 'Ana', { 'Nota (final': '18', 'C++': 'x' })).toBe(
      'Ana 18 x.pdf'
    );
  });

  it('inserta nombres y valores con $& tal cual', () => {
    expect(formatCertificateFileName('{nombre} {curso}', 'A$&B', { curso: 'C$&D' })).toBe('A$&B C$&D.pdf');
  });

  it('quita los caracteres prohibidos en nombres de archivo que vengan de una columna', () => {
    expect(formatCertificateFileName('{nombre} {fecha}', 'Ana', { fecha: '01/10/2026' })).toBe('Ana 01102026.pdf');
  });

  it('usa el patrón por defecto si viene vacío y "Sin Nombre" si no hay nombre', () => {
    expect(formatCertificateFileName('   ', 'Ana')).toBe('Ana - Certificado.pdf');
    expect(formatCertificateFileName('{nombre}', '   ')).toBe('Sin Nombre.pdf');
  });

  it('no duplica la extensión y corta a 100 caracteres', () => {
    expect(formatCertificateFileName('{nombre}.pdf', 'Ana')).toBe('Ana.pdf');
    const long = formatCertificateFileName('{nombre}', 'A'.repeat(300));
    expect(long).toBe(`${'A'.repeat(100)}.pdf`);
  });

  it('si el patrón queda vacío tras limpiarlo usa el nombre', () => {
    expect(formatCertificateFileName('???', 'Ana')).toBe('Ana.pdf');
  });
});

describe('Reporte CSV de entregas', () => {
  it('neutraliza los textos que Excel ejecutaría como fórmula', () => {
    const csv = buildDeliveryReportCsv([
      { recipientId: 'r1', name: '=HYPERLINK("http://x","y")', email: '+51@x.pe', status: 'error', errorMessage: '@SUM(A1)' },
    ]);
    expect(csv).toContain(`r1,"'=HYPERLINK(""http://x"",""y"")","'+51@x.pe",error,"'@SUM(A1)",`);
  });

  it('conserva comas, comillas y saltos de línea dentro de la celda', () => {
    const csv = buildDeliveryReportCsv([
      { recipientId: 'r1', name: 'Pérez, "Ana"', email: 'a@x.pe', status: 'error', errorMessage: 'línea 1\nlínea 2' },
    ]);
    expect(csv).toContain('"Pérez, ""Ana""","a@x.pe",error,"línea 1\nlínea 2",');
    expect(csv.startsWith('﻿')).toBe(true);
  });
});

describe('Validación de correos - el navegador y el servidor aplican la misma regla', () => {
  const emails = [
    'ana@uni.pe',
    'josé.ñandú@correo.com.pe',
    'a+b@x.io',
    'a@b.co;x',
    'a@b.co,c@d.co',
    '<a@b.co>',
    '"a"@b.co',
    'a b@c.co',
    'sin-arroba.com',
    'a@b',
    'a@@b.co',
  ];

  it.each(emails)('%s', (email) => {
    const client = !validateRecipients([{ name: 'Ana', email }])[0].issues.some((i) => i.code === 'INVALID_EMAIL');
    const server = validateEmailRequest({ to: email, subject: 'Asunto', html: '<p>Hola</p>' }, 'Equipo').ok;
    expect(client).toBe(server);
  });

  it('exige el correo solo cuando se pide (envío de correos simples)', () => {
    expect(validateRecipients([{ name: 'Ana' }])[0].issues).toEqual([]);
    const required = validateRecipients([{ name: '', email: ' ' }], { requireName: false, requireEmail: true });
    expect(required[0].issues.map((i) => i.code)).toEqual(['EMPTY_EMAIL']);
  });

  it('marca como duplicados los correos repetidos sin distinguir mayúsculas', () => {
    const result = validateRecipients([
      { name: 'Ana', email: 'Ana@Uni.pe' },
      { name: 'Luis', email: 'ana@uni.pe' },
    ]);
    expect(result[1].issues.map((i) => i.code)).toEqual(['DUPLICATE']);
  });
});

describe('Mayúsculas en nombres compuestos', () => {
  it.each([
    ["maría elena o'connor-pérez", "María Elena O'Connor-Pérez"],
    ['JEAN-PIERRE D’ALEMBERT', 'Jean-Pierre D’Alembert'],
    ['ana-maría de la o', 'Ana-María de la O'],
    ["o'higgins", "O'Higgins"],
    ['pérez-', 'Pérez-'],
  ])('%s → %s', (input, expected) => {
    expect(toTitleCase(input)).toBe(expected);
  });

  it('una variable dentro de corchetes o llaves se reemplaza igual', () => {
    const lookup = (key: string) => ({ curso: 'IA', 'Nota [final]': '18' })[key];
    expect(replaceTokens('[{curso}] {[curso]} {Nota [final]} [x {y}]', lookup)).toBe('[IA] {IA} 18 [x {y}]');
  });
});
