import React from 'react';
import Label from '@/shared/components/Label';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface FormGroupProps {
  label?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}

const FormGroup: React.FC<FormGroupProps> = ({
  label,
  error,
  hint,
  children,
  className,
  required,
}) => {
  return (
    <div className={cn('flex flex-col gap-1.5 w-full', className)}>
      {label && (
        <Label className={cn(required && "after:content-['*'] after:ml-0.5 after:text-danger")}>
          {label}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger font-medium" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-text-light-tertiary dark:text-text-dark-tertiary">{hint}</p>
      ) : null}
    </div>
  );
};

export default FormGroup;
