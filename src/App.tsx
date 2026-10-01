import React from 'react';
import { Wizard } from './features/wizard/Wizard';
import { Award, ShieldCheck, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Award className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-slate-900 tracking-tight">
                  Generador de Certificados
                </span>
                <span className="text-[10px] font-semibold uppercase bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full border border-brand-200">
                  MVP v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Emisión masiva en PDF instantánea y sin costo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200/80 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>100% Local · Privacidad Garantizada</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <Wizard />
      </div>

      {/* Minimal Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 mt-auto text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span>Generación vectorial directa con pdf-lib y Web APIs.</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Costo $0</span>
            <span>•</span>
            <span>Sin servidores externos</span>
            <span>•</span>
            <span>Listo para producción</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
