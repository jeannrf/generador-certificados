import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  /** light: logo para fondos claros · dark: logo para fondos oscuros */
  theme?: 'dark' | 'light';
  onClick?: () => void;
  className?: string;
}

const LOGO_SRC = {
  light: '/brand/logo-claro.svg',
  dark: '/brand/logo-oscuro.svg',
};

const heights = {
  sm: 'h-7',
  md: 'h-9',
  lg: 'h-11',
};

/**
 * Logo completo de Uniautomate (ícono + nombre), servido desde public/brand.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', theme = 'light', onClick, className = '' }) => {
  const image = <img src={LOGO_SRC[theme]} alt="Uniautomate" className={`${heights[size]} w-auto`} draggable={false} />;

  if (!onClick) return <div className={`flex items-center select-none ${className}`}>{image}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      title="Ir a inicio"
      className={`flex items-center rounded-md select-none cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#208077] focus-visible:ring-offset-2 ${className}`}
    >
      {image}
    </button>
  );
};
