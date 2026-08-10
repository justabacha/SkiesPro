import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  size?: 'sm' | 'md' | 'lg';
}

const Label: React.FC<LabelProps> = ({ className, size = 'md', ...props }) => {
  const sizes = {
    sm: 'text-xs',
    md: 'text-sm font-medium',
    lg: 'text-base font-semibold',
  };

  return (
    <label
      className={cn(
        'text-text-light-primary dark:text-text-dark-primary leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        sizes[size],
        className
      )}
      {...props}
    />
  );
};

export default Label;
