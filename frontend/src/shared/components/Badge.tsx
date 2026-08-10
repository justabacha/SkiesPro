import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const Badge: React.FC<BadgeProps> = ({ className, variant = 'neutral', ...props }) => {
  const variants = {
    success: 'bg-success-light text-success',
    warning: 'bg-warning-light text-warning',
    danger: 'bg-danger-light text-danger',
    info: 'bg-info-light text-info',
    neutral:
      'bg-bg-light-tertiary text-text-light-secondary dark:bg-bg-dark-tertiary dark:text-text-dark-secondary',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center h-[22px] px-2 rounded-full text-[10px] font-bold uppercase tracking-wider',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

export default Badge;
