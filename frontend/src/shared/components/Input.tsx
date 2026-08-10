import React, { forwardRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        'flex h-[44px] w-full rounded-md border border-border-light bg-bg-light-primary px-3 py-2 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:bg-bg-dark-primary',
        error
          ? 'border-danger focus-visible:ring-danger'
          : 'border-border-light focus-visible:ring-brand dark:border-border-dark',
        className
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export default Input;
