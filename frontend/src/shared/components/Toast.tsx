import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, XCircle, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ToastType = 'success' | 'warning' | 'danger' | 'info';

export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  onClose: (id: string) => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ id, type, message, onClose, duration = 5000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timer);
  }, [id, onClose, duration]);

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-success" />,
    warning: <AlertCircle className="h-5 w-5 text-warning" />,
    danger: <XCircle className="h-5 w-5 text-danger" />,
    info: <Info className="h-5 w-5 text-info" />,
  };

  const variants = {
    success: 'bg-success-light border-success/20',
    warning: 'bg-warning-light border-warning/20',
    danger: 'bg-danger-light border-danger/20',
    info: 'bg-info-light border-info/20',
  };

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      className={cn(
        'flex items-center gap-3 p-4 rounded-md border shadow-lg max-w-sm',
        variants[type]
      )}
      role="alert"
    >
      {icons[type]}
      <p className="flex-1 text-sm font-medium text-text-light-primary">{message}</p>
      <button
        onClick={() => onClose(id)}
        className="text-text-light-tertiary hover:text-text-light-primary transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
};

export interface ToastContainerProps {
  toasts: Omit<ToastProps, 'onClose'>[];
  setToasts: React.Dispatch<React.SetStateAction<Omit<ToastProps, 'onClose'>[]>>;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, setToasts }) => {
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Toast;
