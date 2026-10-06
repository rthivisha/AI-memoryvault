import React from 'react';
import {
  ShieldCheck,
  PlusCircle,
  Search,
  LayoutDashboard,
  LogOut,
  Brain,
  Database,
  Image as ImageIcon,
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
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Zone 1: Single text element wordmark */}
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-base font-bold tracking-tight text-white">
              AI MemoVault
            </span>
          </div>

          {/* Zone 2: 4-6 clean text navigation links with active state */}
          {user && (
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`transition-colors hover:text-white flex items-center gap-1.5 ${
                  activeTab === 'dashboard' ? 'text-white font-semibold' : ''
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-cyan-400" />
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('memories')}
                className={`transition-colors hover:text-white flex items-center gap-1.5 ${
                  activeTab === 'memories' ? 'text-white font-semibold' : ''
                }`}
              >
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Memories <span className="text-slate-500 tabular-nums">({totalMemories})</span></span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('gallery')}
                className={`transition-colors hover:text-white flex items-center gap-1.5 ${
                  activeTab === 'gallery' ? 'text-white font-semibold' : ''
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
                <span>Gallery</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className={`transition-colors hover:text-white flex items-center gap-1.5 ${
                  activeTab === 'search' ? 'text-white font-semibold' : ''
                }`}
              >
                <Search className="w-3.5 h-3.5 text-cyan-400" />
                <span>Search</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('about')}
                className={`transition-colors hover:text-white flex items-center gap-1.5 ${
                  activeTab === 'about' ? 'text-white font-semibold' : ''
                }`}
              >
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <span>How AI Works</span>
              </button>
            </nav>
          )}

          {/* Zone 3: 1-2 primary actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('add')}
                  className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Record Memory</span>
                  <span className="sm:hidden">Add</span>
                </button>

                <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-slate-300 font-medium">{user.displayName || user.username}</span>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <span className="text-xs text-cyan-400 font-mono">
                Encrypted Vault
              </span>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        {user && (
          <div className="flex md:hidden items-center justify-between border-t border-slate-800/80 py-2.5 text-xs text-slate-400 overflow-x-auto gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`whitespace-nowrap ${activeTab === 'dashboard' ? 'text-cyan-400 font-semibold' : ''}`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('memories')}
              className={`whitespace-nowrap ${activeTab === 'memories' ? 'text-cyan-400 font-semibold' : ''}`}
            >
              Memories
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className={`whitespace-nowrap ${activeTab === 'gallery' ? 'text-teal-400 font-semibold' : ''}`}
            >
              Gallery
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`whitespace-nowrap ${activeTab === 'search' ? 'text-cyan-400 font-semibold' : ''}`}
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`whitespace-nowrap ${activeTab === 'about' ? 'text-purple-400 font-semibold' : ''}`}
            >
              AI Info
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
