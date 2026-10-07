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
  Mic,
  Video,
  Image as ImageIcon,
  FileText,
  Volume2,
  Film,
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

const CATEGORY_KEYWORDS: Record<CategoryType, string[]> = {
  ACHIEVEMENT: [
    'achievement', 'achievements', 'award', 'awards', 'winner', 'winning', 'win', 'won', 'prize', 'prizes',
    'certificate', 'certificates', 'trophy', 'trophies', 'rank', 'first', '1st', 'milestone', 'milestones',
    'honor', 'honors', 'medal', 'medals', 'victory', 'champion', 'success', 'successful', 'proud',
    'accomplishment', 'accomplishments', 'scored', 'grade', 'passed', 'graduate', 'graduation', 'promotion',
    'cleared', 'topper', 'gold', 'silver', 'bronze', 'recognize', 'recognition', 'congratulations', 'merit',
  ],
  EVENT: [
    'event', 'events', 'hackathon', 'hackathons', 'fest', 'festival', 'festivals', 'symposium', 'conference',
    'conferences', 'workshop', 'workshops', 'competition', 'competitions', 'meetup', 'meetups', 'party',
    'parties', 'ceremony', 'gathering', 'gatherings', 'show', 'shows', 'exhibition', 'exhibitions', 'summit',
    'summits', 'celebration', 'celebrations', 'seminar', 'webinar', 'hack', 'showcase', 'stage', 'contest',
    'contests', 'fair', 'techfest', 'cultural', 'session', 'annual', 'meet',
  ],
  STUDY: [
    'study', 'studying', 'studies', 'research', 'notes', 'note', 'java', 'python', 'c++', 'javascript',
    'typescript', 'code', 'coding', 'program', 'programming', 'algorithm', 'algorithms', 'exam', 'exams',
    'test', 'tests', 'class', 'classes', 'college', 'campus', 'subject', 'subjects', 'lecture', 'lectures',
    'assignment', 'assignments', 'pbl', 'review', 'book', 'books', 'semester', 'academic', 'academics',
    'library', 'project', 'projects', 'course', 'courses', 'homework', 'syllabus', 'tutorial', 'tutorials',
    'learn', 'learning', 'school', 'university', 'btech', 'degree', 'presentation', 'math', 'science',
  ],
  TRAVEL: [
    'travel', 'travels', 'traveling', 'travelled', 'trip', 'trips', 'temple', 'temples', 'visit', 'visited',
    'visiting', 'flight', 'flights', 'train', 'trains', 'journey', 'journeys', 'vacation', 'vacations',
    'tour', 'tours', 'tourism', 'beach', 'beaches', 'hotel', 'hotels', 'city', 'cities', 'hills',
    'mountain', 'mountains', 'roadtrip', 'resort', 'resorts', 'sightseeing', 'drive', 'station', 'holiday',
    'holidays', 'nature', 'explore', 'exploring', 'darshan', 'shrine', 'monument', 'lake', 'sea', 'place',
  ],
  REMINDER: [
    'reminder', 'reminders', 'remind', 'deadline', 'deadlines', 'task', 'tasks', 'due', 'todo', 'todos',
    'submit', 'submission', 'submissions', 'schedule', 'scheduled', 'alert', 'alerts', 'urgent', 'calendar',
    'appointment', 'appointments', 'pay', 'bill', 'meeting', 'meetings', 'date', 'renew', 'pending', 'followup',
  ],
  PERSONAL: [
    'personal', 'family', 'friend', 'friends', 'reflection', 'reflections', 'thought', 'thoughts', 'diary',
    'health', 'fitness', 'home', 'life', 'feeling', 'feelings', 'relationship', 'relationships', 'memory',
    'memories', 'love', 'mom', 'dad', 'brother', 'sister', 'kid', 'kids', 'child', 'children', 'happy',
    'happiness', 'sad', 'secret', 'private', 'self', 'journal', 'mood', 'emotion', 'emotions', 'heart',
  ],
};

interface MediaFolderDef {
  id: string;
  label: string;
  icon: any;
  color: string;
  bg: string;
  keywords: string[];
  filter: (m: Memory) => boolean;
}

const MEDIA_FOLDERS: MediaFolderDef[] = [
  {
    id: 'voice',
    label: 'Voice Notes & Audio',
    icon: Mic,
    color: 'text-amber-400',
    bg: 'bg-amber-950/40 border-amber-800/40 hover:border-amber-500/60',
    keywords: [
      'voice', 'voices', 'audio', 'sound', 'sounds', 'record', 'recorded', 'recording', 'recordings',
      'mic', 'microphone', 'memo', 'memos', 'speech', 'listen', 'listening', 'hear', 'hearing',
      'song', 'songs', 'music', 'mp3', 'wav', 'm4a', 'aac', 'ogg', 'voicenote', 'voicenotes', 'faya', 'kun',
    ],
    filter: (m: Memory) =>
      Boolean(
        (m.attachments || []).some(
          (a) =>
            a.mime_type.startsWith('audio/') ||
            /\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(a.original_filename)
        )
      ),
  },
  {
    id: 'video',
    label: 'Video Memories Vault',
    icon: Video,
    color: 'text-indigo-400',
    bg: 'bg-indigo-950/40 border-indigo-800/40 hover:border-indigo-500/60',
    keywords: [
      'video', 'videos', 'vid', 'vids', 'clip', 'clips', 'film', 'films', 'movie', 'movies',
      'record', 'recording', 'recordings', 'camera', 'footage', 'vlog', 'vlogs', 'mp4', 'mov', 'webm',
      'capture', 'reel', 'reels', 'screen', 'shot',
    ],
    filter: (m: Memory) =>
      Boolean(
        (m.attachments || []).some(
          (a) =>
            a.mime_type.startsWith('video/') ||
            /\.(mp4|mov|webm|mkv|avi)$/i.test(a.original_filename)
        )
      ),
  },
  {
    id: 'photo',
    label: 'Photo & Picture Vault',
    icon: ImageIcon,
    color: 'text-emerald-400',
    bg: 'bg-emerald-950/40 border-emerald-800/40 hover:border-emerald-500/60',
    keywords: [
      'photo', 'photos', 'picture', 'pictures', 'image', 'images', 'pic', 'pics', 'camera',
      'snap', 'snaps', 'snapshot', 'gallery', 'jpeg', 'jpg', 'png', 'selfie', 'selfies',
    ],
    filter: (m: Memory) =>
      Boolean(
        (m.attachments || []).some(
          (a) =>
            a.mime_type.startsWith('image/') ||
            /\.(jpe?g|png|gif|webp|svg)$/i.test(a.original_filename)
        )
      ),
  },
  {
    id: 'document',
    label: 'Documents & PDFs',
    icon: FileText,
    color: 'text-cyan-400',
    bg: 'bg-cyan-950/40 border-cyan-800/40 hover:border-cyan-500/60',
    keywords: [
      'doc', 'docs', 'document', 'documents', 'pdf', 'pdfs', 'file', 'files', 'paper', 'papers',
      'certificate', 'certificates', 'report', 'reports', 'sheet', 'sheets',
    ],
    filter: (m: Memory) =>
      Boolean(
        (m.attachments || []).some(
          (a) =>
            a.mime_type === 'application/pdf' ||
            /\.(pdf|txt|docx?)$/i.test(a.original_filename)
        )
      ),
  },
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
  const [selectedMediaFolder, setSelectedMediaFolder] = useState<string>('');
  const [selectedTagFolder, setSelectedTagFolder] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const [tokens, setTokens] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [allMemories, setAllMemories] = useState<Memory[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showAllFolders, setShowAllFolders] = useState(false);

  // View Mode: 'folders' or 'list'
  const [viewMode, setViewMode] = useState<'folders' | 'list'>('folders');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setShowAllFolders(false);
  }, [query]);

  // Fetch all memories on mount to compute default folder structure
  useEffect(() => {
    api.listMemories().then(mems => {
      setAllMemories(mems);
    }).catch(() => {});
  }, []);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim() && !selectedCategory && !selectedMediaFolder && !selectedTagFolder && !fromDate && !toDate) {
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

      let filtered = res.results;

      // Filter by tag folder if chosen
      if (selectedTagFolder) {
        filtered = filtered.filter(item => {
          const tags = (item.memory as any).tags || [];
          return tags.some((t: any) => (t.name || t).toLowerCase() === selectedTagFolder.toLowerCase());
        });
      }

      // Filter by media folder if chosen
      if (selectedMediaFolder) {
        const mediaDef = MEDIA_FOLDERS.find(f => f.id === selectedMediaFolder);
        if (mediaDef) {
          filtered = filtered.filter(item => mediaDef.filter(item.memory));
        }
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
      if (query.trim() || selectedCategory || selectedMediaFolder || selectedTagFolder || fromDate || toDate) {
        performSearch(query);
      } else {
        setTokens([]);
        setResults([]);
        setElapsedMs(null);
        setHasSearched(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, selectedCategory, selectedMediaFolder, selectedTagFolder, fromDate, toDate]);

  // Compute matched folders from search results or overall vault based on query words
  const matchedCategoryFolders = useMemo(() => {
    const counts: Record<string, number> = {};
    const dataset = hasSearched ? results.map(r => r.memory) : allMemories;

    dataset.forEach(m => {
      counts[m.category] = (counts[m.category] || 0) + 1;
    });

    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(Boolean);

    return CATEGORIES.map(cat => {
      const relatedKeywords = CATEGORY_KEYWORDS[cat] || [];
      let matchedWord = '';
      const isWordMatch = queryWords.some(w => {
        if (w.length < 2) return false;
        if (cat.toLowerCase().includes(w) || w.includes(cat.toLowerCase())) {
          matchedWord = cat.toLowerCase();
          return true;
        }
        const kwMatch = relatedKeywords.find(kw => kw.includes(w) || w.includes(kw));
        if (kwMatch) {
          matchedWord = kwMatch;
          return true;
        }
        return false;
      });

      return {
        category: cat,
        count: counts[cat] || 0,
        meta: CATEGORY_METADATA[cat],
        isWordMatch,
        matchedWord,
      };
    }).sort((a, b) => {
      if (a.isWordMatch && !b.isWordMatch) return -1;
      if (!a.isWordMatch && b.isWordMatch) return 1;
      return b.count - a.count;
    });
  }, [results, allMemories, hasSearched, query]);

  // Compute matched Media Vault Folders (Voice Notes, Videos, Photos)
  const matchedMediaFolders = useMemo(() => {
    const dataset = hasSearched ? results.map(r => r.memory) : allMemories;
    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(Boolean);

    return MEDIA_FOLDERS.map(folder => {
      const count = dataset.filter(m => folder.filter(m)).length;
      let matchedWord = '';
      const isWordMatch = queryWords.some(w => {
        if (w.length < 2) return false;
        const kwMatch = folder.keywords.find(kw => kw.includes(w) || w.includes(kw));
        if (kwMatch) {
          matchedWord = kwMatch;
          return true;
        }
        return false;
      });

      return {
        ...folder,
        count,
        isWordMatch,
        matchedWord,
      };
    }).filter(f => f.count > 0 || f.isWordMatch || !hasSearched);
  }, [results, allMemories, hasSearched, query]);

  // Compute matched tag folders
  const matchedTagFolders = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    const dataset = hasSearched ? results.map(r => r.memory) : allMemories;
    const queryLower = query.toLowerCase().trim();

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
      .map(([name, count]) => ({
        name,
        count,
        isWordMatch: queryLower ? name.includes(queryLower) || queryLower.includes(name) : false,
      }))
      .sort((a, b) => {
        if (a.isWordMatch && !b.isWordMatch) return -1;
        if (!a.isWordMatch && b.isWordMatch) return 1;
        return b.count - a.count;
      });
  }, [results, allMemories, hasSearched, query]);

  const isSearching = Boolean(hasSearched && query.trim());

  // Filter folders to ONLY show matched folders when searching based on related words!
  const displayCategoryFolders = useMemo(() => {
    if (!isSearching || showAllFolders) {
      return matchedCategoryFolders;
    }
    const filtered = matchedCategoryFolders.filter(f => f.isWordMatch || f.count > 0);
    return filtered.length > 0 ? filtered : matchedCategoryFolders;
  }, [matchedCategoryFolders, isSearching, showAllFolders]);

  const displayMediaFolders = useMemo(() => {
    if (!isSearching || showAllFolders) {
      return matchedMediaFolders;
    }
    const filtered = matchedMediaFolders.filter(f => f.isWordMatch || f.count > 0);
    return filtered.length > 0 ? filtered : matchedMediaFolders.filter(f => f.count > 0);
  }, [matchedMediaFolders, isSearching, showAllFolders]);

  const displayTagFolders = useMemo(() => {
    if (!isSearching || showAllFolders) {
      return matchedTagFolders;
    }
    const filtered = matchedTagFolders.filter(f => f.isWordMatch || f.count > 0);
    return filtered.length > 0 ? filtered : matchedTagFolders;
  }, [matchedTagFolders, isSearching, showAllFolders]);

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
      <div className="glass-panel rounded-2xl p-6 sm:p-7 border border-white/[0.08] shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06] mb-5">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 tracking-tight">
              <Search className="w-5 h-5 text-cyan-400" />
              <span>Smart Search &amp; Folder Retrieval</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Retrieve scattered records and matching topic folders by phrases, keywords, attachments, or audio files.
            </p>
          </div>
          {elapsedMs !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 font-mono text-xs self-start sm:self-auto shadow-sm">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Search: <strong>{elapsedMs.toFixed(2)} ms</strong></span>
            </div>
          )}
        </div>

        {/* Command Palette Input Box */}
        <div className="relative mb-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search keywords, reflections, people, or folders (e.g. 'hackathon', 'java', 'award')..."
            className="w-full pl-12 pr-12 py-3.5 bg-black/50 border border-white/[0.12] rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all shadow-inner"
            autoFocus
          />
          <Search className="w-5 h-5 text-cyan-400 absolute left-4 top-3.5 pointer-events-none" />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-3.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold font-mono text-white">
              {isSearching ? `Matched Folders for "${query}"` : 'Explore Vault Folders'}
            </h3>
            <span className="text-[11px] text-cyan-400 font-mono">
              ({displayCategoryFolders.length} category{displayCategoryFolders.length === 1 ? '' : 's'}
              {displayMediaFolders.length > 0 ? `, ${displayMediaFolders.length} media folder${displayMediaFolders.length === 1 ? '' : 's'}` : ''})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isSearching && (
              <button
                type="button"
                onClick={() => setShowAllFolders(!showAllFolders)}
                className="px-2.5 py-1 text-[11px] font-mono rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              >
                {showAllFolders ? 'Filter to Matched Folders Only' : 'Show All 6 Vault Folders'}
              </button>
            )}

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
        </div>

        {/* Active Filter Pills if any */}
        {(selectedCategory || selectedMediaFolder || selectedTagFolder) && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-xs font-mono">
            <span className="text-cyan-300 font-bold">Active Folder Filter:</span>
            {selectedCategory && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-900/80 text-cyan-200 border border-cyan-700">
                <span>📁 {CATEGORY_METADATA[selectedCategory as CategoryType]?.label || selectedCategory}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('')}
                  className="hover:text-white cursor-pointer"
                  title="Remove category filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedMediaFolder && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-900/80 text-indigo-200 border border-indigo-700">
                <span>📁 {MEDIA_FOLDERS.find(f => f.id === selectedMediaFolder)?.label}</span>
                <button
                  type="button"
                  onClick={() => setSelectedMediaFolder('')}
                  className="hover:text-white cursor-pointer"
                  title="Remove media filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedTagFolder && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-900/80 text-teal-200 border border-teal-700">
                <span>🏷️ #{selectedTagFolder}</span>
                <button
                  type="button"
                  onClick={() => setSelectedTagFolder('')}
                  className="hover:text-white cursor-pointer"
                  title="Remove tag filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('');
                setSelectedMediaFolder('');
                setSelectedTagFolder('');
              }}
              className="ml-auto text-[11px] text-cyan-400 hover:text-white underline cursor-pointer"
            >
              Clear All Folder Filters
            </button>
          </div>
        )}

        {/* 1. Category Folders Grid - Displays ONLY matching folders when search words match */}
        {displayCategoryFolders.length > 0 && (
          <div>
            <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Folder className="w-3 h-3 text-cyan-400" />
                <span>
                  {isSearching && !showAllFolders
                    ? `Matched Category Folders for "${query}":`
                    : 'Category Knowledge Folders:'}
                </span>
              </span>
              {isSearching && (
                <span className="text-cyan-400 text-[10px]">
                  {displayCategoryFolders.length} matching folder{displayCategoryFolders.length === 1 ? '' : 's'} displayed
                </span>
              )}
            </div>
            <div className={`grid gap-3 ${
              displayCategoryFolders.length === 1
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                : displayCategoryFolders.length === 2
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2'
                : displayCategoryFolders.length <= 4
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
            }`}>
              {displayCategoryFolders.map(({ category, count, meta, isWordMatch, matchedWord }) => {
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
                        ? 'bg-cyan-950/90 border-cyan-400 ring-2 ring-cyan-500/50 shadow-xl'
                        : isWordMatch
                        ? 'bg-cyan-950/70 border-cyan-400 ring-1 ring-cyan-400/60 shadow-lg'
                        : hasMatches
                        ? `${meta.bg} shadow-md`
                        : 'bg-slate-900/40 border-slate-800/60 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-lg bg-slate-950/80 ${meta.color} shadow-inner`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold ${
                          hasMatches || isWordMatch
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/80 shadow-sm'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {count} {count === 1 ? 'record' : 'records'}
                      </span>
                    </div>

                    <div className="font-mono text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                      {meta.label}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono truncate mt-0.5">
                      📁 Folder: {category}
                    </div>

                    {isWordMatch && (
                      <div className="mt-2 text-[10px] font-mono text-cyan-300 font-bold flex items-center gap-1 bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.5 rounded w-fit">
                        <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate">
                          Related word: &quot;{matchedWord || query}&quot;
                        </span>
                      </div>
                    )}

                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 text-cyan-400 text-xs font-bold bg-cyan-950 px-1 rounded border border-cyan-700">
                        ✓ ACTIVE
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Media Vault Folders (Voice Notes, Videos, Photos) */}
        {displayMediaFolders.length > 0 && (
          <div className="pt-1">
            <div className="text-[11px] font-mono text-slate-400 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FolderOpen className="w-3 h-3 text-amber-400" />
                <span>
                  {isSearching && !showAllFolders
                    ? `Matched Media Vault Folders for "${query}":`
                    : 'Media & Recording Vault Folders:'}
                </span>
              </span>
              <span className="text-[10px] text-slate-500">
                Voice recordings, video footage &amp; gallery items
              </span>
            </div>
            <div className={`grid gap-3 ${
              displayMediaFolders.length === 1
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                : displayMediaFolders.length === 2
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-2 sm:grid-cols-4'
            }`}>
              {displayMediaFolders.map((mf) => {
                const Icon = mf.icon;
                const isSelected = selectedMediaFolder === mf.id;

                return (
                  <button
                    key={mf.id}
                    type="button"
                    onClick={() => {
                      setSelectedMediaFolder(prev => prev === mf.id ? '' : mf.id);
                    }}
                    className={`p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                      isSelected
                        ? 'bg-amber-950/90 border-amber-400 ring-2 ring-amber-500/50 shadow-xl'
                        : mf.isWordMatch
                        ? 'bg-amber-950/70 border-amber-400 ring-1 ring-amber-400/60 shadow-lg'
                        : mf.count > 0
                        ? `${mf.bg} shadow-md`
                        : 'bg-slate-900/40 border-slate-800/60 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-lg bg-slate-950/80 ${mf.color} shadow-inner`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded font-bold bg-slate-950 text-slate-300 border border-slate-800">
                        {mf.count} item{mf.count === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="font-mono text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                      {mf.label}
                    </div>

                    {mf.isWordMatch && (
                      <div className="mt-2 text-[10px] font-mono text-amber-300 font-bold flex items-center gap-1 bg-amber-950/80 border border-amber-800/60 px-1.5 py-0.5 rounded w-fit">
                        <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">Related: &quot;{mf.matchedWord || query}&quot;</span>
                      </div>
                    )}

                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 text-amber-400 text-xs font-bold bg-amber-950 px-1 rounded border border-amber-700">
                        ✓ ACTIVE
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Tag & Topic Folders Ribbon */}
        {displayTagFolders.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/60 mt-2">
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
              <TagIcon className="w-3 h-3 text-teal-400" />
              <span>
                {isSearching && !showAllFolders ? 'Matched Topic Folders:' : 'Topic Folders:'}
              </span>
            </span>
            {displayTagFolders.slice(0, 12).map(({ name, count, isWordMatch }) => {
              const isSelected = selectedTagFolder === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelectTagFolder(name)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-teal-950 text-teal-300 border-teal-400 ring-1 ring-teal-400/50'
                      : isWordMatch
                      ? 'bg-teal-950/80 text-teal-200 border-teal-500/80 ring-1 ring-teal-500/40 font-bold'
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
              {selectedCategory && <span> in <strong>{selectedCategory}</strong> folder</span>}
              {selectedMediaFolder && <span> in <strong>{MEDIA_FOLDERS.find(f => f.id === selectedMediaFolder)?.label}</strong></span>}
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
