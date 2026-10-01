import React from 'react';
import { Wizard } from './features/wizard/Wizard';
import { Award } from 'lucide-react';

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
              <span className="font-bold text-base text-slate-900 tracking-tight block">
                Generador de Certificados
              </span>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Emisión masiva en PDF
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <Wizard />
      </div>

      {/* Minimal Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-4 mt-auto text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-center">
          <span>Generador Automático de Certificados</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
