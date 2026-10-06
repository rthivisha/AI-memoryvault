/**
 * AI MemoVault Production Application
 * High-performance personal memory platform with SQLite, encryption at rest,
 * multi-attachment vault, Recharts dashboard, and hand-crafted lexical AI.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  api,
  getCurrentStoredUser,
  clearSession,
} from './api';
import { CategoryType, Memory, ToastMessage, User } from './types';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { DashboardView } from './components/DashboardView';
import { MemoriesView } from './components/MemoriesView';
import { GalleryView } from './components/GalleryView';
import { AddMemoryModal } from './components/AddMemoryModal';
import { EditMemoryModal } from './components/EditMemoryModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { MemoryDrawer } from './components/MemoryDrawer';
import { SearchModal } from './components/SearchModal';
import { AboutModal } from './components/AboutModal';
import { ToastContainer } from './components/Toast';

export default function App() {
  const [user, setUser] = useState<User | null>(getCurrentStoredUser());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'memories' | 'gallery' | 'add' | 'search' | 'about' | 'trash'>('dashboard');

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [isTrashView, setIsTrashView] = useState(false);

  // Filters for Memories Tab
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Modals & Drawer State
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [deletingMemory, setDeletingMemory] = useState<{ memory: Memory; isPurge: boolean } | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((type: 'error' | 'success' | 'info', text: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    setToasts(prev => [...prev, { id, type, text }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Fetch memories
  const refreshVaultData = useCallback(async () => {
    if (!user) return;
    setLoadingMemories(true);
    try {
      const memsRes = await api.listMemories({
        category: selectedCategory || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        trash_only: isTrashView,
      });
      setMemories(memsRes);
    } catch (err: any) {
      if (err.message !== 'Please log in first.') {
        addToast('error', err.message || 'Failed to load vault records.');
      }
    } finally {
      setLoadingMemories(false);
    }
  }, [user, selectedCategory, fromDate, toDate, isTrashView, addToast]);

  // Auth expiration listener
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setMemories([]);
      addToast('error', 'Session expired. Please log in again.');
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, [addToast]);

  // Verify stored user session on mount
  useEffect(() => {
    if (user) {
      api
        .getMe()
        .then(verifiedUser => {
          setUser(verifiedUser);
          refreshVaultData();
        })
        .catch(() => {
          clearSession();
          setUser(null);
        });
    }
  }, []);

  // Re-fetch when user, memory filters, or trash state change
  useEffect(() => {
    if (user) {
      refreshVaultData();
    }
  }, [user, selectedCategory, fromDate, toDate, isTrashView]);

  const handleLoginSuccess = (authenticatedUser: User) => {
    setUser(authenticatedUser);
    setActiveTab('dashboard');
    addToast('success', `Welcome back, ${authenticatedUser.displayName || authenticatedUser.username}! Vault unlocked.`);
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setMemories([]);
    setSelectedMemory(null);
    setActiveTab('dashboard');
    addToast('info', 'Signed out successfully.');
  };

  // Memory Created
  const handleMemoryCreated = (newMem: Memory, msg: string) => {
    addToast('success', msg);
    refreshVaultData();
    setActiveTab('memories');
    setSelectedMemory(newMem);
  };

  // Memory Updated
  const handleMemoryUpdated = (updatedMem: Memory) => {
    addToast('success', `Memory '${updatedMem.memoryId}' updated successfully.`);
    setEditingMemory(null);
    setSelectedMemory(updatedMem);
    refreshVaultData();
  };

  // Memory Deleted
  const handleMemoryDeleted = (deletedId: string) => {
    addToast('success', `Memory '${deletedId}' removed.`);
    setDeletingMemory(null);
    if (selectedMemory?.memoryId === deletedId) {
      setSelectedMemory(null);
    }
    refreshVaultData();
  };

  // Memory Restored from Trash
  const handleRestoreMemory = async (id: string) => {
    try {
      await api.restoreMemory(id);
      addToast('success', `Memory '${id}' restored to active vault.`);
      refreshVaultData();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to restore memory.');
    }
  };

  // Memory Purged permanently
  const handlePurgeMemory = (id: string) => {
    const mem = memories.find(m => m.memoryId === id);
    if (mem) {
      setDeletingMemory({ memory: mem, isPurge: true });
    }
  };

  const handleSelectCategoryFilterFromDashboard = (cat: CategoryType) => {
    setSelectedCategory(cat);
    setActiveTab('memories');
  };

  const handleSelectDateFilterFromDashboard = (dateStr: string) => {
    setFromDate(dateStr);
    setToDate(dateStr);
    setActiveTab('memories');
  };

  const handleSelectMemoryById = async (mid: string) => {
    try {
      const mem = await api.getMemory(mid);
      setSelectedMemory(mem);
    } catch {
      addToast('error', `Could not find memory ${mid}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/20 selection:text-cyan-300 flex flex-col">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Main navigation */}
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        totalMemories={memories.length}
        onLogout={handleLogout}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!user ? (
          <AuthModal
            onLoginSuccess={handleLoginSuccess}
            onError={msg => addToast('error', msg)}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                user={user}
                onNavigate={setActiveTab}
                onSelectCategoryFilter={handleSelectCategoryFilterFromDashboard}
                onSelectDateFilter={handleSelectDateFilterFromDashboard}
                onSelectMemory={mem => setSelectedMemory(mem)}
              />
            )}

            {activeTab === 'memories' && (
              <MemoriesView
                memories={memories}
                onSelectMemory={mem => setSelectedMemory(mem)}
                onAddClick={() => setActiveTab('add')}
                onEditClick={mem => setEditingMemory(mem)}
                onDeleteClick={mem => setDeletingMemory({ memory: mem, isPurge: false })}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                fromDate={fromDate}
                setFromDate={setFromDate}
                toDate={toDate}
                setToDate={setToDate}
                loading={loadingMemories}
                onRefresh={refreshVaultData}
                isTrashView={isTrashView}
                setIsTrashView={setIsTrashView}
                onRestoreMemory={handleRestoreMemory}
                onPurgeMemory={handlePurgeMemory}
              />
            )}

            {activeTab === 'gallery' && (
              <GalleryView
                onSelectMemoryById={handleSelectMemoryById}
                onNavigateAdd={() => setActiveTab('add')}
              />
            )}

            {activeTab === 'add' && (
              <AddMemoryModal
                onSuccess={handleMemoryCreated}
                onError={msg => addToast('error', msg)}
                onCancel={() => setActiveTab('memories')}
              />
            )}

            {activeTab === 'search' && (
              <SearchModal
                onSelectMemory={mem => setSelectedMemory(mem)}
                onError={msg => addToast('error', msg)}
              />
            )}

            {activeTab === 'about' && <AboutModal />}
          </>
        )}
      </main>

      {/* Memory Detail Drawer */}
      {selectedMemory && (
        <MemoryDrawer
          memory={selectedMemory}
          onClose={() => setSelectedMemory(null)}
          onEdit={mem => setEditingMemory(mem)}
          onDelete={mem => setDeletingMemory({ memory: mem, isPurge: false })}
          onSelectRelated={mem => setSelectedMemory(mem)}
          onRefresh={refreshVaultData}
        />
      )}

      {/* Edit Memory Modal */}
      {editingMemory && (
        <EditMemoryModal
          memory={editingMemory}
          onClose={() => setEditingMemory(null)}
          onSuccess={handleMemoryUpdated}
          onError={msg => addToast('error', msg)}
        />
      )}

      {/* Delete / Purge Confirmation Modal */}
      {deletingMemory && (
        <DeleteConfirmModal
          memory={deletingMemory.memory}
          isPurge={deletingMemory.isPurge}
          onClose={() => setDeletingMemory(null)}
          onDeleted={handleMemoryDeleted}
          onError={msg => addToast('error', msg)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>AI MemoVault • Secure Personal Knowledge Platform</span>
          <div className="flex items-center gap-4 text-[11px]">
            <span>SQLite WAL with Encryption at Rest</span>
            <span aria-hidden="true">·</span>
            <span>Zero External ML Libraries</span>
            <span aria-hidden="true">·</span>
            <span>Hand-Crafted Lexical Retrieval</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
