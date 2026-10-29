import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className, hoverEffect = false, ...props }) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-white border border-slate-200 rounded-[8px] shadow-card transition-colors duration-200',
          hoverEffect && 'hover:border-slate-300',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
