import React, { useState } from 'react';
import {
  Calendar,
  Filter,
  Search,
  Plus,
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
  Mic,
  Video,
  FileText,
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
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="glass-panel rounded-2xl p-6 border border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <span>{isTrashView ? 'Trash Bin' : 'Active Vault'}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="tabular-nums">{filtered.length} memories</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Sorted newest date first</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {isTrashView ? 'Deleted Records (Trash)' : 'Memory Records'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isTrashView
                ? 'Soft-deleted memories are preserved for 30 days before automatic purge.'
                : 'Browse, filter, and reflect on your archived thoughts, reflections, and milestones.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Switcher Segmented Control */}
            <div className="flex items-center p-1 bg-white/[0.03] border border-white/[0.07] rounded-xl shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.08]'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Grid Cards View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.08]'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Table List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-white/[0.1] text-white shadow-sm border border-white/[0.08]'
                    : 'text-slate-400 hover:text-white'
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
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isTrashView
                    ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                    : 'bg-white/[0.04] text-slate-300 border-white/[0.07] hover:border-white/[0.15]'
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
              className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:border-white/[0.15] text-slate-300 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
              title="Export complete decrypted JSON vault"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting...' : 'Export'}</span>
            </button>

            {!isTrashView && (
              <button
                type="button"
                onClick={onAddClick}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Memory</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 glass-panel p-4 rounded-2xl border border-white/[0.07] text-xs">
        {/* Live Filter Search */}
        <div className="relative">
          <label className="text-[11px] font-medium text-slate-400 mb-1.5 block">Filter Keywords</label>
          <div className="relative">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search title, content, tag..."
              className="w-full pl-8 pr-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all placeholder-slate-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1.5 block">Category</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all cursor-pointer"
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
          <label className="text-[11px] font-medium text-slate-400 mb-1.5 block">Mood State</label>
          <select
            value={moodFilter}
            onChange={(e) => setMoodFilter(e.target.value)}
            className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all cursor-pointer"
          >
            <option value="">All Moods</option>
            {MOODS.map((m) => (
              <option key={m} value={m}>
                {MOOD_EMOJIS[m]} {m.charAt(0).toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* From Date */}
        <div>
          <label className="text-[11px] font-medium text-slate-400 mb-1.5 block">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 bg-black/40 border border-white/[0.08] rounded-xl text-slate-200 text-xs focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all cursor-pointer"
          />
        </div>

        {/* Favorites Quick Toggle */}
        <div className="flex flex-col justify-end">
          <label className="text-[11px] font-medium text-slate-400 mb-1.5 block">Starred Filter</label>
          <button
            type="button"
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`w-full py-2 px-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              favoritesOnly
                ? 'bg-rose-950/60 text-rose-300 border-rose-700/60 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                : 'bg-black/40 text-slate-400 border-white/[0.08] hover:text-slate-200 hover:border-white/[0.15]'
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
            <div key={i} className="h-52 glass-panel rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
          {/* 1. GRID CARDS VIEW */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((memory) => {
                const cover = memory.attachments?.find((a) => a.mime_type.startsWith('image/'));
                const hasAudio = memory.attachments?.some((a) =>
                  a.mime_type.startsWith('audio/') ||
                  /\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(a.original_filename) ||
                  a.original_filename.toLowerCase().includes('voice')
                );

                return (
                  <div
                    key={memory.memoryId}
                    onClick={() => onSelectMemory(memory)}
                    className="glass-panel glass-panel-hover rounded-2xl overflow-hidden cursor-pointer flex flex-col justify-between group relative"
                  >
                    {/* Cover image if available */}
                    {cover && (
                      <div className="h-40 w-full overflow-hidden bg-black/60 relative">
                        <img
                          src={api.getAttachmentUrl(cover.id)}
                          alt={memory.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-transparent to-transparent opacity-60" />

                        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-10">
                          {memory.isPinned && (
                            <span className="p-1 rounded-md bg-black/70 text-cyan-300 backdrop-blur-md border border-white/10 shadow-sm">
                              <Pin className="w-3 h-3" />
                            </span>
                          )}
                          {memory.isFavorite && (
                            <span className="p-1 rounded-md bg-black/70 text-rose-400 backdrop-blur-md border border-white/10 shadow-sm">
                              <Heart className="w-3 h-3 fill-rose-400" />
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Clean unboxed metadata with separators */}
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-semibold font-mono text-[11px] ${CATEGORY_ACCENT[memory.category] || 'text-cyan-400'}`}>
                              {memory.category}
                            </span>
                            <span aria-hidden="true" className="text-slate-700">·</span>
                            <span className="text-slate-400 text-[11px]">{memory.date}</span>
                            {memory.mood && (
                              <>
                                <span aria-hidden="true" className="text-slate-700">·</span>
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
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    memory.isPinned ? 'text-cyan-400 bg-cyan-950/60' : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.05]'
                                  }`}
                                  title="Pin to top"
                                >
                                  <Pin className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleFavorite(e, memory)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    memory.isFavorite ? 'text-rose-400 bg-rose-950/60' : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.05]'
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

                        <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1 leading-snug">
                          {memory.title}
                        </h3>

                        <p className="text-xs text-slate-400 mt-1.5 line-clamp-3 leading-relaxed">
                          {memory.description}
                        </p>

                        {/* Audio Wave Indicator if memory has a voice note */}
                        {hasAudio && (
                          <div className="mt-2.5 flex items-center gap-2 p-1.5 px-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 w-fit">
                            <Mic className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="text-[10px] font-mono font-medium">Voice Memo Attached</span>
                          </div>
                        )}
                      </div>

                      {/* Footer Info: location, tags, attachments */}
                      <div className="mt-4 pt-3.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500">
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
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => onRestoreMemory && onRestoreMemory(memory.memoryId)}
                              className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 border border-emerald-800 text-[10px] font-medium cursor-pointer"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => onPurgeMemory && onPurgeMemory(memory.memoryId)}
                              className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 hover:bg-rose-900 border border-rose-800 text-[10px] font-medium cursor-pointer"
                            >
                              Purge
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-[10px] text-slate-500 group-hover:text-slate-400">
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
            <div className="glass-panel rounded-2xl overflow-hidden border border-white/[0.08]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/50 border-b border-white/[0.07] text-slate-400 text-[11px] font-mono uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 w-20">ID</th>
                      <th className="py-3 px-4 w-28">Date</th>
                      <th className="py-3 px-4 w-32">Category</th>
                      <th className="py-3 px-4">Title &amp; Summary</th>
                      <th className="py-3 px-4 w-24">Mood</th>
                      <th className="py-3 px-4 text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.map((memory) => (
                      <tr
                        key={memory.memoryId}
                        onClick={() => onSelectMemory(memory)}
                        className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
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
                          <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
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
                                className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-800 text-[10px] cursor-pointer"
                              >
                                Restore
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => onEditClick(memory)}
                                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                                title="Edit"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteClick(memory)}
                                className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
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
            <div className="relative pl-6 border-l border-white/[0.08] space-y-5">
              {filtered.map((memory) => (
                <div
                  key={memory.memoryId}
                  onClick={() => onSelectMemory(memory)}
                  className="relative group glass-panel glass-panel-hover p-4 sm:p-5 rounded-2xl cursor-pointer"
                >
                  <div className="absolute -left-[31px] top-5 w-3 h-3 rounded-full bg-cyan-400 border-2 border-[#07090E] shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{memory.date}</span>
                      <span aria-hidden="true" className="text-slate-700">·</span>
                      <span className="font-mono text-cyan-400">{memory.category}</span>
                      {memory.mood && (
                        <>
                          <span aria-hidden="true" className="text-slate-700">·</span>
                          <span>{MOOD_EMOJIS[memory.mood]}</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">{memory.memoryId}</span>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {memory.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    {memory.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="glass-panel rounded-2xl p-14 text-center border border-white/[0.08]">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Records Match Filters</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
            {memories.length === 0
              ? 'Your vault has no stored memories yet. Start documenting your journey today.'
              : 'Try clearing the search query or adjusting your category and date filters.'}
          </p>
          {!isTrashView && (
            <button
              type="button"
              onClick={onAddClick}
              className="mt-5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Record First Memory</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
