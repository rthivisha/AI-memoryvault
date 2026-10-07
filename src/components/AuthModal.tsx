import React, { useState } from 'react';
import { Lock, User as UserIcon, ShieldAlert, ArrowRight, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';
import { api, setSession } from '../api';
import { User } from '../types';

interface Props {
  onLoginSuccess: (user: User) => void;
  onError: (msg: string) => void;
}

export const AuthModal: React.FC<Props> = ({ onLoginSuccess, onError }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);

    // Client-side quick checks
    if (!username.trim()) {
      setInlineError('Username must be 3-30 characters containing only letters, numbers, and underscores.');
      return;
    }
    if (password.length < 6) {
      setInlineError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await api.register(username.trim(), password);
        const res = await api.login(username.trim(), password);
        setSession(res.token, res.user);
        onLoginSuccess(res.user);
      } else {
        const res = await api.login(username.trim(), password);
        setSession(res.token, res.user);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      const msg = err.message || 'Authentication error';
      setInlineError(msg);
      onError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => {
    setUsername('Thivisha');
    setPassword('demo123');
    setInlineError(null);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md glass-panel rounded-3xl shadow-2xl p-7 sm:p-9 border border-white/[0.08] relative overflow-hidden backdrop-blur-2xl">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-b from-cyan-500/20 to-teal-500/5 border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.15)] mb-3 text-cyan-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
            {mode === 'login' ? 'Access Personal Vault' : 'Create Vault Account'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic Lexical Retrieval • AES-256 Storage
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-white/[0.03] p-1 mb-6 border border-white/[0.07] text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setInlineError(null);
            }}
            className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.08]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setInlineError(null);
            }}
            className={`flex-1 py-2 rounded-lg font-medium transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.08]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {/* Inline Error display */}
        {inlineError && (
          <div className="mb-4 p-3.5 rounded-xl bg-[#1A0A0E] border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5 leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{inlineError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Thivisha"
                className="w-full pl-10 pr-3.5 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Password <span className="text-slate-500 font-normal">(min 6 chars)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3.5 py-2.5 bg-black/40 border border-white/[0.08] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block animate-spin">⟳</span>
            ) : (
              <>
                <span>{mode === 'login' ? 'Unlock Vault' : 'Initialize Vault Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Account Quick-Fill Card */}
        <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
          <button
            type="button"
            onClick={handleDemoFill}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[11px] font-medium text-cyan-300 border border-white/[0.08] hover:border-cyan-500/50 transition-all cursor-pointer shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Fill Demo: <strong>Thivisha</strong> / <strong>demo123</strong></span>
          </button>
          <p className="text-[11px] text-slate-500 mt-2">
            Per-user isolated records with SHA-256 salted credentials
          </p>
        </div>
      </div>
    </div>
  );
};
