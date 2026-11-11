import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToastNotification } from '../types/index.js';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  const getIcon = (type: ToastNotification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={16} className="toast-icon-success" />;
      case 'error':
        return <AlertCircle size={16} className="toast-icon-error" />;
      case 'warning':
        return <AlertCircle size={16} className="toast-icon-warning" />;
      case 'info':
      default:
        return <Info size={16} className="toast-icon-info" />;
    }
  };

  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className={`toast-item toast-${toast.type}`}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
            layout
          >
            <div className="toast-content">
              {getIcon(toast.type)}
              <span className="toast-message">{toast.message}</span>
            </div>
            <button
              className="toast-close"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

