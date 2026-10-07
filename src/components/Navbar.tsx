import React from 'react';
import {
  ShieldCheck,
  Plus,
  Search,
  LayoutDashboard,
  LogOut,
  Sparkles,
  Database,
  Image as ImageIcon,
  Command,
} from 'lucide-react';
import { User } from '../types';

interface Props {
  user: User | null;
  activeTab: 'dashboard' | 'memories' | 'gallery' | 'add' | 'search' | 'about' | 'trash';
  setActiveTab: (tab: 'dashboard' | 'memories' | 'gallery' | 'add' | 'search' | 'about' | 'trash') => void;
  totalMemories: number;
  onLogout: () => void;
}

export const Navbar: React.FC<Props> = ({
  user,
  activeTab,
  setActiveTab,
  totalMemories,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#07090E]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Wordmark & Emblem */}
          <div
            className="flex items-center gap-3 cursor-pointer group select-none"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-b from-cyan-500/20 to-teal-500/5 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] group-hover:border-cyan-400/50 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] transition-all duration-300">
              <ShieldCheck className="w-5 h-5 text-cyan-400 group-hover:scale-105 transition-transform" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white group-hover:text-cyan-200 transition-colors">
                  MemoVault
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" title="Encrypted Vault Online" />
              </div>
              <p className="text-[10px] text-slate-400 tracking-tight hidden sm:block">
                Encrypted Knowledge &amp; Media
              </p>
            </div>
          </div>

          {/* Desktop Navigation - Sleek Segmented Pill Container */}
          {user && (
            <nav className="hidden md:flex items-center p-1 bg-white/[0.03] border border-white/[0.07] rounded-xl shadow-inner">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.08]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-cyan-400" />
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('memories')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'memories'
                    ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.08]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Memories</span>
                <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                  {totalMemories}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('gallery')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'gallery'
                    ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.08]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
                <span>Gallery</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'search'
                    ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.08]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                }`}
              >
                <Search className="w-3.5 h-3.5 text-cyan-400" />
                <span>Search</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('about')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'about'
                    ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.08]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Lexical AI</span>
              </button>
            </nav>
          )}

          {/* Quick Actions & User Controls */}
          <div className="flex items-center gap-2.5">
            {user ? (
              <>
                {/* Spotlight Search Trigger */}
                <button
                  type="button"
                  onClick={() => setActiveTab('search')}
                  className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] rounded-lg transition-all cursor-pointer"
                  title="Search memory vault (⌘K)"
                >
                  <Search className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px]">Search</span>
                  <kbd className="hidden xl:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-700/60 rounded">
                    <Command className="w-2.5 h-2.5" /> K
                  </kbd>
                </button>

                {/* Primary CTA: Record Memory */}
                <button
                  type="button"
                  onClick={() => setActiveTab('add')}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span className="hidden sm:inline">Record Memory</span>
                  <span className="sm:hidden">Add</span>
                </button>

                {/* User Identity Pill */}
                <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-white/[0.08]">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-600 to-teal-600 flex items-center justify-center text-xs font-bold text-slate-950 shadow-sm select-none">
                    {(user.displayName || user.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden xl:inline text-xs font-medium text-slate-300 truncate max-w-[100px]">
                    {user.displayName || user.username}
                  </span>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Sign out of vault"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <span className="text-xs text-cyan-400 font-mono tracking-wide">
                Vault Locked 🔒
              </span>
            )}
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        {user && (
          <div className="flex md:hidden items-center justify-between border-t border-white/[0.06] py-2 text-xs text-slate-400 overflow-x-auto gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'dashboard' ? 'bg-white/[0.08] text-cyan-300 font-semibold' : 'hover:text-white'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('memories')}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'memories' ? 'bg-white/[0.08] text-cyan-300 font-semibold' : 'hover:text-white'
              }`}
            >
              Memories ({totalMemories})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'gallery' ? 'bg-white/[0.08] text-teal-300 font-semibold' : 'hover:text-white'
              }`}
            >
              Gallery
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'search' ? 'bg-white/[0.08] text-cyan-300 font-semibold' : 'hover:text-white'
              }`}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === 'about' ? 'bg-white/[0.08] text-purple-300 font-semibold' : 'hover:text-white'
              }`}
            >
              AI Info
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
