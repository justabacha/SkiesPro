import React, { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className }) => {
  const [error, setError] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const sizes = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-10 w-10 text-sm',
  };

  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full bg-bg-light-tertiary dark:bg-bg-dark-tertiary items-center justify-center',
        sizes[size],
        className
      )}
    >
      {src && !error ? (
        <img
          src={src}
          alt={name}
          className="aspect-square h-full w-full"
          onError={() => setError(true)}
        />
      ) : (
        <span className="font-medium text-text-light-secondary dark:text-text-dark-secondary">
          {getInitials(name)}
        </span>
      )}
    </div>
  );
};

export default Avatar;
