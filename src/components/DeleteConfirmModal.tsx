import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Memory } from '../types';
import { api } from '../api';

interface Props {
  memory: Memory;
  onClose: () => void;
  onDeleted: (memoryId: string) => void;
  onError: (msg: string) => void;
  isPurge?: boolean;
}

export const DeleteConfirmModal: React.FC<Props> = ({
  memory,
  onClose,
  onDeleted,
  onError,
  isPurge = false,
}) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteMemory(memory.memoryId, isPurge);
      onDeleted(memory.memoryId);
    } catch (err: any) {
      onError(err.message || 'Failed to delete memory.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-rose-900/60 rounded-xl shadow-2xl p-6 relative">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-700/50 text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">
              {isPurge ? 'Permanently Purge Memory?' : 'Move Memory to Trash?'}
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {isPurge ? (
                <>
                  Are you sure you want to permanently erase record{' '}
                  <strong className="text-rose-300">{memory.memoryId}</strong> (&quot;{memory.title}&quot;)?
                  This operation cannot be undone.
                </>
              ) : (
                <>
                  Move <strong className="text-rose-300">{memory.memoryId}</strong> (&quot;{memory.title}&quot;) to the Trash?
                  You can restore it anytime within 30 days.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{deleting ? 'Processing...' : isPurge ? 'Purge Permanently' : 'Move to Trash'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
