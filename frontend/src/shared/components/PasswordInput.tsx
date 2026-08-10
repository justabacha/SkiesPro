import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Input, { InputProps } from '@/shared/components/Input';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PasswordInput = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const [show, setShow] = useState(false);

  return (
    <div className="relative w-full">
      <Input
        {...props}
        ref={ref}
        type={show ? 'text' : 'password'}
        className={cn('pr-10', props.className)}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light-tertiary hover:text-text-light-primary dark:text-text-dark-tertiary dark:hover:text-text-dark-primary"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
