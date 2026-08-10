import React, { forwardRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'buy-up' | 'buy-down';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props },
    ref
  ) => {
    const variants = {
      primary: 'bg-brand text-white hover:bg-brand-hover active:scale-[0.98]',
      secondary: 'border border-brand text-brand hover:bg-brand-light active:scale-[0.98]',
      ghost:
        'text-brand hover:bg-bg-light-tertiary dark:hover:bg-bg-dark-tertiary active:scale-[0.98]',
      danger: 'bg-danger text-white hover:bg-danger/90 active:scale-[0.98]',
      'buy-up':
        'bg-success text-white hover:bg-success/90 active:scale-[0.97] text-lg font-bold h-[48px]',
      'buy-down':
        'bg-danger text-white hover:bg-danger/90 active:scale-[0.97] text-lg font-bold h-[48px]',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-[44px] px-4 py-2',
      lg: 'h-12 px-8',
      icon: 'h-[44px] w-[44px]',
    };

    return (
      <button
        ref={ref}
        type={props.type || 'button'}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
