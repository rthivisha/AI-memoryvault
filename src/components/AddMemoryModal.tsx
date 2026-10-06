import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Calendar,
  FileText,
  Tag as TagIcon,
  ChevronDown,
  Save,
  Smile,
  MapPin,
  Users,
  Paperclip,
  Upload,
  X,
  Camera,
  Music,
  FileCode,
  Wand2,
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Image as ImageIcon,
  Volume2,
} from 'lucide-react';
import { api } from '../api';
import { CategoryType, Memory, MoodType, SuggestResponse } from '../types';

interface Props {
  onSuccess: (mem: Memory, msg: string) => void;
  onError: (msg: string) => void;
  onCancel?: () => void;
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

export const AddMemoryModal: React.FC<Props> = ({ onSuccess, onError, onCancel }) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr);
  const [description, setDescription] = useState('');
  const [overrideCategory, setOverrideCategory] = useState<CategoryType | ''>('');
  const [mood, setMood] = useState<MoodType>('neutral');
  const [locationName, setLocationName] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [peopleInput, setPeopleInput] = useState('');

  // Files & Attachments
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{
    name: string;
    size: number;
    url?: string;
    type: string;
  }[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Audio Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [playingAudioIdx, setPlayingAudioIdx] = useState<number | null>(null);

  // AI suggestions & Loading states
  const [suggestion, setSuggestion] = useState<SuggestResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState<string>('');
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Refs
  const generalFileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeAudioElRef = useRef<HTMLAudioElement | null>(null);

  // Live lexical classification
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (title.trim().length >= 3 || description.trim().length >= 5) {
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const res = await api.suggest(title, description);
          setSuggestion(res);
        } catch {}
      }, 400);
    } else {
      setSuggestion(null);
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [title, description]);

  // Clean up audio & timers on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
      if (activeAudioElRef.current) {
        activeAudioElRef.current.pause();
      }
    };
  }, []);

  const handleFilesAdded = (incoming: FileList | File[] | null) => {
    if (!incoming) return;
    const filesArray = Array.from(incoming);
    if (filesArray.length === 0) return;

    // Check sizes
    const valid = filesArray.filter((f) => {
      if (f.size > 15 * 1024 * 1024) {
        onError(`File '${f.name}' exceeds the 15MB limit and was skipped.`);
        return false;
      }
      return true;
    });

    const combined = [...selectedFiles, ...valid].slice(0, 10);
    setSelectedFiles(combined);

    const previews = combined.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      url: f.type.startsWith('image/') || f.type.startsWith('audio/')
        ? URL.createObjectURL(f)
        : undefined,
    }));
    setFilePreviews(previews);
  };

  const handleRemoveFile = (index: number) => {
    if (playingAudioIdx === index && activeAudioElRef.current) {
      activeAudioElRef.current.pause();
      setPlayingAudioIdx(null);
    }
    const updated = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updated);
    setFilePreviews(
      updated.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
        url: f.type.startsWith('image/') || f.type.startsWith('audio/')
          ? URL.createObjectURL(f)
          : undefined,
      }))
    );
  };

  // Voice recording controls
  const startRecording = async () => {
    try {
      setMicError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Audio recording is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const ext = mimeType.includes('wav') ? '.wav' : mimeType.includes('ogg') ? '.ogg' : '.webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
        const voiceFile = new File([audioBlob], `Voice_Recording_${timestamp}${ext}`, { type: mimeType });

        handleFilesAdded([voiceFile]);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      const msg = err.message || 'Microphone access denied.';
      setMicError(msg);
      onError(msg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current.onstop = null; // discard onstop handler
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordSeconds(0);
  };

  // Preview audio toggle
  const togglePlayAudio = (index: number, url?: string) => {
    if (!url) return;
    if (playingAudioIdx === index) {
      if (activeAudioElRef.current) activeAudioElRef.current.pause();
      setPlayingAudioIdx(null);
    } else {
      if (activeAudioElRef.current) activeAudioElRef.current.pause();
      const audio = new Audio(url);
      activeAudioElRef.current = audio;
      setPlayingAudioIdx(index);
      audio.play().catch(() => setPlayingAudioIdx(null));
      audio.onended = () => setPlayingAudioIdx(null);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleAutoTitle = async () => {
    if (!description.trim()) {
      onError('Please write a description first to auto-generate title.');
      return;
    }
    setGeneratingTitle(true);
    try {
      const res = await api.autoTitle(description);
      if (res.suggestedTitle) setTitle(res.suggestedTitle);
    } catch {
      onError('Failed to generate lexical auto-title.');
    } finally {
      setGeneratingTitle(false);
    }
  };

  const handleAutoSummary = async () => {
    if (!description.trim()) return;
    setGeneratingSummary(true);
    try {
      const res = await api.autoSummary(description);
      if (res.summary) setDescription(res.summary);
    } catch {}
    finally {
      setGeneratingSummary(false);
    }
  };

  const activeCategory = overrideCategory || (suggestion?.category as CategoryType) || 'PERSONAL';

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
    if (date > todayStr) {
      onError('A memory cannot be dated in the future.');
      return;
    }

    setSaving(true);
    setSavingStatus('Encrypting & creating memory record...');
    try {
      const tagsList = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const peopleList = peopleInput
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const created = await api.createMemory({
        title: title.trim(),
        date,
        description: description.trim(),
        category: overrideCategory || undefined,
        mood,
        location_name: locationName.trim() || undefined,
        tags: tagsList,
        people: peopleList,
      });

      // Upload attachments if any (multiple photos, audio notes, docs)
      if (selectedFiles.length > 0) {
        setSavingStatus(`Uploading ${selectedFiles.length} attachment(s) (photos, voice notes)...`);
        try {
          await api.uploadAttachments(created.memoryId, selectedFiles);
        } catch (uploadErr: any) {
          onError(`Memory saved, but attachments failed to upload: ${uploadErr.message || 'Error'}`);
          onSuccess(created, `Memory saved with ID: ${created.memoryId} (attachments failed)`);
          return;
        }
      }

      onSuccess(created, `Memory saved with ID: ${created.memoryId}`);
    } catch (err: any) {
      onError(err.message || 'Failed to save memory record.');
    } finally {
      setSaving(false);
      setSavingStatus('');
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 sm:p-8 backdrop-blur-md relative">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <span>Lexical Processing</span>
            <span aria-hidden="true">·</span>
            <span>AES-256 Encrypted</span>
            <span aria-hidden="true">·</span>
            <span>Photos & Voice Notes</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Record New Memory</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Store events, milestones, photos, and voice notes securely in your personal vault.
          </p>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title & Lexical Generator */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-300">
              Title <span className="text-slate-500">(1-60 chars)</span>
            </label>
            <button
              type="button"
              onClick={handleAutoTitle}
              disabled={generatingTitle}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <Wand2 className="w-3 h-3" />
              <span>{generatingTitle ? 'Generating...' : 'Auto-Title from Description'}</span>
            </button>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. AI Hackathon presentation and award"
            maxLength={60}
            required
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
          />
        </div>

        {/* Date, Category, Mood Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Picker */}
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Memory Date</span>
            </label>
            <input
              type="date"
              value={date}
              max={todayStr}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Category</span>
              {suggestion && (
                <span className="text-[10px] text-teal-400 font-mono">
                  Lexicon: {suggestion.category} ({(suggestion.confidence * 100).toFixed(0)}%)
                </span>
              )}
            </label>
            <div className="relative">
              <select
                value={activeCategory}
                onChange={(e) => setOverrideCategory(e.target.value as CategoryType)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white appearance-none focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors cursor-pointer"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c} className="bg-slate-900 text-white">
                    {c}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Mood Selector */}
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Smile className="w-3.5 h-3.5 text-amber-400" />
              <span>Mood State</span>
            </label>
            <div className="grid grid-cols-6 gap-1 bg-slate-950 border border-slate-800 p-1 rounded-lg">
              {MOOD_OPTIONS.map((m) => (
                <button
                  key={m.type}
                  type="button"
                  onClick={() => setMood(m.type)}
                  title={m.label}
                  className={`py-1 rounded text-center text-sm transition-all ${
                    mood === m.type
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm scale-105'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <span>{m.emoji}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Location & People */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>Location (Optional)</span>
            </label>
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Coimbatore Campus, Innovation Lab Room 4"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>People Present (Comma-separated)</span>
            </label>
            <input
              type="text"
              value={peopleInput}
              onChange={(e) => setPeopleInput(e.target.value)}
              placeholder="e.g. Rahul, Priya, Professor Sundar"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
            />
          </div>
        </div>

        {/* Description Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Detailed Narrative</span>
              <span className="text-slate-500 font-normal">({description.length}/500 chars)</span>
            </label>
            <button
              type="button"
              onClick={handleAutoSummary}
              disabled={generatingSummary || description.length < 30}
              className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
            >
              {generatingSummary ? 'Summarizing...' : 'Generate 1-sentence summary'}
            </button>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="What happened? What were the key takeaways, challenges, or insights? Encrypted at rest using AES-256-GCM."
            required
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
            <TagIcon className="w-3.5 h-3.5 text-teal-400" />
            <span>Tags (Comma-separated)</span>
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="e.g. hackathon, ai, college, project"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
          />
        </div>

        {/* Multi-Attachment Uploader: Multiple Photos & Voice Recordings */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
              <span>Attachments & Media</span>
              <span className="text-slate-500 font-normal">({selectedFiles.length}/10 max)</span>
            </label>
            <span className="text-[11px] text-slate-400">
              Multiple Photos • Voice Memos • Documents
            </span>
          </div>

          {/* Hidden inputs for file types */}
          <input
            type="file"
            ref={generalFileInputRef}
            onChange={(e) => handleFilesAdded(e.target.files)}
            multiple
            accept="image/*,audio/*,application/pdf"
            className="hidden"
          />
          <input
            type="file"
            ref={photoInputRef}
            onChange={(e) => handleFilesAdded(e.target.files)}
            multiple
            accept="image/*"
            className="hidden"
          />
          <input
            type="file"
            ref={audioFileInputRef}
            onChange={(e) => handleFilesAdded(e.target.files)}
            multiple
            accept="audio/*"
            className="hidden"
          />
          <input
            type="file"
            ref={cameraInputRef}
            onChange={(e) => handleFilesAdded(e.target.files)}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          {/* Dropzone & Multi-Action Bar */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border rounded-xl p-5 text-center transition-all ${
              isDragging
                ? 'border-cyan-400 bg-cyan-950/40 ring-2 ring-cyan-500/30'
                : 'border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/60'
            }`}
          >
            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {/* Add Multiple Photos */}
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm hover:text-white"
              >
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <span>Upload Photos</span>
              </button>

              {/* Direct In-Browser Voice Recording */}
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="px-3.5 py-2 bg-teal-950/80 hover:bg-teal-900 border border-teal-500/40 text-teal-300 text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Mic className="w-4 h-4 text-teal-400" />
                  <span>Record Voice Note</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-rose-950/80 border border-rose-500/50 px-3 py-1.5 rounded-lg animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs font-mono text-rose-300 font-bold">
                    Recording: {formatSeconds(recordSeconds)}
                  </span>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="ml-2 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded flex items-center gap-1"
                  >
                    <Square className="w-3 h-3 fill-white" />
                    <span>Stop & Attach</span>
                  </button>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="px-2 py-1 text-slate-400 hover:text-white text-[11px]"
                  >
                    Discard
                  </button>
                </div>
              )}

              {/* Upload Pre-recorded Audio */}
              <button
                type="button"
                onClick={() => audioFileInputRef.current?.click()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Music className="w-4 h-4 text-amber-400" />
                <span>Audio File</span>
              </button>

              {/* Mobile Camera */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Camera className="w-4 h-4 text-purple-400" />
                <span>Camera</span>
              </button>

              {/* General File Browser */}
              <button
                type="button"
                onClick={() => generalFileInputRef.current?.click()}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>All Files</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-3">
              Drag and drop multiple photos, recorded voice notes, or documents here. Max 10 files (15MB each).
            </p>

            {micError && (
              <p className="text-[11px] text-rose-400 mt-2 font-mono">
                {micError}
              </p>
            )}
          </div>

          {/* Previews Strip */}
          {filePreviews.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-3">
              {filePreviews.map((f, idx) => {
                const isImg = f.type.startsWith('image/');
                const isAudio = f.type.startsWith('audio/') || f.name.endsWith('.webm') || f.name.endsWith('.wav') || f.name.endsWith('.mp3');

                return (
                  <div
                    key={idx}
                    className="relative group bg-slate-950 border border-slate-800 rounded-lg p-2 flex flex-col items-center justify-between"
                  >
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs opacity-90 group-hover:opacity-100 transition-opacity z-10"
                      title="Remove file"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    {isImg && f.url ? (
                      <div className="w-full h-20 rounded overflow-hidden bg-slate-900 mb-1.5">
                        <img
                          src={f.url}
                          alt={f.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : isAudio ? (
                      <div className="w-full h-20 flex flex-col items-center justify-center bg-teal-950/40 border border-teal-800/40 rounded mb-1.5 text-teal-400 p-2">
                        <Volume2 className="w-6 h-6 mb-1" />
                        {f.url && (
                          <button
                            type="button"
                            onClick={() => togglePlayAudio(idx, f.url)}
                            className="px-2 py-0.5 bg-teal-600 hover:bg-teal-500 text-white text-[10px] rounded flex items-center gap-1 font-mono"
                          >
                            {playingAudioIdx === idx ? (
                              <>
                                <Pause className="w-3 h-3" /> Pause
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3" /> Play
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-20 flex items-center justify-center bg-slate-900 rounded mb-1.5 text-cyan-400">
                        <FileCode className="w-7 h-7" />
                      </div>
                    )}

                    <span className="text-[10px] text-slate-200 truncate w-full text-center font-mono">
                      {f.name}
                    </span>
                    <span className="text-[9px] text-slate-500 tabular-nums">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Keywords Preview */}
        {suggestion && suggestion.keywords_preview.length > 0 && (
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <span className="text-[11px] text-slate-400 block mb-1">
              Hand-Crafted TF-IDF Extracted Keywords:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {suggestion.keywords_preview.map((kw) => (
                <span
                  key={kw}
                  className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px]"
                >
                  #{kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="text-xs text-slate-400">
            {savingStatus ? (
              <span className="text-cyan-400 font-mono animate-pulse">{savingStatus}</span>
            ) : (
              <span>All narrative fields and media attachments are securely encrypted.</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="flex-1 sm:flex-none px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs rounded-lg transition-colors"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={saving}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Encrypting & Saving...' : 'Save to Vault'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
