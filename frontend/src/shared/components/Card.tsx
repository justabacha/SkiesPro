import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'stat' | 'asset' | 'contract' | 'kyc';
}

const Card: React.FC<CardProps> = ({ className, variant = 'default', ...props }) => {
  const variants = {
    default: 'bg-bg-light-secondary dark:bg-bg-dark-secondary shadow-sm',
    stat: 'bg-bg-light-secondary dark:bg-bg-dark-secondary shadow-sm min-w-[220px] min-h-[100px]',
    asset:
      'bg-bg-light-secondary dark:bg-bg-dark-secondary shadow-sm border border-border-light dark:border-border-dark',
    contract:
      'bg-bg-light-secondary dark:bg-bg-dark-secondary shadow-sm border border-border-light dark:border-border-dark p-3',
    kyc: 'bg-bg-light-secondary dark:bg-bg-dark-secondary shadow-md p-6 max-w-[480px]',
  };

  return (
    <div className={cn('rounded-md p-4 transition-all', variants[variant], className)} {...props} />
  );
};

export default Card;
