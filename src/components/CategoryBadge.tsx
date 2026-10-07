import React from 'react';
import { CategoryType } from '../types';

interface Props {
  category: CategoryType | string;
  size?: 'sm' | 'md' | 'lg';
}

export const CATEGORY_CONFIG: Record<
  CategoryType,
  { label: string; text: string; dot: string; glow: string }
> = {
  ACHIEVEMENT: {
    label: 'Achievement',
    text: 'text-amber-300',
    dot: 'bg-amber-400',
    glow: 'shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  },
  EVENT: {
    label: 'Event',
    text: 'text-sky-300',
    dot: 'bg-sky-400',
    glow: 'shadow-[0_0_8px_rgba(56,189,248,0.5)]',
  },
  STUDY: {
    label: 'Study',
    text: 'text-emerald-300',
    dot: 'bg-emerald-400',
    glow: 'shadow-[0_0_8px_rgba(52,211,153,0.5)]',
  },
  TRAVEL: {
    label: 'Travel',
    text: 'text-cyan-300',
    dot: 'bg-cyan-400',
    glow: 'shadow-[0_0_8px_rgba(6,182,212,0.5)]',
  },
  REMINDER: {
    label: 'Reminder',
    text: 'text-rose-300',
    dot: 'bg-rose-400',
    glow: 'shadow-[0_0_8px_rgba(251,113,133,0.5)]',
  },
  PERSONAL: {
    label: 'Personal',
    text: 'text-violet-300',
    dot: 'bg-violet-400',
    glow: 'shadow-[0_0_8px_rgba(167,139,250,0.5)]',
  },
};

export const CategoryBadge: React.FC<Props> = ({ category, size = 'sm' }) => {
  const upper = (category || 'PERSONAL').toUpperCase() as CategoryType;
  const config = CATEGORY_CONFIG[upper] || CATEGORY_CONFIG.PERSONAL;

  const sizeClasses =
    size === 'lg'
      ? 'text-xs font-semibold'
      : size === 'md'
      ? 'text-xs font-medium'
      : 'text-[11px] font-medium tracking-tight';

  return (
    <span className={`inline-flex items-center gap-1.5 ${config.text} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${config.glow}`} />
      <span>{config.label}</span>
    </span>
  );
};
