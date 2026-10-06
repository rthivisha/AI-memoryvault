import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Calendar,
  Tag as TagIcon,
  FileText,
  Edit3,
  Trash2,
  Sparkles,
  ExternalLink,
  Shield,
  Heart,
  Pin,
  MapPin,
  Users,
  Paperclip,
  Download,
  Music,
  FileCode,
  Plus,
  Bell,
  CheckCircle2,
  Clock,
  Mic,
  Square,
  Image as ImageIcon,
} from 'lucide-react';
import { Memory, Reminder } from '../types';
import { api } from '../api';

interface Props {
  memory: Memory | null;
  onClose: () => void;
  onEdit: (mem: Memory) => void;
  onDelete: (mem: Memory) => void;
  onSelectRelated: (mem: Memory) => void;
  onRefresh?: () => void;
}

const MOOD_EMOJIS: Record<string, string> = {
  happy: '😊',
  proud: '🏆',
  calm: '🌿',
  sad: '🌧️',
  excited: '⚡',
  neutral: '😐',
};

export const MemoryDrawer: React.FC<Props> = ({
  memory,
  onClose,
  onEdit,
  onDelete,
  onSelectRelated,
  onRefresh,
}) => {
  const [currentMemory, setCurrentMemory] = useState<Memory | null>(memory);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [reminderDueDate, setReminderDueDate] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Attachment input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // In-drawer Voice Recording
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setCurrentMemory(memory);
    if (memory) {
      // Fetch fresh details including attachments and tags
      api.getMemory(memory.memoryId).then((full) => setCurrentMemory(full)).catch(() => {});
      // Fetch reminders
      api.listReminders().then((all) => {
        setReminders(all.filter((r) => r.memory_id === memory.memoryId));
      }).catch(() => {});
    }
  }, [memory?.memoryId]);

  if (!currentMemory) return null;

  const handleToggleFavorite = async () => {
    try {
      await api.updateMemory(currentMemory.memoryId, { is_favorite: !currentMemory.isFavorite });
      setCurrentMemory((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
      if (onRefresh) onRefresh();
    } catch {}
  };

  const handleTogglePin = async () => {
    try {
      await api.updateMemory(currentMemory.memoryId, { is_pinned: !currentMemory.isPinned });
      setCurrentMemory((prev) => (prev ? { ...prev, isPinned: !prev.isPinned } : null));
      if (onRefresh) onRefresh();
    } catch {}
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingFiles(true);
    try {
      await api.uploadAttachments(currentMemory.memoryId, Array.from(files));
      const updated = await api.getMemory(currentMemory.memoryId);
      setCurrentMemory(updated);
      if (onRefresh) onRefresh();
    } catch {
      alert('Failed to upload attachment.');
    } finally {
      setUploadingFiles(false);
    }
  };

  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Audio recording is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const ext = mimeType.includes('wav') ? '.wav' : mimeType.includes('ogg') ? '.ogg' : '.webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
        const voiceFile = new File([audioBlob], `Voice_Recording_${timestamp}${ext}`, { type: mimeType });

        setUploadingFiles(true);
        try {
          await api.uploadAttachments(currentMemory.memoryId, [voiceFile]);
          const updated = await api.getMemory(currentMemory.memoryId);
          setCurrentMemory(updated);
          if (onRefresh) onRefresh();
        } catch {
          alert('Failed to save recorded voice note.');
        } finally {
          setUploadingFiles(false);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecordingVoice(true);
      setRecordingSecs(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSecs((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      alert('Microphone access denied: ' + (err.message || ''));
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecordingVoice(false);
  };

  const cancelVoiceRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecordingVoice(false);
    setRecordingSecs(0);
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      await api.deleteAttachment(attachmentId);
      const updated = await api.getMemory(currentMemory.memoryId);
      setCurrentMemory(updated);
      if (onRefresh) onRefresh();
    } catch {
      alert('Failed to delete attachment.');
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderDueDate) return;
    try {
      await api.createReminder({
        memory_id: currentMemory.memoryId,
        due_at: reminderDueDate,
      });
      const all = await api.listReminders();
      setReminders(all.filter((r) => r.memory_id === currentMemory.memoryId));
      setShowAddReminder(false);
      setReminderDueDate('');
    } catch {
      alert('Failed to set reminder.');
    }
  };

  const handleCompleteReminder = async (remId: string) => {
    try {
      await api.completeReminder(remId);
      const all = await api.listReminders();
      setReminders(all.filter((r) => r.memory_id === currentMemory.memoryId));
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250">
        {/* Top Header */}
        <div>
          <div className="p-6 border-b border-slate-800 bg-slate-950/70 sticky top-0 z-10 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-cyan-400 font-bold">
                  {currentMemory.memoryId}
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="font-mono text-slate-300 font-medium">
                  {currentMemory.category}
                </span>
                {currentMemory.mood && (
                  <>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span>{MOOD_EMOJIS[currentMemory.mood]} {currentMemory.mood}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleTogglePin}
                  className={`p-1.5 rounded-lg transition-colors ${
                    currentMemory.isPinned ? 'text-cyan-400 bg-cyan-950/60' : 'text-slate-400 hover:text-white'
                  }`}
                  title={currentMemory.isPinned ? 'Unpin' : 'Pin to top'}
                >
                  <Pin className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={`p-1.5 rounded-lg transition-colors ${
                    currentMemory.isFavorite ? 'text-rose-400 bg-rose-950/60' : 'text-slate-400 hover:text-white'
                  }`}
                  title={currentMemory.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart className={`w-4 h-4 ${currentMemory.isFavorite ? 'fill-rose-400' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2"
                  aria-label="Close details"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <h2 className="text-lg font-bold text-white mt-3 leading-snug">
              {currentMemory.title}
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>{currentMemory.date}</span>
              </span>
              {currentMemory.locationName && (
                <span className="flex items-center gap-1.5 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  <span>{currentMemory.locationName}</span>
                </span>
              )}
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-6 text-xs">
            {/* Description */}
            <div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-2 font-medium">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>Decrypted Content</span>
              </span>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed text-sm whitespace-pre-wrap">
                {currentMemory.description}
              </div>
            </div>

            {/* People & Tags */}
            {((currentMemory.people && currentMemory.people.length > 0) ||
              (currentMemory.tags && currentMemory.tags.length > 0)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {currentMemory.people && currentMemory.people.length > 0 && (
                  <div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1.5">
                      <Users className="w-3.5 h-3.5 text-purple-400" />
                      <span>People Involved:</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {currentMemory.people.map((p) => (
                        <span key={p} className="text-slate-300 font-medium">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {currentMemory.tags && currentMemory.tags.length > 0 && (
                  <div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1.5">
                      <TagIcon className="w-3.5 h-3.5 text-teal-400" />
                      <span>Tags:</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {currentMemory.tags.map((t) => (
                        <span key={t.id || t.name} className="text-teal-400 font-medium">
                          #{t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Attachments Section */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                  <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Attachments ({currentMemory.attachments?.length || 0})</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingFiles || isRecordingVoice}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-50"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Photos</span>
                  </button>

                  {!isRecordingVoice ? (
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      disabled={uploadingFiles}
                      className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 px-2 py-0.5 rounded bg-teal-950/60 border border-teal-800/60 hover:border-teal-700 disabled:opacity-50"
                    >
                      <Mic className="w-3 h-3" />
                      <span>Record Voice</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFiles || isRecordingVoice}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 disabled:opacity-50"
                  >
                    <Plus className="w-3 h-3" />
                    <span>File</span>
                  </button>
                </div>
              </div>

              {/* Active Voice Recording Bar */}
              {isRecordingVoice && (
                <div className="mb-3 p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/50 flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs font-mono text-rose-300 font-bold">
                      Recording: {Math.floor(recordingSecs / 60).toString().padStart(2, '0')}:{(recordingSecs % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={stopVoiceRecording}
                      className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold rounded flex items-center gap-1"
                    >
                      <Square className="w-3 h-3 fill-white" />
                      <span>Save Voice Note</span>
                    </button>
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="px-1.5 py-1 text-slate-400 hover:text-white text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {uploadingFiles && (
                <div className="mb-3 p-2 rounded-lg bg-cyan-950/50 border border-cyan-800/50 text-xs text-cyan-300 font-mono animate-pulse">
                  Encrypting and uploading media attachments...
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => handleUploadFiles(e.target.files)}
                multiple
                accept="image/*,audio/*,application/pdf"
                className="hidden"
              />
              <input
                type="file"
                ref={photoInputRef}
                onChange={(e) => handleUploadFiles(e.target.files)}
                multiple
                accept="image/*"
                className="hidden"
              />
              <input
                type="file"
                ref={audioInputRef}
                onChange={(e) => handleUploadFiles(e.target.files)}
                multiple
                accept="audio/*"
                className="hidden"
              />

              {currentMemory.attachments && currentMemory.attachments.length > 0 ? (
                <div className="space-y-3">
                  {currentMemory.attachments.map((att) => {
                    const url = api.getAttachmentUrl(att.id);
                    const isImg = att.mime_type.startsWith('image/');
                    const isAudio = att.mime_type.startsWith('audio/');
                    const isPdf = att.mime_type === 'application/pdf';

                    return (
                      <div
                        key={att.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 truncate">
                            {isImg ? (
                              <Paperclip className="w-3.5 h-3.5 text-teal-400" />
                            ) : isAudio ? (
                              <Music className="w-3.5 h-3.5 text-amber-400" />
                            ) : (
                              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                            )}
                            <span className="font-medium text-white truncate max-w-xs">
                              {att.original_filename}
                            </span>
                            <span className="text-slate-500 tabular-nums">
                              ({(att.file_size / 1024).toFixed(0)} KB)
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <a
                              href={url}
                              download={att.original_filename}
                              className="p-1 text-slate-400 hover:text-white"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="p-1 text-slate-400 hover:text-rose-400"
                              title="Delete attachment"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Image Preview */}
                        {isImg && (
                          <div className="h-44 w-full rounded-lg overflow-hidden bg-slate-900">
                            <img
                              src={url}
                              alt={att.original_filename}
                              className="w-full h-full object-contain"
                              loading="lazy"
                            />
                          </div>
                        )}

                        {/* Audio Player */}
                        {isAudio && (
                          <div className="pt-1">
                            <audio controls className="w-full h-8">
                              <source src={url} type={att.mime_type} />
                              Your browser does not support audio playback.
                            </audio>
                          </div>
                        )}

                        {/* PDF link */}
                        {isPdf && (
                          <div className="pt-1">
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                            >
                              <span>Open PDF in new tab</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 text-center">
                  No attachments yet. Add photos, voice notes, or documents.
                </div>
              )}
            </div>

            {/* Reminders tied to this memory */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                  <Bell className="w-3.5 h-3.5 text-orange-400" />
                  <span>Scheduled Reminders ({reminders.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddReminder(!showAddReminder)}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Set Reminder</span>
                </button>
              </div>

              {showAddReminder && (
                <form onSubmit={handleAddReminder} className="p-3 bg-slate-950 border border-slate-800 rounded-xl mb-3 space-y-2">
                  <label className="text-[11px] text-slate-300 block">Due Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    value={reminderDueDate}
                    onChange={(e) => setReminderDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-white text-xs"
                    required
                  />
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddReminder(false)}
                      className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-cyan-500 text-slate-950 font-semibold rounded text-xs"
                    >
                      Save Reminder
                    </button>
                  </div>
                </form>
              )}

              {reminders.length > 0 ? (
                <div className="space-y-2">
                  {reminders.map((rem) => (
                    <div
                      key={rem.id}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-slate-300">
                          Due: {rem.due_at.replace('T', ' ')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCompleteReminder(rem.id)}
                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-emerald-950 text-slate-400 hover:text-emerald-300 border border-slate-800 text-[11px] flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Done</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 text-center">
                  No reminders scheduled for this memory.
                </div>
              )}
            </div>

            {/* Extracted TF-IDF Terms */}
            <div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-2 font-medium">
                <TagIcon className="w-3.5 h-3.5 text-teal-400" />
                <span>Extracted TF-IDF Keywords</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {currentMemory.keywords && currentMemory.keywords.length > 0 ? (
                  currentMemory.keywords.map((kw) => (
                    <span key={kw} className="text-cyan-400 font-mono text-xs">
                      #{kw}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500">None extracted</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onDelete(currentMemory)}
            className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-rose-950/80 text-rose-400 hover:text-rose-200 border border-rose-900/40 text-xs flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit(currentMemory)}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Memory</span>
          </button>
        </div>
      </div>
    </div>
  );
};
