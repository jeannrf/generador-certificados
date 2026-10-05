import React, { useState, useEffect } from 'react';
import { Wizard } from './features/wizard/Wizard';
import { LandingPage } from './features/landing/LandingPage';
import { BrandLogo } from './ui/BrandLogo';

export const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'generator'>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#generator') {
      return 'generator';
    }
    return 'home';
  });

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#generator') {
        setView('generator');
      } else if (window.location.hash === '' || window.location.hash === '#home') {
        setView('home');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToGenerator = () => {
    window.location.hash = '#generator';
    setView('generator');
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
    return <LandingPage onStartGenerator={navigateToGenerator} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-800">
      {/* Header en vista del Generador */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <BrandLogo
              size="sm"
              onClick={navigateToHome}
            />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        <Wizard />
      </main>
    </div>
  );
};

export default App;
