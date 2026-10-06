import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  Clock,
  Filter,
  X,
  Calendar,
  Layers,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { api } from '../api';
import { CategoryType, Memory, SearchResultItem } from '../types';
import { CategoryBadge } from './CategoryBadge';

interface Props {
  onSelectMemory: (mem: Memory) => void;
  onError: (msg: string) => void;
}

const SAMPLE_QUERIES = [
  'show my hackathon achievements',
  'java collections and unit study',
  'family visit temple',
  'pbl review deadline tomorrow',
  'coding club build night',
];

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
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const [tokens, setTokens] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
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
      setResults(res.results);
      setElapsedMs(res.elapsed_ms);
    } catch (err: any) {
      onError(err.message || 'Search execution failed.');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        performSearch(query);
      } else {
        setTokens([]);
        setResults([]);
        setElapsedMs(null);
        setHasSearched(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedCategory, fromDate, toDate]);

  const highlightTokens = (text: string, queryTokens: string[]) => {
    if (!text || queryTokens.length === 0) return text;
    // Create regex matching any of the query tokens
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

  return (
    <div className="space-y-6">
      {/* Top Search Bar Card */}
      <div className="bg-slate-900/90 border border-cyan-900/50 rounded-xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div>
            <h2 className="text-lg font-bold font-mono text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-400" />
              <span>Lexical Inverted Index Smart Search</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Retrieve scattered records by typing partial phrases, keywords, or natural questions.
            </p>
          </div>
          {elapsedMs !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-mono text-xs">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Search completed in <strong>{elapsedMs.toFixed(2)} ms</strong></span>
            </div>
          )}
        </div>

        {/* Input box */}
        <div className="relative mb-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search records (e.g. 'show my hackathon achievements' or 'java collections')..."
            className="w-full pl-11 pr-10 py-3.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono transition-colors shadow-inner"
            autoFocus
          />
          <Search className="w-5 h-5 text-cyan-400 absolute left-3.5 top-3.5 pointer-events-none" />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white"
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
              <span>Category Filter</span>
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              aria-label="Category Filter"
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
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

        {/* Token Extraction & Stop-word Transparency Banner */}
        {tokens.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-cyan-950 flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Query tokens after stop-word removal:</span>
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
              Weighted relevance formula: 0.50*body + 0.30*title + 0.20*category
            </span>
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className="space-y-3">
        {hasSearched && (
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
            <span>
              Search Results: <strong className="text-white">{results.length}</strong> record(s) ranked
            </span>
            {tokens.length === 0 && query.trim() && (
              <span className="text-amber-400">
                Notice: All input terms were identified as stop words.
              </span>
            )}
          </div>
        )}

        {results.length > 0 ? (
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

                    {/* Relevance Score Display & Bar */}
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

                  {/* Title with highlighted match */}
                  <h3 className="text-base font-bold font-mono text-white group-hover:text-cyan-300 transition-colors mb-2">
                    {highlightTokens(memory.title, tokens)}
                  </h3>

                  {/* Description with highlighted match */}
                  <p className="text-xs text-slate-300 font-mono leading-relaxed line-clamp-3 mb-3">
                    {highlightTokens(memory.description, tokens)}
                  </p>

                  {/* Keywords */}
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
        ) : hasSearched && !searching ? (
          <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-800 font-mono">
            <Search className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-300 mb-1">
              Zero Lexical Matches Found
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              No memory records matched candidate posting sets. Note honest limitation: search is strictly lexical, not semantic. Try synonyms or individual keywords.
            </p>
          </div>
        ) : (
          <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800/60 font-mono text-xs text-slate-500">
            Type any phrase above to evaluate query tokens against the in-memory inverted index.
          </div>
        )}
      </div>
    </div>
  );
};
