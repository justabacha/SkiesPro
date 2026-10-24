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
  iconClassName = 'w-10 h-10 text-text-light-secondary dark:text-text-dark-secondary mx-auto mb-3',
  className = '',
}) => {
  return (
    <div className={`bg-bg-light-secondary dark:bg-bg-dark-secondary border border-border-light dark:border-border-dark rounded-xl p-12 text-center text-text-light-secondary dark:text-text-dark-secondary ${className}`}>
      {Icon && <Icon className={iconClassName} />}
      <p className="text-base font-semibold text-text-light-primary dark:text-text-dark-primary">{title}</p>
      {description && <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
