import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastMessage } from '../types';

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<Props> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
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
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-xl text-xs transition-all duration-300 animate-in slide-in-from-top-3 ${
        isError
          ? 'bg-[#180A0E]/95 border-rose-500/30 text-rose-100 shadow-rose-950/20'
          : isSuccess
          ? 'bg-[#081512]/95 border-emerald-500/30 text-emerald-100 shadow-emerald-950/20'
          : 'bg-[#0A1220]/95 border-cyan-500/30 text-cyan-100 shadow-cyan-950/20'
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {isError && (
          <div className="p-1 rounded-md bg-rose-500/20 text-rose-400">
            <AlertCircle className="w-4 h-4" />
          </div>
        )}
        {isSuccess && (
          <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        )}
        {!isError && !isSuccess && (
          <div className="p-1 rounded-md bg-cyan-500/20 text-cyan-400">
            <Info className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="flex-1 leading-relaxed">
        <p className="font-semibold text-white tracking-tight">
          {isError ? 'Notice' : isSuccess ? 'Success' : 'Information'}
        </p>
        <p className="text-slate-300 mt-0.5 text-xs">
          {toast.text}
        </p>
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-400 hover:text-white transition-colors shrink-0 ml-1 p-1 rounded-md hover:bg-white/10 cursor-pointer"
        aria-label="Dismiss toast"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
