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
    <div className={`bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-8 text-center text-slate-400 ${className}`}>
      <div className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
      {message}
    </div>
  );
};
