import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Sparkles,
  Clock,
  Filter,
  X,
  Calendar,
  Layers,
  ExternalLink,
  Folder,
  FolderOpen,
  Tag as TagIcon,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  List,
  Trophy,
  Zap,
  BookOpen,
  Plane,
  Bell,
  Heart,
  Smile,
} from 'lucide-react';
import { api } from '../api';
import { CategoryType, Memory, SearchResultItem } from '../types';
import { CategoryBadge } from './CategoryBadge';

interface Props {
  onSelectMemory: (mem: Memory) => void;
  onError: (msg: string) => void;
}

const SAMPLE_QUERIES = [
  'hackathon',
  'java collections',
  'college event',
  'family visit temple',
  'pbl review submission',
  'winning awards',
];

const CATEGORY_METADATA: Record<CategoryType, { label: string; icon: any; color: string; bg: string }> = {
  ACHIEVEMENT: {
    label: 'Achievements & Milestones',
    icon: Trophy,
    color: 'text-amber-400',
    bg: 'bg-amber-950/40 border-amber-800/40 hover:border-amber-500/60',
  },
  EVENT: {
    label: 'Events & Hackathons',
    icon: Zap,
    color: 'text-cyan-400',
    bg: 'bg-cyan-950/40 border-cyan-800/40 hover:border-cyan-500/60',
  },
  STUDY: {
    label: 'Study & Research Notes',
    icon: BookOpen,
    color: 'text-indigo-400',
    bg: 'bg-indigo-950/40 border-indigo-800/40 hover:border-indigo-500/60',
  },
  TRAVEL: {
    label: 'Travel & Trips',
    icon: Plane,
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/40 border-emerald-800/40 hover:border-emerald-500/60',
  },
  REMINDER: {
    label: 'Reminders & Deadlines',
    icon: Bell,
    color: 'text-rose-400',
    bg: 'bg-rose-950/40 border-rose-800/40 hover:border-rose-500/60',
  },
  PERSONAL: {
    label: 'Personal Reflections',
    icon: Heart,
    color: 'text-purple-400',
    bg: 'bg-purple-950/40 border-purple-800/40 hover:border-purple-500/60',
  },
};

const CATEGORIES: CategoryType[] = [
  'ACHIEVEMENT',
  'EVENT',
  'STUDY',
  'TRAVEL',
  'REMINDER',
  'PERSONAL',
];

export const SearchModal: React.FC<Props> = ({ onSelectMemory, onError }) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTagFolder, setSelectedTagFolder] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const [tokens, setTokens] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [allMemories, setAllMemories] = useState<Memory[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // View Mode: 'folders' or 'list'
  const [viewMode, setViewMode] = useState<'folders' | 'list'>('folders');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Fetch all memories on mount to compute default folder structure
  useEffect(() => {
    api.listMemories().then(mems => {
      setAllMemories(mems);
    }).catch(() => {});
  }, []);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() && !selectedCategory && !selectedTagFolder && !fromDate && !toDate) {
      setTokens([]);
      setResults([]);
      setElapsedMs(null);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    setHasSearched(true);
    try {
      const res = await api.search(searchQuery.trim(), {
        category: selectedCategory || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setTokens(res.tokens);

      // If a specific tag folder is selected, filter results
      let filtered = res.results;
      if (selectedTagFolder) {
        filtered = filtered.filter(item => {
          const tags = (item.memory as any).tags || [];
          return tags.some((t: any) => (t.name || t).toLowerCase() === selectedTagFolder.toLowerCase());
        });
      }

      setResults(filtered);
      setElapsedMs(res.elapsed_ms);
    } catch (err: any) {
      onError(err.message || 'Search execution failed.');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() || selectedCategory || selectedTagFolder || fromDate || toDate) {
        performSearch(query);
      } else {
        setTokens([]);
        setResults([]);
        setElapsedMs(null);
        setHasSearched(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selectedCategory, selectedTagFolder, fromDate, toDate]);

  // Compute matched folders from search results or overall vault
  const matchedCategoryFolders = useMemo(() => {
    const counts: Record<string, number> = {};
    const dataset = hasSearched ? results.map(r => r.memory) : allMemories;

    dataset.forEach(m => {
      counts[m.category] = (counts[m.category] || 0) + 1;
    });

    return CATEGORIES.map(cat => ({
      category: cat,
      count: counts[cat] || 0,
      meta: CATEGORY_METADATA[cat],
    })).filter(f => f.count > 0 || !hasSearched);
  }, [results, allMemories, hasSearched]);

  // Compute matched tag folders
  const matchedTagFolders = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    const dataset = hasSearched ? results.map(r => r.memory) : allMemories;

    dataset.forEach(m => {
      const tags = (m as any).tags || [];
      tags.forEach((t: any) => {
        const name = typeof t === 'string' ? t : t.name;
        if (name) {
          tagCounts[name.toLowerCase()] = (tagCounts[name.toLowerCase()] || 0) + 1;
        }
      });
    });

    return Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [results, allMemories, hasSearched]);

  // Group current search results by Category folder
  const groupedResults = useMemo(() => {
    const groups: Record<CategoryType, SearchResultItem[]> = {
      ACHIEVEMENT: [],
      EVENT: [],
      STUDY: [],
      TRAVEL: [],
      REMINDER: [],
      PERSONAL: [],
    };

    results.forEach(item => {
      if (groups[item.memory.category]) {
        groups[item.memory.category].push(item);
      }
    });

    return groups;
  }, [results]);

  const toggleFolderCollapse = (cat: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const highlightTokens = (text: string, queryTokens: string[]) => {
    if (!text || queryTokens.length === 0) return text;
    const escaped = queryTokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    if (!escaped) return text;
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => {
      const isMatch = queryTokens.some(t => t.toLowerCase() === part.toLowerCase());
      return isMatch ? (
        <mark
          key={i}
          className="bg-cyan-400/25 text-cyan-200 px-0.5 rounded font-bold"
        >
          {part}
        </mark>
      ) : (
        part
      );
    });
  };

  const handleSelectFolder = (cat: CategoryType) => {
    if (selectedCategory === cat) {
      setSelectedCategory('');
    } else {
      setSelectedCategory(cat);
    }
  };

  const handleSelectTagFolder = (tagName: string) => {
    if (selectedTagFolder === tagName) {
      setSelectedTagFolder('');
    } else {
      setSelectedTagFolder(tagName);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Search Bar Card */}
      <div className="bg-slate-900/90 border border-cyan-900/50 rounded-xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800 mb-4">
          <div>
            <h2 className="text-lg font-bold font-mono text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-400" />
              <span>Lexical Inverted Index Smart Search</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Retrieve scattered records & matching category folders by partial phrases, keywords, or topics.
            </p>
          </div>
          {elapsedMs !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-mono text-xs self-start sm:self-auto">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Search: <strong>{elapsedMs.toFixed(2)} ms</strong></span>
            </div>
          )}
        </div>

        {/* Input box */}
        <div className="relative mb-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search keywords, events, or topics (e.g. 'hackathon', 'java', 'award winning')..."
            className="w-full pl-11 pr-10 py-3.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono transition-colors shadow-inner"
            autoFocus
          />
          <Search className="w-5 h-5 text-cyan-400 absolute left-3.5 top-3.5 pointer-events-none" />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sample Query Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-mono">
          <span className="text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Try sample queries:</span>
          </span>
          {SAMPLE_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => setQuery(q)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
            >
              &quot;{q}&quot;
            </button>
          ))}
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800/80 font-mono text-xs">
          <div>
            <label className="text-[11px] text-slate-400 mb-1 block flex items-center gap-1">
              <Filter className="w-3 h-3 text-cyan-400" />
              <span>Category Folder</span>
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              aria-label="Category Filter"
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            >
              <option value="">All Category Folders</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  📁 {CATEGORY_METADATA[c].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block flex items-center gap-1">
              <Calendar className="w-3 h-3 text-cyan-400" />
              <span>From Date</span>
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              aria-label="From Date"
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 mb-1 block flex items-center gap-1">
              <Calendar className="w-3 h-3 text-cyan-400" />
              <span>To Date</span>
            </label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              aria-label="To Date"
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Token Extraction Banner */}
        {tokens.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-cyan-950 flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Extracted Query Tokens:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {tokens.map(token => (
                <span
                  key={token}
                  className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold text-[11px]"
                >
                  [{token}]
                </span>
              ))}
            </div>
            <span className="text-[10px] text-slate-500 ml-auto">
              Scored against Body, Title, Categories & Tag Folders
            </span>
          </div>
        )}
      </div>

      {/* MATCHED FOLDERS SECTION (Requested by User) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold font-mono text-white">
              {hasSearched ? 'Matched Memory Folders' : 'Explore Vault Folders'}
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              ({matchedCategoryFolders.filter(f => f.count > 0).length} category folders)
            </span>
          </div>

          {/* View mode toggle */}
          {results.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('folders')}
                className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-colors ${
                  viewMode === 'folders'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Folder View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded text-xs font-mono flex items-center gap-1.5 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Ranked List</span>
              </button>
            </div>
          )}
        </div>

        {/* Category Folders Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {matchedCategoryFolders.map(({ category, count, meta }) => {
            const Icon = meta.icon;
            const isSelected = selectedCategory === category;
            const hasMatches = count > 0;

            return (
              <button
                key={category}
                type="button"
                onClick={() => handleSelectFolder(category)}
                className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-950/80 border-cyan-400 ring-2 ring-cyan-500/30'
                    : hasMatches
                    ? `${meta.bg} shadow-md`
                    : 'bg-slate-900/40 border-slate-800/60 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-1.5 rounded-lg bg-slate-950/70 ${meta.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[11px] font-mono px-1.5 py-0.5 rounded font-bold ${
                      hasMatches
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </div>

                <div className="font-mono text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                  {meta.label.split(' ')[0]}
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                  {category}
                </div>

                {isSelected && (
                  <div className="absolute top-1 right-1 text-cyan-400 text-[10px]">
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Tag Folders Ribbon if any */}
        {matchedTagFolders.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
              <TagIcon className="w-3 h-3 text-teal-400" />
              <span>Tag Folders:</span>
            </span>
            {matchedTagFolders.slice(0, 8).map(({ name, count }) => {
              const isSelected = selectedTagFolder === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelectTagFolder(name)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-teal-950 text-teal-300 border-teal-400 ring-1 ring-teal-400/50'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
                  }`}
                >
                  <span>#{name}</span>
                  <span className="text-[10px] text-slate-500 bg-slate-950 px-1 rounded">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* RESULTS DISPLAY SECTION */}
      <div className="space-y-4 pt-2">
        {hasSearched && (
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
            <span>
              Search Results: <strong className="text-white">{results.length}</strong> record(s) ranked
              {selectedCategory && <span> in <strong>{selectedCategory}</strong></span>}
              {selectedTagFolder && <span> tagged <strong>#{selectedTagFolder}</strong></span>}
            </span>
            {tokens.length === 0 && query.trim() && (
              <span className="text-amber-400">
                Notice: Query tokens were identified as common stop words.
              </span>
            )}
          </div>
        )}

        {/* MODE A: FOLDERS VIEW (Grouped by Category Folders) */}
        {results.length > 0 && viewMode === 'folders' && (
          <div className="space-y-4">
            {CATEGORIES.map(cat => {
              const items = groupedResults[cat];
              if (!items || items.length === 0) return null;

              const meta = CATEGORY_METADATA[cat];
              const Icon = meta.icon;
              const isCollapsed = collapsedFolders[cat];

              return (
                <div
                  key={cat}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-lg transition-all"
                >
                  {/* Folder Header */}
                  <div
                    onClick={() => toggleFolderCollapse(cat)}
                    className="p-4 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-850 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg bg-slate-950 ${meta.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold font-mono text-white">
                            📁 {meta.label}
                          </h4>
                          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                            {items.length} {items.length === 1 ? 'memory' : 'memories'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Category Folder: {cat}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="text-xs font-mono text-slate-500">
                        {isCollapsed ? 'Expand' : 'Collapse'}
                      </span>
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {/* Folder Contents */}
                  {!isCollapsed && (
                    <div className="p-4 grid grid-cols-1 gap-3 bg-slate-950/40">
                      {items.map(({ memory, score }) => (
                        <div
                          key={memory.memoryId}
                          onClick={() => onSelectMemory(memory)}
                          className="p-4 rounded-xl bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/60 transition-all cursor-pointer shadow group relative"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 font-mono">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                                {memory.memoryId}
                              </span>
                              <CategoryBadge category={memory.category} size="md" />
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-cyan-400" />
                                <span>{memory.date}</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-0.5 rounded border border-slate-800">
                              <span className="text-[10px] text-slate-400 uppercase font-mono">
                                Match Score:
                              </span>
                              <span className="text-xs font-bold text-cyan-300 font-mono">
                                {score.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          <h3 className="text-sm font-bold font-mono text-white group-hover:text-cyan-300 transition-colors mb-1.5">
                            {highlightTokens(memory.title, tokens)}
                          </h3>

                          <p className="text-xs text-slate-300 font-mono leading-relaxed line-clamp-2 mb-3">
                            {highlightTokens(memory.description, tokens)}
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 font-mono text-[11px]">
                            <div className="flex flex-wrap gap-1">
                              {memory.keywords.slice(0, 5).map(kw => (
                                <span
                                  key={kw}
                                  className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800"
                                >
                                  #{kw}
                                </span>
                              ))}
                            </div>
                            <span className="text-slate-400 group-hover:text-cyan-400 transition-colors flex items-center gap-1">
                              <span>Open Record</span>
                              <ExternalLink className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* MODE B: FLAT RANKED LIST VIEW */}
        {results.length > 0 && viewMode === 'list' && (
          <div className="grid grid-cols-1 gap-3">
            {results.map(({ memory, score }) => {
              const scorePercent = Math.min(Math.round(score * 100), 100);

              return (
                <div
                  key={memory.memoryId}
                  onClick={() => onSelectMemory(memory)}
                  className="p-5 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer shadow-lg group relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                        {memory.memoryId}
                      </span>
                      <CategoryBadge category={memory.category} size="md" />
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-cyan-400" />
                        <span>{memory.date}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-950 px-3 py-1 rounded border border-slate-800">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Relevance Score
                        </span>
                        <span className="text-xs font-bold text-cyan-300 font-mono">
                          {score.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                        <div
                          className="bg-gradient-to-r from-teal-500 to-cyan-400 h-full rounded-full transition-all"
                          style={{ width: `${Math.max(scorePercent, 8)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <h3 className="text-base font-bold font-mono text-white group-hover:text-cyan-300 transition-colors mb-2">
                    {highlightTokens(memory.title, tokens)}
                  </h3>

                  <p className="text-xs text-slate-300 font-mono leading-relaxed line-clamp-3 mb-3">
                    {highlightTokens(memory.description, tokens)}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 font-mono text-[11px]">
                    <div className="flex flex-wrap gap-1">
                      {memory.keywords.map(kw => (
                        <span
                          key={kw}
                          className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                    <span className="text-slate-500 group-hover:text-cyan-400 transition-colors flex items-center gap-1">
                      <span>View in Drawer</span>
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty States */}
        {results.length === 0 && hasSearched && !searching ? (
          <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-800 font-mono">
            <Search className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-300 mb-1">
              Zero Lexical Matches Found
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No memory records or folders matched candidate posting sets. Try different keywords or click on any of the category folders above to explore.
            </p>
          </div>
        ) : results.length === 0 && !hasSearched && (
          <div className="p-8 text-center rounded-xl bg-slate-900/30 border border-slate-800/60 font-mono text-xs text-slate-400">
            Click on any folder above or type a search query to search across all encrypted personal records.
          </div>
        )}
      </div>
    </div>
  );
};
