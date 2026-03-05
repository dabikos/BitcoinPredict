import React, { useEffect, useState, useCallback, useRef } from 'react';
import './Toast.css';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  exiting: boolean;
}

const TOAST_DURATION = 4000;
let nextId = 0;
let addToastFn: ((type: ToastType, message: string) => void) | null = null;

export const toast = {
  success(message: string) { addToastFn?.('success', message); },
  error(message: string) { addToastFn?.('error', message); },
  info(message: string) { addToastFn?.('info', message); },
  warning(message: string) { addToastFn?.('warning', message); },
};

const icons: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    // Start exit animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    // Actually remove after animation
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++nextId;
    setToasts(prev => [...prev.slice(-4), { id, type, message, exiting: false }]);
    const timer = setTimeout(() => removeToast(id), TOAST_DURATION);
    timers.current.set(id, timer);
  }, [removeToast]);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      timers.current.forEach(t => clearTimeout(t));
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type}${t.exiting ? ' toast-exit' : ''}`}
          onClick={() => removeToast(t.id)}
        >
          <span className="toast-icon">{icons[t.type]}</span>
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
};
