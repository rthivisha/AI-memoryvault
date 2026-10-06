import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastMessage } from '../types';

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<Props> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 5500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isError = toast.type === 'error';
  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-xl border font-mono text-xs transition-all animate-in slide-in-from-top-2 duration-200 ${
        isError
          ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          : isSuccess
          ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
          : 'bg-slate-900/90 border-cyan-500/50 text-cyan-200'
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {isError && <AlertCircle className="w-4 h-4 text-rose-400" />}
        {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        {!isError && !isSuccess && <Info className="w-4 h-4 text-cyan-400" />}
      </div>
      <div className="flex-1 leading-relaxed">
        <span className="font-bold mr-1">
          {isError ? '[ERROR]' : isSuccess ? '[SUCCESS]' : '[INFO]'}
        </span>
        <span>{toast.text}</span>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-white transition-colors shrink-0 ml-2"
        aria-label="Dismiss toast"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
