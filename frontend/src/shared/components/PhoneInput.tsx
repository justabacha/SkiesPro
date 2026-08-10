import { forwardRef } from 'react';
import Input, { InputProps } from '@/shared/components/Input';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PhoneInput = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return (
    <div className="relative w-full">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-text-light-tertiary border-r border-border-light pr-2 dark:border-border-dark">
        +254
      </div>
      <Input
        {...props}
        ref={ref}
        type="tel"
        className={cn('pl-16', props.className)}
        placeholder="7XXXXXXXX"
      />
    </div>
  );
});

PhoneInput.displayName = 'PhoneInput';

export default PhoneInput;
