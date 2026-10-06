import React, { useState } from 'react';
import { Lock, User as UserIcon, ShieldAlert, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
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
        // Automatically login after successful registration
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
      <div className="w-full max-w-md bg-slate-900/90 border border-cyan-900/50 rounded-xl shadow-2xl p-6 sm:p-8 backdrop-blur-md relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 border border-cyan-500/30 shadow-inner mb-3 text-cyan-400">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold font-mono tracking-wide text-white">
            {mode === 'login' ? 'Access Personal Vault' : 'Create Vault Account'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Lexical AI Memory Engine • Inverted Index • Pipe Storage
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-lg bg-slate-950 p-1 mb-6 border border-slate-800 font-mono text-xs">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setInlineError(null);
            }}
            className={`flex-1 py-2 rounded-md font-medium transition-all ${
              mode === 'login'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
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
            className={`flex-1 py-2 rounded-md font-medium transition-all ${
              mode === 'register'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register
          </button>
        </div>

        {/* Inline Error display */}
        {inlineError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 font-mono text-xs flex items-start gap-2 leading-relaxed">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{inlineError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. Thivisha"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Password <span className="text-slate-500">(min 6 chars)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-mono font-bold text-xs rounded-lg transition-all shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
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
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={handleDemoFill}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-cyan-300 border border-slate-700 hover:border-cyan-500/50 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Use Demo: <strong>Thivisha</strong> / <strong>demo123</strong></span>
          </button>
          <p className="text-[11px] text-slate-500 mt-2">
            Per-user isolated records with SHA-256 salted credentials
          </p>
        </div>
      </div>
    </div>
  );
};
