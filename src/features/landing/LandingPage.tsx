import React, { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, Mail, Menu, Pause, Play, X } from 'lucide-react';
import { BrandLogo } from '../../ui/BrandLogo';
import { QrPreview } from '../../ui/QrPreview';
import type { Service } from '../../App';

const LinkedinIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 1 0 0-3.28 1.64 1.64 0 0 0 0 3.28m1.39 9.74v-8.37H5.07v8.37z" />
  </svg>
);

const SUPPORT_EMAIL = 'jeanpierrf31@gmail.com';
const LINKEDIN_URL = 'https://www.linkedin.com/in/jeanpier-robles/';

/** Lista de ejemplo de la portada (se rotula como tal en la página). */
const SAMPLE_ROSTER: { name: string; email: string }[] = [
  { name: 'María Fernanda Quispe Huamán', email: 'mquispe@example.com' },
  { name: 'Jorge Chávez', email: 'jchavez@example.com' },
  { name: 'María de los Ángeles Villanueva Castañeda', email: 'mvillanueva@example.com' },
  { name: 'Luis Alberto Ramírez Torres', email: 'lramirez@example.com' },
];

const SPEC_SHEET: { label: string; value: string }[] = [
  { label: 'Plantilla', value: 'Tu propio diseño en PDF, PNG o JPG, de 1 a 5 páginas. El PDF conserva su calidad original.' },
  { label: 'Campos', value: 'Nombre, curso, fecha o cualquier columna de tu lista, con más de 100 fuentes.' },
  { label: 'Nombres largos', value: 'Se ajustan solos a su espacio. En la revisión ves cuáles cambiaron.' },
  { label: 'QR', value: 'Opcional. Cada PDF se guarda en tu Google Drive y su QR abre ese archivo.' },
  {
    label: 'Correo',
    value: 'Opcional. Sale del Gmail de Uniautomate con el nombre de remitente que elijas. Antes te envías una prueba.',
  },
  { label: 'Reporte', value: 'Un CSV con quién recibió su certificado y quién no.' },
];

const TIMETABLE: { step: string; action: string; result: string }[] = [
  { step: 'Plantilla', action: 'Subes el diseño de tu certificado.', result: 'Vista previa de cada página' },
  { step: 'Posición y estilo', action: 'Ubicas el nombre y los demás campos.', result: 'El certificado tal como saldrá' },
  { step: 'Participantes', action: 'Subes tu Excel o CSV.', result: 'Columnas detectadas' },
  { step: 'Revisión', action: 'Corriges nombres y correos.', result: 'Lista validada' },
  { step: 'Entrega', action: 'Generas y envías.', result: 'ZIP, carpeta en Drive y correos' },
];

const DATA_ROWS: { data: string; where: string; stored: string }[] = [
  { data: 'Plantilla y lista de participantes', where: 'En tu navegador', stored: 'No' },
  { data: 'Certificados en PDF', where: 'Se crean en tu navegador y se descargan en tu equipo', stored: 'No' },
  {
    data: 'PDF en tu Google Drive (opcional)',
    where: 'En tu Drive: la carpeta es privada y cada PDF se comparte por su enlace para que el QR lo abra',
    stored: 'No. Son tuyos y puedes dejar de compartirlos.',
  },
  {
    data: 'Correos (opcional)',
    where: 'Salen del Gmail de Uniautomate a través de nuestro servidor',
    stored: 'No. Gmail conserva una copia en «Enviados».',
  },
];

const NAV_LINKS: { href: string; label: string }[] = [
  { href: '#programa', label: 'Qué incluye' },
  { href: '#cronograma', label: 'Cómo funciona' },
  { href: '#datos', label: 'Tus datos' },
  { href: '#preguntas', label: 'Preguntas' },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: '¿Qué formatos de plantilla acepta?',
    a: 'PDF, PNG o JPG, de 1 a 5 páginas y hasta 15 MB por archivo. Las páginas en PDF conservan su calidad original.',
  },
  {
    q: '¿Qué pasa con los nombres muy largos?',
    a: 'El tamaño de letra se reduce automáticamente hasta que el nombre entra en su espacio, sin cortarlo. En la revisión ves qué nombres se ajustaron.',
  },
  {
    q: '¿Desde qué correo se envían los certificados?',
    a: 'Desde la cuenta de Gmail de Uniautomate, no desde la de tu empresa. Tú eliges el nombre de remitente que verán los participantes y, antes de enviar, ves cuántos envíos quedan en el día.',
  },
  {
    q: '¿Quién puede ver los PDF guardados en Drive?',
    a: 'Cada PDF lo ve solo quien tenga su enlace o escanee su QR. La carpeta con todos queda privada en tu Google Drive, y puedes dejar de compartir cualquier archivo cuando quieras.',
  },
  {
    q: '¿Necesito crear una cuenta?',
    a: 'No. Es gratis y no requiere registro. Solo para guardar en Google Drive conectas tu cuenta de Google.',
  },
  {
    q: '¿Puedo enviar correos sin certificado?',
    a: 'Sí. El servicio Correos envía un mensaje personalizado a cada persona de tu lista, sin plantilla ni adjuntos.',
  },
];

/** Tamaño del nombre según su largo, como el autoajuste del generador (en % del ancho del certificado). */
function nameSizeClass(name: string): string {
  if (name.length > 36) return 'text-[3.6cqw]';
  if (name.length > 26) return 'text-[4.3cqw]';
  return 'text-[5.1cqw]';
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Portada: una lista de ejemplo y el certificado que se genera para la fila activa (nombre y QR propios).
 */
const RosterToCertificate: React.FC = () => {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const cycling = !reducedMotion && !paused;

  useEffect(() => {
    if (!cycling) return;
    let swap: number | undefined;
    const timer = window.setInterval(() => {
      setVisible(false);
      swap = window.setTimeout(() => {
        setIndex((i) => (i + 1) % SAMPLE_ROSTER.length);
        setVisible(true);
      }, 280);
    }, 3200);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(swap);
    };
  }, [cycling]);

  const choose = (i: number) => {
    setPaused(true);
    setIndex(i);
    setVisible(true);
  };

  const { name } = SAMPLE_ROSTER[index];
  const swapClass = visible ? 'opacity-100 blur-0' : 'opacity-0 blur-[3px]';

  return (
    <figure className="flex w-full flex-col">
      <table className="order-3 mt-4 w-full table-fixed lg:order-1 lg:mt-0 overflow-hidden rounded-[6px] border border-[#0F2E2B]/15 bg-white text-left text-sm">
        <caption className="sr-only">Lista de participantes de ejemplo</caption>
        <thead className="bg-[#E7F1EF] text-xs font-semibold uppercase tracking-[0.08em] [font-stretch:80%]">
          <tr>
            <th scope="col" className="w-10 px-3 py-2 font-semibold">#</th>
            <th scope="col" className="px-3 py-2 font-semibold sm:w-[58%]">Nombre</th>
            <th scope="col" className="hidden px-3 py-2 font-semibold sm:table-cell">Correo</th>
          </tr>
        </thead>
        <tbody>
          {SAMPLE_ROSTER.map((row, i) => {
            const active = i === index;
            return (
              <tr
                key={row.email}
                aria-current={active ? 'true' : undefined}
                className={`border-t border-[#0F2E2B]/10 transition-colors duration-300 ${active ? 'bg-[#F4F8F7]' : ''}`}
              >
                <td className={`px-3 py-2 tabular-nums ${active ? 'font-bold text-[#208077]' : 'text-[#4B635F]'}`}>{i + 1}</td>
                <td className="px-3 py-1">
                  <button
                    type="button"
                    onClick={() => choose(i)}
                    className={`w-full truncate rounded-[4px] py-1 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077] ${
                      active ? 'font-semibold text-[#0F2E2B]' : 'text-[#4B635F] hover:text-[#0F2E2B]'
                    }`}
                  >
                    {row.name}
                  </button>
                </td>
                <td className="hidden truncate px-3 py-2 text-xs text-[#4B635F] sm:table-cell">{row.email}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Todo se mide en cqw (ancho del certificado) para que escale como un documento */}
      <div className="relative order-1 aspect-[1.414/1] w-full [container-type:inline-size] lg:order-2 lg:mt-4 bg-white rounded-[6px] shadow-[0_24px_48px_-24px_rgba(15,46,43,0.35),0_2px_6px_rgba(15,46,43,0.08)] p-[3.5%]">
        <div className="h-full w-full border-[1.5px] border-[#208077] rounded-[3px] p-[2.5%]">
          <div className="relative h-full w-full border border-[#208077]/35 flex flex-col items-center text-center px-[7%] pt-[6%] pb-[5%]">
            <span className="font-display [font-stretch:80%] text-[max(2cqw,7px)] font-semibold tracking-[0.18em] uppercase text-[#208077]">
              Instituto de Capacitación Ejemplo
            </span>
            <span className="mt-[4%] font-serif text-[5.6cqw] leading-none text-[#0F2E2B]">
              Certificado de participación
            </span>
            <span className="mt-[5%] text-[max(2.1cqw,8px)] text-[#4B635F]">Otorgado a</span>
            <span
              className={`mt-[1.5%] font-serif italic font-semibold leading-tight text-[#0F2E2B] transition-[opacity,filter] duration-300 ease-out ${swapClass} ${nameSizeClass(name)}`}
            >
              {name}
            </span>
            <span className="mt-[1.5%] h-px w-[62%] bg-[#0F2E2B]/25" aria-hidden="true" />
            <span className="mt-[3.5%] max-w-[78%] text-[max(2.1cqw,8px)] leading-snug text-[#4B635F]">
              por aprobar el curso <span className="text-[#0F2E2B] font-semibold">Seguridad y salud en el trabajo</span>,
              con una duración de 16 horas académicas.
            </span>

            <div className="mt-auto flex w-full items-end justify-between gap-[3cqw]">
              <div className="flex-1 text-left">
                <span className="block h-px w-full max-w-[150px] bg-[#0F2E2B]/40" aria-hidden="true" />
                <span className="mt-[0.8cqw] block text-[max(1.8cqw,7px)] text-[#4B635F]">Dirección académica</span>
              </div>
              {/* QR de ejemplo distinto por participante; abre esta página en vez de un archivo inexistente */}
              <QrPreview
                text={`https://uniautomate.vercel.app/#ejemplo-${index + 1}`}
                color="#0F2E2B"
                className={`w-[11cqw] shrink-0 transition-[opacity,filter] duration-300 ease-out ${swapClass}`}
              />
              <div className="flex-1 text-right">
                <span className="ml-auto block h-px w-full max-w-[150px] bg-[#0F2E2B]/40" aria-hidden="true" />
                <span className="mt-[0.8cqw] block text-[max(1.8cqw,7px)] text-[#4B635F]">Fecha de emisión</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="order-2 mt-3 flex items-center justify-between gap-4 text-xs text-[#4B635F] lg:order-3">
        <span>
          Certificado <span className="tabular-nums font-semibold text-[#0F2E2B]">{index + 1}</span> de{' '}
          <span className="tabular-nums">{SAMPLE_ROSTER.length}</span> · Datos de ejemplo
        </span>
        {!reducedMotion && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 font-semibold text-[#208077] hover:underline underline-offset-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077]"
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? 'Reanudar' : 'Pausar'}
          </button>
        )}
      </figcaption>
    </figure>
  );
};

interface LandingPageProps {
  onSelectService: (service: Service) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectService }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollToTop = () => {
    if (window.location.hash) window.history.pushState(null, '', window.location.pathname);
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const linkClass =
    'rounded-[4px] underline-offset-4 hover:text-[#0F2E2B] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077] focus-visible:ring-offset-2';
  const primaryButton =
    'inline-flex items-center justify-center gap-2 rounded-[6px] bg-[#208077] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#18655e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077] focus-visible:ring-offset-2 cursor-pointer';
  const secondaryButton =
    'inline-flex items-center justify-center gap-2 rounded-[6px] border border-[#0F2E2B]/25 bg-white px-5 py-3 text-sm font-semibold text-[#0F2E2B] transition-colors hover:border-[#208077] hover:text-[#208077] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077] focus-visible:ring-offset-2 cursor-pointer';
  const footerLink =
    'inline-flex min-h-11 items-center rounded-[4px] hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ED1C7]';
  const sectionHeading =
    'font-display text-[28px] sm:text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-[#0F2E2B]';

  return (
    <div className="min-h-screen bg-white font-display text-[#0F2E2B] selection:bg-[#208077] selection:text-white">
      {/* Encabezado */}
      <header className="sticky top-0 z-40 border-b border-[#0F2E2B]/10 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <BrandLogo size="sm" onClick={scrollToTop} />
          <nav aria-label="Secciones" className="hidden items-center gap-7 text-sm text-[#4B635F] md:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className={linkClass}>
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {/* En móvil el botón de la portada queda a la vista; aquí ocuparía dos líneas */}
            <button
              type="button"
              onClick={() => onSelectService('certificates')}
              className={`${primaryButton} hidden px-4 py-2 sm:inline-flex`}
            >
              Crear certificados
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="menu-movil"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[6px] text-[#0F2E2B] hover:bg-[#F4F8F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077] cursor-pointer md:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="menu-movil" aria-label="Secciones" className="border-t border-[#0F2E2B]/10 px-4 pb-3 md:hidden">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 items-center border-b border-[#0F2E2B]/10 text-base font-semibold last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#208077]"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      <main>
        {/* Portada */}
        <section id="inicio" className="scroll-mt-16 border-b border-[#0F2E2B]/10">
          <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:py-24">
            <div className="lg:col-span-6 lg:pt-10">
              <div className="h-1 w-14 bg-[#208077]" aria-hidden="true" />
              <h1 className="mt-6 text-[40px] sm:text-[56px] lg:text-[64px] font-bold leading-[1.02] tracking-[-0.03em] [font-stretch:92%] [text-wrap:balance]">
                Los certificados de tu capacitación, listos en minutos.
              </h1>
              <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-[#4B635F]">
                Sube tu diseño y la lista de participantes. Uniautomate genera un PDF por persona y, si quieres, lo guarda
                en tu Google Drive con su QR y lo envía por correo.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => onSelectService('certificates')} className={primaryButton}>
                  Crear certificados <ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onSelectService('mailer')} className={secondaryButton}>
                  <Mail className="h-4 w-4" /> Enviar correos
                </button>
              </div>
              <p className="mt-10 text-sm text-[#4B635F]">Gratis · Sin registro · Funciona en tu navegador</p>
            </div>

            <div className="lg:col-span-6">
              <RosterToCertificate />
            </div>
          </div>
        </section>

        {/* Qué incluye */}
        <section id="programa" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <div className="grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <h2 className={sectionHeading}>Qué incluye</h2>
                <p className="mt-4 max-w-sm text-[#4B635F]">
                  Todo lo necesario para emitir los certificados de un curso, desde el diseño hasta la entrega.
                </p>
              </div>
              <div className="lg:col-span-8 border-t-2 border-[#0F2E2B]">
                <dl>
                  {SPEC_SHEET.map((row) => (
                    <div
                      key={row.label}
                      className="grid gap-1 border-b border-[#0F2E2B]/12 py-5 sm:grid-cols-[10rem_1fr] sm:gap-8"
                    >
                      <dt className="text-xs font-semibold uppercase leading-6 tracking-[0.08em] [font-stretch:80%] text-[#208077]">
                        {row.label}
                      </dt>
                      <dd className="leading-relaxed text-[#0F2E2B]">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>

        {/* Cómo funciona: cronograma */}
        <section id="cronograma" className="scroll-mt-16 bg-[#F4F8F7] border-y border-[#0F2E2B]/10">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <h2 className={sectionHeading}>Cómo funciona</h2>

            <div className="mt-10 overflow-hidden rounded-[6px] border border-[#0F2E2B]/15 bg-white">
              <table className="block w-full text-left md:table">
                <caption className="sr-only">Los cinco pasos para generar tus certificados</caption>
                <thead className="hidden bg-[#E7F1EF] text-xs uppercase tracking-[0.08em] [font-stretch:80%] md:table-header-group">
                  <tr>
                    <th scope="col" className="w-16 px-5 py-3 font-semibold">Paso</th>
                    <th scope="col" className="w-48 px-5 py-3 font-semibold">Etapa</th>
                    <th scope="col" className="px-5 py-3 font-semibold">Qué haces</th>
                    <th scope="col" className="w-64 px-5 py-3 font-semibold">Qué obtienes</th>
                  </tr>
                </thead>
                <tbody className="block md:table-row-group">
                  {TIMETABLE.map((row, i) => (
                    <tr
                      key={row.step}
                      className="grid grid-cols-[3rem_1fr] border-t border-[#0F2E2B]/10 first:border-t-0 md:table-row md:first:border-t"
                    >
                      <td className="row-span-3 px-5 py-4 align-baseline text-2xl font-bold tabular-nums text-[#208077] md:text-xl">
                        {i + 1}
                      </td>
                      <th scope="row" className="px-5 pt-4 text-left align-baseline font-bold md:py-4">{row.step}</th>
                      <td className="px-5 pt-1 align-baseline text-[#4B635F] md:py-4">{row.action}</td>
                      <td className="px-5 pt-1 pb-4 align-baseline text-sm font-semibold md:py-4">
                        <span className="font-normal text-[#4B635F] md:hidden">Obtienes: </span>
                        {row.result}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8">
              <button type="button" onClick={() => onSelectService('certificates')} className={primaryButton}>
                Crear certificados <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Dónde quedan tus datos */}
        <section id="datos" className="scroll-mt-16 border-t border-[#0F2E2B]/10">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <div className="grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <h2 className={sectionHeading}>Dónde quedan tus datos</h2>
                <p className="mt-4 max-w-sm text-[#4B635F]">
                  No guardamos tus listas ni tus certificados. Así viaja cada cosa.
                </p>
                <a href="/privacidad.html" className={`mt-6 inline-block text-sm font-semibold text-[#208077] ${linkClass}`}>
                  Política de privacidad
                </a>
              </div>
              <div className="lg:col-span-8">
                <table className="block w-full text-left md:table">
                  <caption className="sr-only">Dónde se procesa cada dato y si lo guardamos</caption>
                  <thead className="hidden text-xs uppercase tracking-[0.08em] [font-stretch:80%] md:table-header-group">
                    <tr className="border-b-2 border-[#0F2E2B]">
                      <th scope="col" className="pb-3 pr-6 font-semibold">Dato</th>
                      <th scope="col" className="pb-3 pr-6 font-semibold">Dónde se procesa</th>
                      <th scope="col" className="pb-3 font-semibold">¿Lo guardamos?</th>
                    </tr>
                  </thead>
                  <tbody className="block border-t-2 border-[#0F2E2B] md:table-row-group md:border-t-0">
                    {DATA_ROWS.map((row) => (
                      <tr key={row.data} className="grid gap-1 border-b border-[#0F2E2B]/12 py-5 md:table-row">
                        <th scope="row" className="text-left align-top font-bold md:w-[28%] md:py-5 md:pr-6">{row.data}</th>
                        <td className="align-top text-[#4B635F] md:py-5 md:pr-6">{row.where}</td>
                        <td className="align-top text-sm font-semibold text-[#208077] md:w-[28%] md:py-5">{row.stored}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Preguntas frecuentes */}
        <section id="preguntas" className="scroll-mt-16 border-t border-[#0F2E2B]/10">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 className={sectionHeading}>Preguntas frecuentes</h2>
            </div>
            <div className="lg:col-span-8 border-t-2 border-[#0F2E2B]">
              {FAQS.map((faq, idx) => {
                const open = openFaq === idx;
                return (
                  <div key={faq.q} className="border-b border-[#0F2E2B]/12">
                    <h3>
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`faq-${idx}`}
                        onClick={() => setOpenFaq(open ? null : idx)}
                        className="flex w-full items-center justify-between gap-6 py-5 text-left text-base font-bold transition-colors hover:text-[#208077] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#208077] cursor-pointer"
                      >
                        {faq.q}
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 text-[#208077] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </h3>
                    {open && (
                      <p id={`faq-${idx}`} className="max-w-2xl pb-6 leading-relaxed text-[#4B635F]">
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Servicio de correos */}
        <section aria-labelledby="correos-title" className="border-t border-[#0F2E2B]/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 id="correos-title" className="text-2xl font-bold tracking-[-0.02em]">
                ¿Solo necesitas escribirle a tu lista?
              </h2>
              <p className="mt-2 max-w-xl text-[#4B635F]">
                Sube tus contactos, escribe el mensaje una vez y cada persona lo recibe con su nombre.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectService('mailer')}
              className={`${secondaryButton} shrink-0`}
            >
              <Mail className="h-4 w-4" /> Enviar correos
            </button>
          </div>
        </section>

        {/* Cierre */}
        <section aria-labelledby="cierre-title" className="bg-[#F4F8F7] border-t border-[#0F2E2B]/10">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-20 sm:px-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="h-1 w-14 bg-[#208077]" aria-hidden="true" />
              <h2 id="cierre-title" className={`mt-6 ${sectionHeading} sm:text-[40px]`}>
                Prueba con tu propio diseño.
              </h2>
              <p className="mt-3 text-[#4B635F]">Gratis y sin registro. Nada se envía hasta que tú lo confirmes.</p>
            </div>
            <button type="button" onClick={() => onSelectService('certificates')} className={`${primaryButton} shrink-0`}>
              Crear certificados <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      {/* Pie de página */}
      <footer className="bg-[#0F2E2B] text-sm text-[#B9D3CE]">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
          <BrandLogo size="sm" theme="dark" onClick={scrollToTop} />
          <nav aria-label="Pie de página" className="flex flex-wrap gap-x-7 gap-y-1">
            <button type="button" onClick={() => onSelectService('certificates')} className={footerLink}>
              Crear certificados
            </button>
            <button type="button" onClick={() => onSelectService('mailer')} className={footerLink}>
              Enviar correos
            </button>
            <a href="/privacidad.html" className={footerLink}>
              Política de privacidad
            </a>
          </nav>
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-7 gap-y-1 border-t border-white/10 py-5">
          <span className="text-[#B9D3CE]">Soporte:</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} className={`${footerLink} gap-2`}>
            <Mail className="h-4 w-4" /> {SUPPORT_EMAIL}
          </a>
          <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className={`${footerLink} gap-2`}>
            <LinkedinIcon className="h-4 w-4" /> LinkedIn
          </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
