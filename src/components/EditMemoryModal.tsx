import React, { useState } from 'react';
import {
  X,
  Save,
  Calendar,
  Tag as TagIcon,
  FileText,
  Sparkles,
  Smile,
  MapPin,
  Users,
} from 'lucide-react';
import { api } from '../api';
import { CategoryType, Memory, MoodType } from '../types';

interface Props {
  memory: Memory;
  onClose: () => void;
  onSuccess: (updated: Memory) => void;
  onError: (msg: string) => void;
}

const CATEGORY_OPTIONS: CategoryType[] = [
  'ACHIEVEMENT',
  'EVENT',
  'STUDY',
  'TRAVEL',
  'REMINDER',
  'PERSONAL',
];

const MOOD_OPTIONS: { type: MoodType; emoji: string; label: string }[] = [
  { type: 'happy', emoji: '😊', label: 'Happy' },
  { type: 'proud', emoji: '🏆', label: 'Proud' },
  { type: 'calm', emoji: '🌿', label: 'Calm' },
  { type: 'sad', emoji: '🌧️', label: 'Sad' },
  { type: 'excited', emoji: '⚡', label: 'Excited' },
  { type: 'neutral', emoji: '😐', label: 'Neutral' },
];

export const EditMemoryModal: React.FC<Props> = ({
  memory,
  onClose,
  onSuccess,
  onError,
}) => {
  const [title, setTitle] = useState(memory.title);
  const [date, setDate] = useState(memory.date);
  const [description, setDescription] = useState(memory.description);
  const [category, setCategory] = useState<CategoryType>(memory.category);
  const [mood, setMood] = useState<MoodType>(memory.mood || 'neutral');
  const [locationName, setLocationName] = useState(memory.locationName || '');
  const [tagsInput, setTagsInput] = useState(
    memory.tags ? memory.tags.map((t) => t.name).join(', ') : ''
  );
  const [peopleInput, setPeopleInput] = useState(
    memory.people ? memory.people.join(', ') : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length > 60) {
      onError('Title cannot be empty and must be 60 characters or fewer.');
      return;
    }
    if (description.trim().length < 5 || description.trim().length > 500) {
      onError('Description must be between 5 and 500 characters.');
      return;
    }

    setSaving(true);
    try {
      const tagsList = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const peopleList = peopleInput
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      await api.updateMemory(memory.memoryId, {
        title: title.trim(),
        date,
        description: description.trim(),
        category,
        mood,
        location_name: locationName.trim(),
        tags: tagsList,
        people: peopleList,
      });

      const updated = await api.getMemory(memory.memoryId);
      onSuccess(updated);
    } catch (err: any) {
      onError(err.message || 'Failed to update memory.');
    } finally {
      setSaving(false);
    }
  };

  const handleReSuggest = async () => {
    try {
      const res = await api.suggest(title, description);
      setCategory(res.category);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 relative">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Edit Memory Record</h2>
            <span className="font-mono text-xs text-cyan-400">({memory.memoryId})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-slate-300">Title</label>
              <span className="text-[11px] text-slate-500 tabular-nums">{title.length}/60</span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Date</span>
              </label>
              <input
                type="date"
                max={new Date().toISOString().split('T')[0]}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                  <TagIcon className="w-3.5 h-3.5 text-teal-400" />
                  <span>Category</span>
                </label>
                <button
                  type="button"
                  onClick={handleReSuggest}
                  className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
                >
                  <Sparkles className="w-2.5 h-2.5" /> Re-classify
                </button>
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <Smile className="w-3.5 h-3.5 text-amber-400" />
                <span>Mood</span>
              </label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value as MoodType)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {MOOD_OPTIONS.map((m) => (
                  <option key={m.type} value={m.type}>
                    {m.emoji} {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Description (5–500 chars)</span>
              </label>
              <span className="text-[11px] text-slate-500 tabular-nums">{description.length}/500</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>Location</span>
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="Location"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                <TagIcon className="w-3.5 h-3.5 text-teal-400" />
                <span>Tags (Comma-separated)</span>
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. key, milestone"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Updating...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
