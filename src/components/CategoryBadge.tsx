import React from 'react';
import { CategoryType } from '../types';

interface Props {
  category: CategoryType | string;
  size?: 'sm' | 'md' | 'lg';
}

export const CATEGORY_CONFIG: Record<
  CategoryType,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  ACHIEVEMENT: {
    label: 'Achievement',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  EVENT: {
    label: 'Event',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    dot: 'bg-purple-400',
  },
  STUDY: {
    label: 'Study',
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/30',
    dot: 'bg-sky-400',
  },
  TRAVEL: {
    label: 'Travel',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-400',
  },
  REMINDER: {
    label: 'Reminder',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    dot: 'bg-rose-400',
  },
  PERSONAL: {
    label: 'Personal',
    bg: 'bg-slate-500/10',
    text: 'text-slate-300',
    border: 'border-slate-500/30',
    dot: 'bg-slate-400',
  },
};

export const CategoryBadge: React.FC<Props> = ({ category, size = 'sm' }) => {
  const upper = (category || 'PERSONAL').toUpperCase() as CategoryType;
  const config = CATEGORY_CONFIG[upper] || CATEGORY_CONFIG.PERSONAL;

  const sizeClasses =
    size === 'lg'
      ? 'px-3 py-1 text-xs font-semibold'
      : size === 'md'
      ? 'px-2.5 py-0.5 text-xs font-medium'
      : 'px-2 py-0.5 text-[11px] font-medium tracking-wide';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{config.label}</span>
    </span>
  );
};
