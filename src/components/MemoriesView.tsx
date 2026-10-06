import React, { useState } from 'react';
import {
  Calendar,
  Filter,
  Search,
  PlusCircle,
  LayoutGrid,
  List,
  Clock,
  Pin,
  Heart,
  Archive,
  Trash2,
  RotateCcw,
  Download,
  Smile,
  Tag as TagIcon,
  MapPin,
  Users,
  Paperclip,
  CheckCircle2,
  Flame,
} from 'lucide-react';
import { CategoryType, Memory, MoodType } from '../types';
import { api } from '../api';

interface Props {
  memories: Memory[];
  onSelectMemory: (mem: Memory) => void;
  onAddClick: () => void;
  onEditClick: (mem: Memory) => void;
  onDeleteClick: (mem: Memory) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  fromDate: string;
  setFromDate: (d: string) => void;
  toDate: string;
  setToDate: (d: string) => void;
  loading: boolean;
  onRefresh: () => void;
  isTrashView?: boolean;
  setIsTrashView?: (trash: boolean) => void;
  onRestoreMemory?: (id: string) => void;
  onPurgeMemory?: (id: string) => void;
}

const CATEGORIES: CategoryType[] = [
  'ACHIEVEMENT',
  'EVENT',
  'STUDY',
  'TRAVEL',
  'REMINDER',
  'PERSONAL',
];

const MOODS: MoodType[] = ['happy', 'proud', 'calm', 'sad', 'excited', 'neutral'];

const MOOD_EMOJIS: Record<string, string> = {
  happy: '😊',
  proud: '🏆',
  calm: '🌿',
  sad: '🌧️',
  excited: '⚡',
  neutral: '😐',
};

const CATEGORY_ACCENT: Record<string, string> = {
  ACHIEVEMENT: 'text-amber-400',
  EVENT: 'text-blue-400',
  STUDY: 'text-emerald-400',
  TRAVEL: 'text-cyan-400',
  REMINDER: 'text-orange-400',
  PERSONAL: 'text-purple-400',
};

export const MemoriesView: React.FC<Props> = ({
  memories,
  onSelectMemory,
  onAddClick,
  onEditClick,
  onDeleteClick,
  selectedCategory,
  setSelectedCategory,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  loading,
  onRefresh,
  isTrashView = false,
  setIsTrashView,
  onRestoreMemory,
  onPurgeMemory,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'timeline'>('grid');
  const [localSearch, setLocalSearch] = useState('');
  const [moodFilter, setMoodFilter] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Client-side filtering
  const filtered = memories.filter((m) => {
    if (favoritesOnly && !m.isFavorite) return false;
    if (moodFilter && m.mood !== moodFilter) return false;
    if (!localSearch.trim()) return true;
    const term = localSearch.toLowerCase();
    return (
      m.title.toLowerCase().includes(term) ||
      m.description.toLowerCase().includes(term) ||
      m.memoryId.toLowerCase().includes(term) ||
      (m.locationName && m.locationName.toLowerCase().includes(term)) ||
      m.keywords.some((k) => k.toLowerCase().includes(term)) ||
      (m.tags && m.tags.some((t) => t.name.toLowerCase().includes(term)))
    );
  });

  const handleExportJson = async () => {
    setExporting(true);
    try {
      const data = await api.exportJson();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memovault_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to export memories:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, mem: Memory) => {
    e.stopPropagation();
    try {
      await api.updateMemory(mem.memoryId, { is_favorite: !mem.isFavorite });
      onRefresh();
    } catch {}
  };

  const handleTogglePin = async (e: React.MouseEvent, mem: Memory) => {
    e.stopPropagation();
    try {
      await api.updateMemory(mem.memoryId, { is_pinned: !mem.isPinned });
      onRefresh();
    } catch {}
  };

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <span>{isTrashView ? 'Trash Bin' : 'Active Vault'}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{filtered.length} memories</span>
              <span aria-hidden="true">·</span>
              <span>Sorted newest date first</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {isTrashView ? 'Deleted Records (Trash)' : 'Memory Records'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isTrashView
                ? 'Soft-deleted memories are preserved for 30 days before automatic purge.'
                : 'Browse, filter, and reflect on your archived thoughts and milestones.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Switcher */}
            <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Table List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'timeline' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Timeline Stream View"
              >
                <Clock className="w-4 h-4" />
              </button>
            </div>

            {/* Trash Toggle */}
            {setIsTrashView && (
              <button
                type="button"
                onClick={() => setIsTrashView(!isTrashView)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  isTrashView
                    ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isTrashView ? 'Exit Trash' : 'Trash'}</span>
              </button>
            )}

            {/* Export JSON */}
            <button
              type="button"
              onClick={handleExportJson}
              disabled={exporting}
              className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium transition-colors flex items-center gap-1.5"
              title="Export complete decrypted JSON vault"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting...' : 'Export JSON'}</span>
            </button>

            {!isTrashView && (
              <button
                type="button"
                onClick={onAddClick}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Memory</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-900/40 border border-slate-800 p-4 rounded-xl text-xs">
        {/* Search */}
        <div className="relative">
          <label className="text-[11px] text-slate-400 mb-1 block">Live Filter</label>
          <div className="relative">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search title, desc, tag..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Mood */}
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">Mood</label>
          <select
            value={moodFilter}
            onChange={(e) => setMoodFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Moods</option>
            {MOODS.map((m) => (
              <option key={m} value={m}>
                {MOOD_EMOJIS[m]} {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div>
          <label className="text-[11px] text-slate-400 mb-1 block">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Quick Toggles */}
        <div className="flex flex-col justify-end">
          <label className="text-[11px] text-slate-400 mb-1 block">Quick Filter</label>
          <button
            type="button"
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`w-full py-1.5 px-3 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
              favoritesOnly
                ? 'bg-rose-950/60 text-rose-300 border-rose-800'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-rose-400 text-rose-400' : ''}`} />
            <span>Favorites Only</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          {/* 1. GRID CARDS VIEW */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((memory) => {
                const cover = memory.attachments?.find((a) => a.mime_type.startsWith('image/'));
                return (
                  <div
                    key={memory.memoryId}
                    onClick={() => onSelectMemory(memory)}
                    className="group bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl overflow-hidden transition-all cursor-pointer flex flex-col justify-between"
                  >
                    {/* Cover image if available */}
                    {cover && (
                      <div className="h-36 w-full overflow-hidden bg-slate-950 relative">
                        <img
                          src={api.getAttachmentUrl(cover.id)}
                          alt={memory.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          {memory.isPinned && (
                            <span className="p-1 rounded bg-black/60 text-cyan-300 backdrop-blur-sm">
                              <Pin className="w-3 h-3" />
                            </span>
                          )}
                          {memory.isFavorite && (
                            <span className="p-1 rounded bg-black/60 text-rose-400 backdrop-blur-sm">
                              <Heart className="w-3 h-3 fill-rose-400" />
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Clean unboxed metadata with separators */}
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono font-medium ${CATEGORY_ACCENT[memory.category] || 'text-cyan-400'}`}>
                              {memory.category}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{memory.date}</span>
                            {memory.mood && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{MOOD_EMOJIS[memory.mood]}</span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {!isTrashView && (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => handleTogglePin(e, memory)}
                                  className={`p-1 rounded hover:bg-slate-800 ${
                                    memory.isPinned ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                  title="Pin to top"
                                >
                                  <Pin className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleFavorite(e, memory)}
                                  className={`p-1 rounded hover:bg-slate-800 ${
                                    memory.isFavorite ? 'text-rose-400' : 'text-slate-500 hover:text-slate-300'
                                  }`}
                                  title="Toggle favorite"
                                >
                                  <Heart
                                    className={`w-3.5 h-3.5 ${memory.isFavorite ? 'fill-rose-400' : ''}`}
                                  />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                          {memory.title}
                        </h3>

                        <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                          {memory.description}
                        </p>
                      </div>

                      {/* Footer Info: location, tags, attachments */}
                      <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-2 truncate">
                          {memory.locationName && (
                            <span className="flex items-center gap-1 text-slate-400 truncate">
                              <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                              <span className="truncate">{memory.locationName}</span>
                            </span>
                          )}
                          {memory.attachments && memory.attachments.length > 0 && (
                            <span className="flex items-center gap-1 text-slate-400">
                              <Paperclip className="w-3 h-3 text-teal-400" />
                              <span>{memory.attachments.length}</span>
                            </span>
                          )}
                        </div>

                        {/* Trash controls or ID */}
                        {isTrashView ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => onRestoreMemory && onRestoreMemory(memory.memoryId)}
                              className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 border border-emerald-800 text-[10px]"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => onPurgeMemory && onPurgeMemory(memory.memoryId)}
                              className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 hover:bg-rose-900 border border-rose-800 text-[10px]"
                            >
                              Purge
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-slate-600 group-hover:text-slate-400">
                            {memory.memoryId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 2. COMPACT TABLE VIEW */}
          {viewMode === 'table' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px] font-mono uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-20">ID</th>
                      <th className="py-3 px-4 w-28">Date</th>
                      <th className="py-3 px-4 w-32">Category</th>
                      <th className="py-3 px-4">Title &amp; Summary</th>
                      <th className="py-3 px-4 w-24">Mood</th>
                      <th className="py-3 px-4 text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filtered.map((memory) => (
                      <tr
                        key={memory.memoryId}
                        onClick={() => onSelectMemory(memory)}
                        className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-cyan-400">
                          {memory.memoryId}
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {memory.date}
                        </td>
                        <td className="py-3 px-4 font-mono whitespace-nowrap text-slate-300">
                          {memory.category}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-white group-hover:text-cyan-300 transition-colors">
                            {memory.title}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate max-w-md mt-0.5">
                            {memory.description}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                          {memory.mood ? `${MOOD_EMOJIS[memory.mood]} ${memory.mood}` : '—'}
                        </td>
                        <td
                          className="py-3 px-4 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isTrashView ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => onRestoreMemory && onRestoreMemory(memory.memoryId)}
                                className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800 text-[10px]"
                              >
                                Restore
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => onEditClick(memory)}
                                className="p-1 text-slate-400 hover:text-white"
                                title="Edit"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteClick(memory)}
                                className="p-1 text-slate-400 hover:text-rose-400"
                                title="Delete"
                              >
                                Del
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. TIMELINE VIEW */}
          {viewMode === 'timeline' && (
            <div className="relative pl-6 border-l border-slate-800 space-y-6">
              {filtered.map((memory) => (
                <div
                  key={memory.memoryId}
                  onClick={() => onSelectMemory(memory)}
                  className="relative group bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 p-4 rounded-xl cursor-pointer transition-all"
                >
                  <div className="absolute -left-[31px] top-4 w-3 h-3 rounded-full bg-cyan-500 border-2 border-slate-950" />
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white">{memory.date}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-cyan-400">{memory.category}</span>
                      {memory.mood && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{MOOD_EMOJIS[memory.mood]}</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">{memory.memoryId}</span>
                  </div>

                  <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                    {memory.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {memory.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No Records Match Filters</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {memories.length === 0
              ? 'Your vault has no stored memories yet. Start documenting your journey.'
              : 'Try clearing the search query or adjusting your category and date filters.'}
          </p>
          {!isTrashView && (
            <button
              type="button"
              onClick={onAddClick}
              className="mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold rounded-lg transition-colors"
            >
              Add First Memory
            </button>
          )}
        </div>
      )}
    </div>
  );
};
