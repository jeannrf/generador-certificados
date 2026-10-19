import React, { useState, useEffect } from 'react';
import { Award, Mail } from 'lucide-react';
import { Wizard } from './features/wizard/Wizard';
import { MailerWizard } from './features/mailer/MailerWizard';
import { LandingPage } from './features/landing/LandingPage';
import { BrandLogo } from './ui/BrandLogo';

export type Service = 'certificates' | 'mailer';
type View = 'home' | Service;

const SERVICE_HASH: Record<Service, string> = {
  certificates: '#certificados',
  mailer: '#correos',
};

const SERVICE_TABS: { service: Service; label: string; icon: React.ElementType }[] = [
  { service: 'certificates', label: 'Certificados', icon: Award },
  { service: 'mailer', label: 'Correos', icon: Mail },
];

function viewFromHash(hash: string): View {
  // '#generator' se mantiene por compatibilidad con enlaces antiguos
  if (hash === SERVICE_HASH.certificates || hash === '#generator') return 'certificates';
  if (hash === SERVICE_HASH.mailer) return 'mailer';
  return 'home';
}

export const App: React.FC = () => {
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' ? viewFromHash(window.location.hash) : 'home'
  );

  useEffect(() => {
    const handleHashChange = () => setView(viewFromHash(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToService = (service: Service) => {
    window.location.hash = SERVICE_HASH[service];
    setView(service);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToHome = () => {
    window.location.hash = '';
    setView('home');
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    });
  };

  if (view === 'home') {
    return <LandingPage onSelectService={navigateToService} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-800">
      {/* Header en vista de los servicios */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center">
            <BrandLogo
              size="sm"
              onClick={navigateToHome}
            />
          </div>

          {/* Cambio rápido entre servicios */}
          <nav
            aria-label="Servicios"
            className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-semibold"
          >
            {SERVICE_TABS.map(({ service, label, icon: Icon }) => (
              <button
                key={service}
                type="button"
                onClick={() => navigateToService(service)}
                aria-current={view === service ? 'page' : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  view === service
                    ? 'bg-[#208077] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {view === 'certificates' ? <Wizard /> : <MailerWizard />}
      </main>
    </div>
  );
};

export default App;
