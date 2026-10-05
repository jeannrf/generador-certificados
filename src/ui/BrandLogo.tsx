import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  theme?: 'dark' | 'light';
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

export const BrandIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Emblema académico y certificación: Birrete universitario con sello de acreditación */}
    <path
      d="M14 4.5L3.5 10L14 15.5L24.5 10L14 4.5Z"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.5 12.5V18C6.5 18 9.5 21.5 14 21.5C18.5 21.5 21.5 18 21.5 18V12.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M24.5 10.5V19"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <circle cx="14" cy="18.5" r="1.2" fill="currentColor" />
  </svg>
);

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  theme = 'light',
  subtitle,
  onClick,
  className = '',
}) => {
  const isLight = theme === 'light';

  const iconSizes = {
    sm: 'w-7 h-7 rounded-lg text-white',
    md: 'w-10 h-10 rounded-xl text-white',
    lg: 'w-12 h-12 rounded-2xl text-white',
  };

  const svgSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const titleSizes = {
    sm: 'text-sm font-bold',
    md: 'text-lg font-extrabold',
    lg: 'text-2xl font-extrabold',
  };

  const subtitleSizes = {
    sm: 'text-[9px]',
    md: 'text-[11px]',
    lg: 'text-xs',
  };

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      onClick={onClick}
      title={onClick ? 'Ir a inicio' : undefined}
      className={`flex items-center gap-3 select-none ${
        onClick ? 'cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all' : ''
      } ${className}`}
    >
      {/* Contenedor del ícono con verde corporativo #208077 */}
      <div
        className={`${iconSizes[size]} bg-[#208077] flex items-center justify-center shrink-0 shadow-xs`}
      >
        <BrandIcon className={svgSizes[size]} />
      </div>

      <div className="flex flex-col">
        <span
          className={`${titleSizes[size]} tracking-tight leading-tight ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}
        >
          UniCertified
        </span>
        {subtitle && (
          <span
            className={`${subtitleSizes[size]} font-medium leading-none mt-0.5 ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
