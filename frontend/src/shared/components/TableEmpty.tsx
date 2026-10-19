import React from 'react';

export interface TableEmptyProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  iconClassName?: string;
  className?: string;
}

export const TableEmpty: React.FC<TableEmptyProps> = ({
  icon: Icon,
  title,
  description,
  action,
  iconClassName = 'w-10 h-10 text-slate-600 mx-auto mb-3',
  className = '',
}) => {
  return (
    <div className={`bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-12 text-center text-slate-400 ${className}`}>
      {Icon && <Icon className={iconClassName} />}
      <p className="text-base font-semibold text-slate-200">{title}</p>
      {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
