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
  Plus,
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
  ACHIEVEMENT: '#F59E0B', // Amber
  EVENT: '#3B82F6',       // Blue
  STUDY: '#10B981',       // Emerald
  TRAVEL: '#06B6D4',       // Cyan
  REMINDER: '#F97316',     // Orange
  PERSONAL: '#8B5CF6',     // Purple
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
    days.forEach((d) => {
      rows[d.dayOfWeek].push(d);
    });

    const getIntensityClass = (count: number) => {
      if (count === 0) return 'bg-white/[0.04] border-white/[0.04] hover:border-slate-500';
      if (count === 1) return 'bg-cyan-950/80 border-cyan-800 text-cyan-300';
      if (count === 2) return 'bg-cyan-700 border-cyan-500 text-cyan-100 shadow-[0_0_8px_rgba(6,182,212,0.3)]';
      if (count === 3) return 'bg-teal-500 border-teal-400 text-slate-950 font-bold shadow-[0_0_10px_rgba(20,184,166,0.4)]';
      return 'bg-emerald-400 border-emerald-300 text-slate-950 font-bold shadow-[0_0_12px_rgba(52,211,153,0.5)]';
    };

    return (
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="min-w-[720px] flex flex-col gap-1.5">
          {rows.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1.5 items-center">
              <span className="w-6 text-[10px] font-mono text-slate-500 text-right pr-1 select-none">
                {rowIdx === 1 ? 'Mon' : rowIdx === 3 ? 'Wed' : rowIdx === 5 ? 'Fri' : ''}
              </span>
              <div className="flex gap-1 flex-1">
                {row.map((cell) => (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => {
                      if (cell.count > 0) {
                        onSelectDateFilter(cell.dateStr);
                      }
                    }}
                    title={`${cell.dateStr}: ${cell.count} ${cell.count === 1 ? 'memory' : 'memories'}`}
                    className={`w-3 h-3 rounded-[3px] border transition-all duration-200 hover:scale-125 focus:outline-none cursor-pointer ${getIntensityClass(
                      cell.count
                    )}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-3 px-6">
          <span>Click any recorded date to filter memory records</span>
          <div className="flex items-center gap-1.5">
            <span>Less</span>
            <span className="w-2.5 h-2.5 rounded-[2px] bg-white/[0.04] border border-white/[0.06]" />
            <span className="w-2.5 h-2.5 rounded-[2px] bg-cyan-950 border border-cyan-800" />
            <span className="w-2.5 h-2.5 rounded-[2px] bg-cyan-700 border border-cyan-500" />
            <span className="w-2.5 h-2.5 rounded-[2px] bg-teal-500 border border-teal-400" />
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
      {/* Top Hero Banner & Quick Actions */}
      <div className="glass-panel rounded-2xl p-6 sm:p-7 relative overflow-hidden shadow-xl border border-white/[0.08]">
        {/* Subtle decorative radial glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[radial-gradient(ellipse_at_top_right,rgba(6,182,212,0.12),transparent_70%)] pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1.5">
              <span>Encrypted Vault Active</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>AES-256 Storage</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>Lexical Retrieval Core</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back, {user.displayName || user.username}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Your personal life knowledge repository. Hand-written lexical AI with instant search, voice reflections, and photo vault.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate('add')}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.25)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Record Memory</span>
            </button>
            <button
              onClick={() => onNavigate('search')}
              className="px-3.5 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 text-xs font-medium rounded-xl border border-white/[0.08] hover:border-white/[0.15] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-cyan-400" />
              <span>Search Vault</span>
            </button>
            <button
              onClick={() => onNavigate('gallery')}
              className="px-3.5 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 text-xs font-medium rounded-xl border border-white/[0.08] hover:border-white/[0.15] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
              <span>Media Gallery</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row (Tabular Figures & Sleek Elevation) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Memories */}
        <div
          onClick={() => onNavigate('memories')}
          className="glass-panel glass-panel-hover p-4 sm:p-5 rounded-2xl cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Total Records</span>
            <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-400">
              <TrendingUp className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums tracking-tight">
            {kpis?.totalMemories ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5">
            <span className="text-cyan-400 font-semibold tabular-nums">{kpis?.thisMonthCount ?? 0}</span> added this month
          </div>
        </div>

        {/* Current & Longest Streak */}
        <div className="glass-panel glass-panel-hover p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Daily Streak</span>
            <div className="p-1 rounded-md bg-amber-500/10 text-amber-400">
              <Flame className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums tracking-tight flex items-baseline gap-1.5">
            <span>{kpis?.currentStreak ?? 0}</span>
            <span className="text-xs font-normal text-slate-400">days</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5">
            Best: <span className="text-slate-200 font-semibold tabular-nums">{kpis?.longestStreak ?? 0} days</span>
          </div>
        </div>

        {/* Storage Quota */}
        <div className="glass-panel glass-panel-hover p-4 sm:p-5 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Storage Used</span>
            <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums tracking-tight flex items-baseline gap-1">
            <span>{storageMbUsed}</span>
            <span className="text-xs font-normal text-slate-400">MB</span>
          </div>
          <div className="mt-2.5 w-full bg-slate-900/80 rounded-full h-1.5 overflow-hidden border border-white/[0.04]">
            <div
              className="bg-gradient-to-r from-teal-400 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5 tabular-nums">
            {storagePercent}% of 500 MB quota
          </div>
        </div>

        {/* Favorites */}
        <div
          onClick={() => onNavigate('memories')}
          className="glass-panel glass-panel-hover p-4 sm:p-5 rounded-2xl cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Favorites</span>
            <div className="p-1 rounded-md bg-rose-500/10 text-rose-400">
              <Heart className="w-3.5 h-3.5 fill-rose-500/20 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums tracking-tight">
            {kpis?.favoritesCount ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5">
            Key milestones starred
          </div>
        </div>

        {/* Reminders Status */}
        <div className="glass-panel glass-panel-hover p-4 sm:p-5 rounded-2xl col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Reminders</span>
            <div className="p-1 rounded-md bg-orange-500/10 text-orange-400">
              <Bell className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums tracking-tight flex items-baseline gap-1.5">
            <span>{kpis?.upcomingRemindersCount ?? 0}</span>
            {kpis?.overdueRemindersCount ? (
              <span className="text-xs text-rose-400 font-semibold tabular-nums">
                ({kpis.overdueRemindersCount} overdue)
              </span>
            ) : null}
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5">
            Pending scheduled alerts
          </div>
        </div>
      </div>

      {/* Activity Heatmap Widget (GitHub Style for past 365 days) */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Activity Rhythm (365 Days)</h2>
              <p className="text-[11px] text-slate-400">Timeline of memories and reflections logged</p>
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Active days logged: <span className="text-cyan-300 font-semibold tabular-nums">{Object.keys(summary?.activityHeatmap || {}).length}</span>
          </div>
        </div>
        {renderHeatmap()}
      </div>

      {/* Charts Grid: Category Distribution & Mood Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Donut */}
        <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Knowledge Categories</h2>
              <p className="text-[11px] text-slate-400">Distribution across life areas</p>
            </div>
            <div className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
              Click slice to filter
            </div>
          </div>

          <div className="h-60 flex items-center justify-center">
            {summary && summary.categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={summary.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
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
                        stroke="#07090E"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'rgba(13, 18, 30, 0.95)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#F1F5F9',
                      fontSize: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      backdropFilter: 'blur(12px)',
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
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3 border-t border-white/[0.06] text-xs text-slate-400">
            {summary?.categoryBreakdown.map((cat, idx) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => onSelectCategoryFilter(cat.name as CategoryType)}
                className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[cat.name] || '#64748b' }}
                />
                <span className="font-medium">{cat.name}</span>
                <span className="text-slate-500 font-mono text-[11px] tabular-nums">({cat.value})</span>
                {idx < summary.categoryBreakdown.length - 1 && (
                  <span className="text-slate-700 ml-1.5" aria-hidden="true">·</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mood Distribution */}
        <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Emotional Patterns &amp; Moods</h2>
              <p className="text-[11px] text-slate-400">Self-reported emotional states logged</p>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              6 Archetypes
            </div>
          </div>

          <div className="h-60">
            {summary && summary.moodDistribution.some((m) => m.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.moodDistribution}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#0D9488" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="mood"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={(val) => `${MOOD_EMOJIS[val] || ''} ${val}`}
                    axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    allowDecimals={false}
                    axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'rgba(13, 18, 30, 0.95)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#F1F5F9',
                      fontSize: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      backdropFilter: 'blur(12px)',
                    }}
                    formatter={(val: any) => [`${val} memories`, 'Count']}
                  />
                  <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center px-4">
                Log moods when recording memories to visualize your emotional trajectory over time.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row: "On This Day" & Upcoming Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* On This Day Widget */}
        <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-tight">On This Day</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">Anniversaries</span>
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
                    className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-cyan-500/40 hover:bg-white/[0.04] transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-300">
                          {yearsAgo} {yearsAgo === 1 ? 'year' : 'years'} ago
                        </span>
                        <span aria-hidden="true" className="text-slate-700">·</span>
                        <span>{mem.date}</span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">{mem.category}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                      {mem.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {mem.description}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-slate-500">
              No memories recorded on this date in past years. Keep logging to unlock future anniversaries!
            </div>
          )}
        </div>

        {/* Reminders & Follow-Ups */}
        <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
                <Bell className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-bold text-white tracking-tight">Pending Reminders</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">Action items</span>
          </div>

          {summary?.upcomingReminders && summary.upcomingReminders.length > 0 ? (
            <div className="space-y-3">
              {summary.upcomingReminders.map((rem) => {
                const isOverdue = rem.due_at < new Date().toISOString();
                return (
                  <div
                    key={rem.id}
                    className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs mb-1">
                        <span className={isOverdue ? 'text-rose-400 font-semibold' : 'text-cyan-400 font-medium'}>
                          Due: {rem.due_at.replace('T', ' ')}
                        </span>
                        {isOverdue && (
                          <span className="text-[10px] text-rose-300 uppercase tracking-wider font-bold bg-rose-950/80 border border-rose-800 px-1.5 py-0.2 rounded">
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white truncate">
                        {rem.memory_title || 'Memory reminder'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleCompleteReminder(e, rem.id)}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-emerald-950 hover:text-emerald-300 text-slate-300 text-xs font-semibold border border-white/[0.08] hover:border-emerald-600 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Complete</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-slate-500">
              No pending reminders. Attach reminders to any memory for scheduled follow-ups.
            </div>
          )}
        </div>
      </div>

      {/* Lexical AI Word Cloud */}
      {summary?.wordCloud && summary.wordCloud.length > 0 && (
        <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/[0.08]">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Lexical Topic Cloud</h2>
              <p className="text-[11px] text-slate-400">TF-IDF conceptual keywords extracted from your vault entries</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {summary.wordCloud.map((item) => (
              <button
                key={item.text}
                type="button"
                onClick={() => onNavigate('search')}
                className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:scale-105"
              >
                <span className="font-medium text-cyan-400/80">#</span>
                <span>{item.text}</span>
                <span className="text-[10px] text-slate-500 font-mono tabular-nums">({item.value})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
