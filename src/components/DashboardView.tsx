import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Sparkles,
  TrendingUp,
  Flame,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Search,
  ArrowRight,
  Smile,
  Heart,
  Image as ImageIcon,
  ChevronRight,
  Tag as TagIcon,
  RefreshCw,
  Bell,
  Archive,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { api } from '../api';
import {
  CategoryType,
  DashboardSummary,
  Memory,
  MoodType,
  User,
} from '../types';

interface Props {
  user: User;
  onNavigate: (tab: 'dashboard' | 'memories' | 'gallery' | 'add' | 'search' | 'about' | 'trash') => void;
  onSelectCategoryFilter: (cat: CategoryType) => void;
  onSelectDateFilter: (dateStr: string) => void;
  onSelectMemory: (mem: Memory) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  ACHIEVEMENT: '#eab308', // Amber/Gold
  EVENT: '#3b82f6',       // Blue
  STUDY: '#10b981',       // Emerald
  TRAVEL: '#06b6d4',       // Cyan
  REMINDER: '#f97316',     // Orange
  PERSONAL: '#a855f7',     // Purple
};

const MOOD_EMOJIS: Record<string, string> = {
  happy: '😊',
  proud: '🏆',
  calm: '🌿',
  sad: '🌧️',
  excited: '⚡',
  neutral: '😐',
};

export const DashboardView: React.FC<Props> = ({
  user,
  onNavigate,
  onSelectCategoryFilter,
  onSelectDateFilter,
  onSelectMemory,
}) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'6M' | '1Y' | 'ALL'>('1Y');
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async (range: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboardSummary(range);
      setSummary(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary(timeRange);
  }, [timeRange]);

  const handleCompleteReminder = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.completeReminder(id);
      fetchSummary(timeRange);
    } catch {}
  };

  // Generate 52 weeks (364 days) grid for GitHub-style heatmap
  const renderHeatmap = () => {
    if (!summary) return null;
    const heatmapData = summary.activityHeatmap || {};
    const today = new Date();
    const days: { dateStr: string; count: number; dayOfWeek: number }[] = [];

    // Past 364 days
    for (let i = 363; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      days.push({
        dateStr: str,
        count: heatmapData[str] || 0,
        dayOfWeek: d.getDay(),
      });
    }

    // Split into 7 rows (Sunday to Saturday)
    const rows: { dateStr: string; count: number }[][] = Array.from({ length: 7 }, () => []);
    days.forEach(d => {
      rows[d.dayOfWeek].push(d);
    });

    const getIntensityClass = (count: number) => {
      if (count === 0) return 'bg-slate-900 border-slate-800/80 hover:border-slate-700';
      if (count === 1) return 'bg-cyan-950 border-cyan-800 text-cyan-300';
      if (count === 2) return 'bg-cyan-800 border-cyan-600 text-cyan-200';
      if (count === 3) return 'bg-teal-600 border-teal-500 text-slate-950 font-bold';
      return 'bg-emerald-400 border-emerald-300 text-slate-950 font-bold';
    };

    return (
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="min-w-[720px] flex flex-col gap-1">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1 items-center">
              <span className="w-6 text-[10px] font-mono text-slate-500 text-right pr-1 select-none">
                {rowIdx === 1 ? 'Mon' : rowIdx === 3 ? 'Wed' : rowIdx === 5 ? 'Fri' : ''}
              </span>
              <div className="flex gap-1 flex-1">
                {row.map(cell => (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => {
                      if (cell.count > 0) {
                        onSelectDateFilter(cell.dateStr);
                      }
                    }}
                    title={`${cell.dateStr}: ${cell.count} ${cell.count === 1 ? 'memory' : 'memories'}`}
                    className={`w-3 h-3 rounded-[2px] border transition-transform hover:scale-125 focus:outline-none ${getIntensityClass(
                      cell.count
                    )}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-2 px-6">
          <span>Click any active date to filter memories</span>
          <div className="flex items-center gap-1.5">
            <span>Less</span>
            <span className="w-2.5 h-2.5 rounded-[2px] bg-slate-900 border border-slate-800" />
            <span className="w-2.5 h-2.5 rounded-[2px] bg-cyan-950 border border-cyan-800" />
            <span className="w-2.5 h-2.5 rounded-[2px] bg-cyan-800 border border-cyan-600" />
            <span className="w-2.5 h-2.5 rounded-[2px] bg-teal-600 border border-teal-500" />
            <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-400 border border-emerald-300" />
            <span>More</span>
          </div>
        </div>
      </div>
    );
  };

  const kpis = summary?.kpis;
  const storageMbUsed = kpis ? (kpis.storageUsedBytes / (1024 * 1024)).toFixed(1) : '0.0';
  const storagePercent = kpis ? Math.min(Math.round((kpis.storageUsedBytes / kpis.storageQuotaBytes) * 100), 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <span>Vault v2.0 Active</span>
              <span aria-hidden="true">·</span>
              <span>SQLite with Encryption at Rest</span>
              <span aria-hidden="true">·</span>
              <span>Lexical Retrieval Core</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Welcome back, {user.displayName || user.username}
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Your personal life knowledge repository. Hand-written lexical AI with zero external ML dependencies.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate('add')}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Memory</span>
            </button>
            <button
              onClick={() => onNavigate('search')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Search className="w-4 h-4 text-cyan-400" />
              <span>Smart Search</span>
            </button>
            <button
              onClick={() => onNavigate('gallery')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <ImageIcon className="w-4 h-4 text-teal-400" />
              <span>Gallery</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row (Tabular Figures & Zero-Pill) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Memories */}
        <div
          onClick={() => onNavigate('memories')}
          className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Total Records</span>
            <TrendingUp className="w-4 h-4 text-cyan-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {kpis?.totalMemories ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            <span className="text-cyan-400 font-medium tabular-nums">{kpis?.thisMonthCount ?? 0}</span> this month
          </div>
        </div>

        {/* Current & Longest Streak */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Daily Streak</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums flex items-baseline gap-1.5">
            <span>{kpis?.currentStreak ?? 0}</span>
            <span className="text-xs font-normal text-slate-400">days</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Longest: <span className="text-slate-300 font-medium tabular-nums">{kpis?.longestStreak ?? 0} days</span>
          </div>
        </div>

        {/* Storage Quota */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Storage Used</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums flex items-baseline gap-1">
            <span>{storageMbUsed}</span>
            <span className="text-xs font-normal text-slate-400">MB</span>
          </div>
          <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
            {storagePercent}% of 500 MB quota
          </div>
        </div>

        {/* Favorites */}
        <div
          onClick={() => onNavigate('memories')}
          className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-rose-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Starred Favorites</span>
            <Heart className="w-4 h-4 text-rose-400 fill-rose-500/20 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums">
            {kpis?.favoritesCount ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Saved life milestones
          </div>
        </div>

        {/* Reminders Status */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Active Reminders</span>
            <Bell className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-white tabular-nums flex items-baseline gap-1">
            <span>{kpis?.upcomingRemindersCount ?? 0}</span>
            {kpis?.overdueRemindersCount ? (
              <span className="text-xs text-rose-400 font-semibold tabular-nums">
                ({kpis.overdueRemindersCount} overdue)
              </span>
            ) : null}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Time-bound follow ups
          </div>
        </div>
      </div>

      {/* Activity Heatmap Widget (GitHub Style for past 365 days) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Annual Memory Rhythm (365 Days)</h2>
          </div>
          <div className="text-xs text-slate-400">
            Total active days: <span className="text-white font-medium tabular-nums">{Object.keys(summary?.activityHeatmap || {}).length}</span>
          </div>
        </div>
        {renderHeatmap()}
      </div>

      {/* Charts Grid: Category Distribution & Mood Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Donut */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Categories Breakdown</h2>
            <div className="text-xs text-slate-500">Tap slice to filter</div>
          </div>

          <div className="h-56 flex items-center justify-center">
            {summary && summary.categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    onClick={(entry) => {
                      if (entry && entry.name) {
                        onSelectCategoryFilter(entry.name as CategoryType);
                      }
                    }}
                    cursor="pointer"
                  >
                    {summary.categoryBreakdown.map((entry) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={CATEGORY_COLORS[entry.name] || '#64748b'}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: any) => [`${value} memories`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500 font-mono">No categorized memories yet.</div>
            )}
          </div>

          {/* Clean unboxed legend with separators */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-slate-400">
            {summary?.categoryBreakdown.map((cat, idx) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => onSelectCategoryFilter(cat.name as CategoryType)}
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[cat.name] || '#64748b' }}
                />
                <span>{cat.name}</span>
                <span className="text-slate-500 tabular-nums">({cat.value})</span>
                {idx < summary.categoryBreakdown.length - 1 && (
                  <span className="text-slate-700 ml-1.5" aria-hidden="true">·</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mood Distribution */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Emotional Archetypes &amp; Moods</h2>
            <div className="text-xs text-slate-500">Self-reported emotional states</div>
          </div>

          <div className="h-56">
            {summary && summary.moodDistribution.some(m => m.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.moodDistribution}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="mood"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={(val) => `${MOOD_EMOJIS[val] || ''} ${val}`}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`${val} memories`, 'Count']}
                  />
                  <Bar dataKey="count" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Log moods when saving memories to visualize emotional patterns.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row: "On This Day" & Upcoming Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* On This Day Widget */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">On This Day</h2>
            </div>
            <span className="text-xs text-slate-400">Past year anniversaries</span>
          </div>

          {summary?.onThisDay && summary.onThisDay.length > 0 ? (
            <div className="space-y-3">
              {summary.onThisDay.map((mem) => {
                const year = mem.date.substring(0, 4);
                const yearsAgo = new Date().getFullYear() - parseInt(year, 10);
                return (
                  <div
                    key={mem.memoryId}
                    onClick={() => onSelectMemory(mem)}
                    className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-cyan-500/40 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-amber-300">
                          {yearsAgo} {yearsAgo === 1 ? 'year' : 'years'} ago
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{mem.date}</span>
                      </div>
                      <span className="text-slate-500 font-mono text-[11px]">{mem.category}</span>
                    </div>
                    <h3 className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors">
                      {mem.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {mem.description}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              No memories recorded on this month and day in previous years. Keep logging your journey!
            </div>
          )}
        </div>

        {/* Reminders & Follow-Ups */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-white">Upcoming &amp; Pending Reminders</h2>
            </div>
            <span className="text-xs text-slate-400">One-click complete</span>
          </div>

          {summary?.upcomingReminders && summary.upcomingReminders.length > 0 ? (
            <div className="space-y-2.5">
              {summary.upcomingReminders.map((rem) => {
                const isOverdue = rem.due_at < new Date().toISOString();
                return (
                  <div
                    key={rem.id}
                    className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs mb-0.5">
                        <span className={isOverdue ? 'text-rose-400 font-medium' : 'text-cyan-400'}>
                          Due: {rem.due_at.replace('T', ' ')}
                        </span>
                        {isOverdue && (
                          <span className="text-[10px] text-rose-300 uppercase tracking-wider font-semibold">
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white truncate">
                        {rem.memory_title || 'Memory reminder'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleCompleteReminder(e, rem.id)}
                      className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 text-slate-300 text-xs font-medium border border-slate-700 hover:border-emerald-600 transition-colors flex items-center gap-1 shrink-0"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Done</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              No pending reminders. Attach reminders to any memory for time-sensitive follow-up.
            </div>
          )}
        </div>
      </div>

      {/* Lexical AI Word Cloud */}
      {summary?.wordCloud && summary.wordCloud.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">TF-IDF Conceptual Word Cloud</h2>
            <div className="text-xs text-slate-400">Lexically prominent terms across your records</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {summary.wordCloud.map((item) => (
              <button
                key={item.text}
                type="button"
                onClick={() => onNavigate('search')}
                className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 text-xs transition-colors flex items-center gap-1.5"
              >
                <span>#{item.text}</span>
                <span className="text-[10px] text-slate-500 tabular-nums">({item.value})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
