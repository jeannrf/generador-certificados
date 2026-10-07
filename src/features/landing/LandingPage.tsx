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
  FileText,
  ExternalLink,
} from 'lucide-react';

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

interface LandingPageProps {
  onStartGenerator: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStartGenerator }) => {
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
            <button
              onClick={onStartGenerator}
              className="inline-flex items-center justify-center text-sm font-semibold px-5 py-2.5 rounded-xl bg-[#208077] hover:bg-[#18655e] text-white transition-all duration-200 shadow-xs cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Probar ahora
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero Section (Limpio, sobrio y profesional, sin badges ni degradados de IA) ───── */}
      <section className="relative overflow-hidden pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-20 lg:pb-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Columna Izquierda: Mensaje y CTA principal */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-center lg:text-left">
              {/* Título tipográfico limpio y contundente */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.08] max-w-3xl mx-auto lg:mx-0">
                Emite certificados oficiales masivos en segundos.
              </h1>

              {/* Subtítulo editorial */}
              <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Diseña sobre tu propia plantilla en PDF, conecta tu lista de Excel en un instante y despacha cientos de diplomas personalizados con entrega directa a sus correos.
              </p>

              {/* Botones de Acción Principal */}
              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={onStartGenerator}
                  className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl bg-[#208077] hover:bg-[#18655e] text-white font-semibold text-base transition-all duration-200 shadow-sm cursor-pointer active:scale-98"
                >
                  Probar ahora
                </button>
                <a
                  href="#contacto"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-base transition-all duration-200 shadow-xs cursor-pointer active:scale-98"
                >
                  Contacto
                </a>
              </div>
            </div>

            {/* Columna Derecha: Mockup Visual con Tarjetas Superpuestas */}
            <div className="lg:col-span-5 relative mt-4 lg:mt-0 flex justify-center">
              <div className="relative mx-auto max-w-md w-full lg:max-w-none">
                
                {/* 1. Tarjeta Principal (Tarjeta Blanca de Emisión de Lote) */}
                <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-200 relative z-10 space-y-6">
                  {/* Header de la tarjeta */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#f0faf9] border border-[#b2e5df] flex items-center justify-center text-[#208077] font-bold">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 leading-tight">
                          Certificación Académica
                        </h4>
                        <p className="text-xs text-slate-400">
                          diplomados@universidad.edu
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#f0faf9] text-[#208077] border border-[#b2e5df]">
                      Activo
                    </span>
                  </div>

                  {/* Resumen del Lote */}
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Lote Preparado
                    </span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        350 Certificados
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Fecha de emisión: 24 de Octubre, 2026
                    </p>
                  </div>

                  {/* Opciones de salida con radio */}
                  <div className="space-y-2.5 pt-2">
                    <div className="p-3 rounded-xl border border-[#208077]/40 bg-[#f0faf9] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border-4 border-[#208077] bg-white" />
                        <span className="text-xs font-semibold text-slate-800">
                          Descarga en ZIP (Alta Resolución)
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-[#208077] font-semibold">
                        Listo
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border border-slate-300 bg-white" />
                        <span className="text-xs font-medium text-slate-600">
                          Despacho individual por correo
                        </span>
                      </div>
                      <Mail className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>

                  {/* Botón puramente ilustrativo dentro del mockup (no interactivo) */}
                  <div className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-semibold text-sm text-center shadow-xs select-none pointer-events-none cursor-default opacity-95">
                    Generar Lote Completo
                  </div>
                </div>

                {/* 2. Tarjeta Flotante Superpuesta con el Verde Predominante #208077 */}
                <div className="absolute -top-6 -right-2 sm:-top-8 sm:-right-4 lg:-right-8 z-20 w-60 sm:w-64 bg-gradient-to-br from-[#208077] to-[#124742] rounded-2xl p-4 sm:p-5 text-white shadow-2xl border border-teal-300/30 transform rotate-1 hover:rotate-0 transition-transform duration-300">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-semibold text-teal-100 uppercase tracking-widest block">
                        Certificado Seguro
                      </span>
                      <span className="text-xs font-bold text-white tracking-wide">
                        CERT-2026 • 9842
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-teal-100">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="space-y-1 mb-4">
                    <p className="text-[10px] text-teal-100/80">Destinatario de honor</p>
                    <p className="text-sm font-bold text-white tracking-tight">
                      Dra. Sofía Alarcón Medina
                    </p>
                  </div>

                  <div className="pt-3 border-t border-teal-500/40 flex items-center justify-between text-[11px] text-teal-100">
                    <span className="flex items-center gap-1 font-medium">
                      <Check className="w-3.5 h-3.5 text-teal-200" /> Autoajuste OK
                    </span>
                    <span className="font-mono font-bold text-teal-200">100% PDF</span>
                  </div>
                </div>

              </div>
            </div>

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
                Elimina el trabajo manual de diseñar y rotular certificados uno a uno.
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
              Precisión y Control
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
              onClick={onStartGenerator}
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl bg-[#208077] hover:bg-[#18655e] text-white font-bold text-base shadow-sm transition-all duration-200 cursor-pointer active:scale-98"
            >
              Comenzar a Crear Certificados
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
              Todo lo que necesitas saber antes de empezar a emitir tus certificados.
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6">
            <button onClick={onStartGenerator} className="hover:text-white transition-colors cursor-pointer">
              Abrir Generador
            </button>
            <a href="#features" className="hover:text-white transition-colors">
              Características
            </a>
            <a href="#security" className="hover:text-white transition-colors">
              Privacidad
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
          <p className="text-slate-500">
            © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};
