import React, { useState } from 'react';
import { BrandLogo } from '../../ui/BrandLogo';
import {
  FileSpreadsheet,
  Mail,
  ShieldCheck,
  Zap,
  Download,
  Sliders,
  Check,
  ChevronDown,
  ExternalLink,
  Award,
  ArrowRight,
  Send,
  Users,
} from 'lucide-react';
import type { Service } from '../../App';

const LinkedinIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 1 0 0-3.28 1.64 1.64 0 0 0 0 3.28m1.39 9.74v-8.37H5.07v8.37z" />
  </svg>
);

const SERVICES: {
  id: Service;
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  cta: string;
}[] = [
  {
    id: 'certificates',
    icon: Award,
    eyebrow: 'Con PDF adjunto',
    title: 'Generador de certificados automáticos',
    description: 'Sube tu plantilla, ubica el nombre y genera un certificado en PDF para cada persona de tu lista.',
    bullets: [
      'Plantillas en PDF o imagen',
      'Descarga todo en un ZIP',
      'Envío de cada certificado a su correo',
    ],
    cta: 'Crear certificados',
  },
  {
    id: 'mailer',
    icon: Mail,
    eyebrow: 'Solo correo',
    title: 'Envío de correos automáticos',
    description: 'Escribe un mensaje una sola vez y envíalo personalizado a cientos de personas desde tu Excel o CSV.',
    bullets: [
      'Saluda a cada persona por su nombre',
      'Envíate una prueba antes de mandar',
      'Reporte de entregas descargable',
    ],
    cta: 'Enviar correos',
  },
];

interface LandingPageProps {
  onSelectService: (service: Service) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectService }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      if (window.location.hash) {
        window.history.pushState(null, '', window.location.pathname);
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      document.body.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[#208077] selection:text-white">
      {/* ── Navbar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <BrandLogo
            onClick={scrollToTop}
          />

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-4 lg:gap-8 text-xs lg:text-sm font-medium text-slate-600">
            <a href="#servicios" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              Servicios
            </a>
            <a href="#features" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              Características
            </a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              Cómo funciona
            </a>
            <a href="#security" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              Privacidad y Seguridad
            </a>
            <a href="#faq" className="hover:text-slate-900 transition-colors whitespace-nowrap">
              Preguntas Frecuentes
            </a>
          </nav>

          {/* CTA Header Buttons */}
          <div className="flex items-center gap-3">
            <a
              href="#servicios"
              className="inline-flex items-center justify-center text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#208077] hover:bg-[#18655e] text-white transition-all duration-200 shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Probar ahora
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero: selector de servicios ───────────────────────────────── */}
      <section id="servicios" className="relative overflow-hidden pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-20 lg:pb-28 bg-slate-50 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-14">
          <div className="text-center space-y-5 max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.08]">
              ¿Qué quieres automatizar hoy?
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              Sube tu Excel o CSV y deja que Uniautomate haga el trabajo repetitivo por ti. Elige un servicio para empezar, es gratis y no necesitas registrarte.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {SERVICES.map((svc) => {
              const Icon = svc.icon;
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => onSelectService(svc.id)}
                  className="group text-left bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:border-[#208077]/60 transition-all duration-200 cursor-pointer flex flex-col gap-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#208077] focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#f0faf9] border border-[#b2e5df] flex items-center justify-center text-[#208077] transition-colors group-hover:bg-[#208077] group-hover:text-white">
                      <Icon className="w-7 h-7" strokeWidth={1.8} />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {svc.eyebrow}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                      {svc.title}
                    </h2>
                    <p className="text-sm text-slate-600 leading-relaxed">{svc.description}</p>
                  </div>

                  <ul className="space-y-2 text-sm text-slate-700 flex-1">
                    {svc.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-[#208077] mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  <span className="inline-flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-xl bg-[#208077] group-hover:bg-[#18655e] text-white font-semibold text-base transition-colors shadow-sm">
                    {svc.cta}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Métricas de Impacto (Colores sobrios, sin degradados ni morados) ──── */}
      <section className="py-12 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <div className="space-y-2 pt-4 md:pt-0">
              <span className="text-4xl font-extrabold text-[#208077] tracking-tight">
                0% Desbordes
              </span>
              <p className="text-sm font-semibold text-slate-900">
                Ajuste tipográfico milimétrico
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Los nombres largos se redimensionan automáticamente para caber exactos sin cortarse.
              </p>
            </div>

            <div className="space-y-2 pt-4 md:pt-0">
              <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                10x Más Rápido
              </span>
              <p className="text-sm font-semibold text-slate-900">
                Ahorro de tiempo operativo
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Elimina el trabajo manual de rotular certificados o escribir correos uno a uno.
              </p>
            </div>

            <div className="space-y-2 pt-4 md:pt-0">
              <span className="text-4xl font-extrabold text-[#208077] tracking-tight">
                100% Privado
              </span>
              <p className="text-sm font-semibold text-slate-900">
                Seguridad de datos garantizada
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Tus listas de participantes nunca se suben ni quedan registradas en servidores externos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Características Principales ─────────────────────────────────── */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <span className="text-xs font-bold text-[#208077] uppercase tracking-widest">
              Generador de certificados
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Todo lo que necesitas para emitir certificados sin estrés
            </h2>
            <p className="text-base text-slate-600">
              Diseñado minuciosamente para evitar los errores clásicos de alineación, nombres cortados o pérdida de formato.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm hover:border-[#208077]/50 transition-all space-y-4">
              <FileSpreadsheet className="w-7 h-7 text-[#208077]" strokeWidth={1.8} />
              <h3 className="text-lg font-bold text-slate-900">
                Importación Excel y CSV Inteligente
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Arrastra tu archivo con las columnas de tus alumnos. El sistema detecta automáticamente columnas como "Nombre", "Email" y "DNI".
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm hover:border-[#208077]/50 transition-all space-y-4">
              <Sliders className="w-7 h-7 text-[#208077]" strokeWidth={1.8} />
              <h3 className="text-lg font-bold text-slate-900">
                Editor Visual Interactivo
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Posiciona el recuadro del nombre sobre tu plantilla arrastrando el mouse. Personaliza tipografía, tamaño máximo/mínimo, color y mayúsculas.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm hover:border-[#208077]/50 transition-all space-y-4">
              <Zap className="w-7 h-7 text-[#208077]" strokeWidth={1.8} />
              <h3 className="text-lg font-bold text-slate-900">
                Motor Tipográfico Sin Desbordes
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Mide en píxeles reales el ancho de cada apellido compuesto. Si el texto supera el área, se reduce proporcionalmente para asegurar un acabado impecable.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm hover:border-[#208077]/50 transition-all space-y-4">
              <Mail className="w-7 h-7 text-[#208077]" strokeWidth={1.8} />
              <h3 className="text-lg font-bold text-slate-900">
                Despacho Masivo por Correo
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Envía cada diploma en PDF adjunto al correo electrónico individual de cada persona mediante tu cuenta de Gmail de forma confiable.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm hover:border-[#208077]/50 transition-all space-y-4">
              <Download className="w-7 h-7 text-[#208077]" strokeWidth={1.8} />
              <h3 className="text-lg font-bold text-slate-900">
                Exportación en ZIP Instantánea
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Genera los archivos PDF en alta definición y descárgalos comprimidos en un archivo .ZIP listo para almacenar o imprimir en imprenta.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm hover:border-[#208077]/50 transition-all space-y-4">
              <ShieldCheck className="w-7 h-7 text-[#208077]" strokeWidth={1.8} />
              <h3 className="text-lg font-bold text-slate-900">
                Cero Almacenamiento en Nube
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Cumplimiento estricto de privacidad. La composición del PDF se efectúa en la memoria de tu dispositivo, sin servidores intermediarios.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cómo Funciona (Paso a Paso) ─────────────────────────────────── */}
      <section id="how-it-works" className="py-24 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <span className="text-xs font-bold text-[#208077] uppercase tracking-widest">
              Flujo Simplificado
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              De tu lista de alumnos a certificados listos en 3 pasos
            </h2>
            <p className="text-base text-slate-600">
              Sin software complejo, sin instalaciones pesadas ni configuraciones tediosas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Paso 1 */}
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 space-y-4 relative">
              <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold text-base flex items-center justify-center">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Sube tu Plantilla
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Carga tu diseño en formato PDF o imagen de alta calidad. Mantiene intactos tus vectores, sellos y firmas originales.
              </p>
            </div>

            {/* Paso 2 */}
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 space-y-4 relative">
              <div className="w-10 h-10 rounded-full bg-[#208077] text-white font-bold text-base flex items-center justify-center">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Ubica el Texto y Carga el Excel
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Arrastra el recuadro para definir dónde irá el nombre del participante y conecta tu archivo Excel con la lista de graduados.
              </p>
            </div>

            {/* Paso 3 */}
            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 space-y-4 relative">
              <div className="w-10 h-10 rounded-full bg-[#14504b] text-white font-bold text-base flex items-center justify-center">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Descarga o Despacha por Correo
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Revisa la vista previa de cada destinatario. Descarga el paquete ZIP completo con un solo clic o envíalos individualmente a sus bandejas de entrada.
              </p>
            </div>
          </div>

          <div className="text-center pt-4">
            <button
              onClick={() => onSelectService('certificates')}
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-[#208077] hover:bg-[#18655e] text-white font-bold text-base shadow-sm transition-all duration-200 cursor-pointer active:scale-98"
            >
              Comenzar a Crear Certificados
            </button>
          </div>
        </div>
      </section>

      {/* ── Envío de correos automáticos ────────────────────────────────── */}
      <section id="envio-correos" className="py-24 bg-slate-50 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <span className="text-xs font-bold text-[#208077] uppercase tracking-widest">
              Envío de correos automáticos
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              ¿Solo necesitas escribirle a toda tu lista?
            </h2>
            <p className="text-base text-slate-600">
              Sin plantillas ni certificados: sube tus contactos, redacta el mensaje y envíalo personalizado a cada persona.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: 'Sube tus contactos',
                text: 'Arrastra tu Excel o CSV. Detectamos solas las columnas de correo y nombre.',
              },
              {
                icon: Mail,
                title: 'Redacta una sola vez',
                text: 'Usa {nombre} o cualquier columna de tu archivo para que cada correo sea personal.',
              },
              {
                icon: Send,
                title: 'Prueba y envía',
                text: 'Envíate una prueba, lanza el envío masivo y descarga el reporte de entregas.',
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <Icon className="w-7 h-7 text-[#208077]" strokeWidth={1.8} />
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>

          <div className="text-center pt-4">
            <button
              onClick={() => onSelectService('mailer')}
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-[#208077] hover:bg-[#18655e] text-white font-bold text-base shadow-sm transition-all duration-200 cursor-pointer active:scale-98"
            >
              Comenzar a Enviar Correos
            </button>
          </div>
        </div>
      </section>

      {/* ── Seguridad y Privacidad ─────────────────────────────────────── */}
      <section id="security" className="py-24 sm:py-28 bg-[#0e3834] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
          <h3 className="font-serif italic text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-white leading-tight">
            Tus datos nunca salen de tu ordenador
          </h3>
          <p className="font-sans text-sm sm:text-base lg:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto font-normal">
            A diferencia de otras herramientas que suben tu base de datos a servidores desconocidos, nuestro motor compila cada archivo PDF en la memoria local de tu navegador web. Tus listas de alumnos y correos permanecen 100% protegidas.
          </p>
        </div>
      </section>

      {/* ── Preguntas Frecuentes (FAQ) ──────────────────────────────────── */}
      <section id="faq" className="py-24 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Preguntas Frecuentes
            </h2>
            <p className="text-sm text-slate-600">
              Todo lo que necesitas saber antes de empezar.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                q: '¿Qué formatos de plantilla puedo utilizar?',
                a: 'Puedes subir plantillas vectoriales en PDF (conservando la máxima nitidez de impresión) o imágenes en formato PNG y JPG de alta resolución.',
              },
              {
                q: '¿Qué pasa si un participante tiene un nombre muy largo?',
                a: 'El algoritmo de autoajuste tipográfico detecta la longitud exacta en píxeles y reduce el tamaño de la fuente de manera proporcional para que quepa perfectamente dentro del área sin cortarse ni generar desbordes.',
              },
              {
                q: '¿Cómo funciona el envío por correo electrónico?',
                a: 'El sistema permite despachar cada certificado PDF generado como archivo adjunto a través de tu cuenta de Gmail conectada mediante una contraseña de aplicación segura. Los participantes recibirán el correo directamente en su bandeja de entrada.',
              },
              {
                q: '¿Puedo enviar correos sin generar certificados?',
                a: 'Sí. Elige el servicio "Envío de correos automáticos": subes tu Excel o CSV con una columna de correos, redactas el mensaje y se envía de forma individual a cada persona, sin plantilla ni adjuntos.',
              },
              {
                q: '¿Hay algún límite en la cantidad de certificados?',
                a: 'No hay límite artificial. Puedes procesar lotes de 50, 200, 500 o más certificados directamente en tu navegador y descargarlos en un único archivo comprimido .ZIP.',
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="border border-slate-200 rounded-2xl overflow-hidden transition-all duration-200"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-4.5 flex items-center justify-between text-left font-bold text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                      openFaq === idx ? 'rotate-180 text-[#208077]' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sección Contáctanos ─────────────────────────────────────────── */}
      <section id="contacto" className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-12">
            <span className="text-xs font-bold text-[#208077] uppercase tracking-widest">
              Contáctanos
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              ¿Tienes dudas, sugerencias o necesitas soporte?
            </h2>
            <p className="text-base text-slate-600">
              Ponte en contacto directo conmigo a través de correo electrónico o conectemos en LinkedIn.
            </p>
          </div>

          <div className="max-w-xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Correo */}
            <a
              href="mailto:jeanpierrf31@gmail.com"
              className="p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-[#f0faf9] hover:border-[#b2e5df] transition-all flex items-center gap-4 group shadow-2xs"
            >
              <Mail className="w-7 h-7 text-[#208077] shrink-0 transition-transform group-hover:scale-110" />
              <div className="min-w-0 text-left">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Correo Electrónico
                </span>
                <span className="text-sm font-bold text-slate-900 group-hover:text-[#208077] transition-colors truncate block">
                  jeanpierrf31@gmail.com
                </span>
              </div>
            </a>

            {/* LinkedIn */}
            <a
              href="https://www.linkedin.com/in/jeanpier-robles/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-[#f0faf9] hover:border-[#b2e5df] transition-all flex items-center gap-4 group shadow-2xs"
            >
              <LinkedinIcon className="w-7 h-7 text-[#208077] shrink-0 transition-transform group-hover:scale-110" />
              <div className="min-w-0 text-left">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  LinkedIn
                </span>
                <span className="text-sm font-bold text-slate-900 group-hover:text-[#208077] transition-colors flex items-center gap-1.5">
                  Jeanpier Robles
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#208077]" />
                </span>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-slate-400 py-10 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            <button onClick={() => onSelectService('certificates')} className="hover:text-white transition-colors cursor-pointer">
              Generar certificados
            </button>
            <button onClick={() => onSelectService('mailer')} className="hover:text-white transition-colors cursor-pointer">
              Enviar correos
            </button>
            <a href="#features" className="hover:text-white transition-colors">
              Características
            </a>
            <a href="/privacidad.html" className="hover:text-white transition-colors">
              Política de privacidad
            </a>
            <a href="#contacto" className="hover:text-white transition-colors">
              Contacto
            </a>
            <a
              href="mailto:jeanpierrf31@gmail.com"
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>jeanpierrf31@gmail.com</span>
            </a>
            <a
              href="https://www.linkedin.com/in/jeanpier-robles/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1.5"
            >
              <LinkedinIcon className="w-3.5 h-3.5" />
              <span>LinkedIn</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
