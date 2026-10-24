import React from 'react';

export interface TableLoadingProps {
  message?: string;
  className?: string;
}

export const TableLoading: React.FC<TableLoadingProps> = ({
  message = 'Loading...',
  className = '',
}) => {
  return (
    <div className={`bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark rounded-xl p-8 text-center text-text-light-secondary dark:text-text-dark-secondary ${className}`}>
      <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
      {message}
    </div>
  );
};
