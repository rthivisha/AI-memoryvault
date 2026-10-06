import React, { useState, useEffect, useMemo } from 'react';
import {
  Image as ImageIcon,
  Filter,
  Calendar,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Download,
  Video,
  Play,
  Mic,
  Music,
  Volume2,
  Sparkles,
  Layers,
} from 'lucide-react';
import { api } from '../api';
import { CategoryType, GalleryItem } from '../types';

interface Props {
  onSelectMemoryById: (memoryId: string) => void;
  onNavigateAdd: () => void;
}

const CATEGORIES: CategoryType[] = [
  'ACHIEVEMENT',
  'EVENT',
  'STUDY',
  'TRAVEL',
  'REMINDER',
  'PERSONAL',
];

export const isAudioItem = (item: GalleryItem): boolean => {
  const mime = (item.mime_type || '').toLowerCase();
  const name = (item.original_filename || '').toLowerCase();
  return (
    mime.startsWith('audio/') ||
    name.endsWith('.mp3') ||
    name.endsWith('.wav') ||
    name.endsWith('.m4a') ||
    name.endsWith('.aac') ||
    name.endsWith('.ogg') ||
    (name.endsWith('.webm') && (mime.includes('audio') || name.includes('voice'))) ||
    name.startsWith('voice_recording')
  );
};

export const isVideoItem = (item: GalleryItem): boolean => {
  if (isAudioItem(item)) return false;
  const mime = (item.mime_type || '').toLowerCase();
  const name = (item.original_filename || '').toLowerCase();
  return (
    mime.startsWith('video/') ||
    name.endsWith('.mp4') ||
    name.endsWith('.mov') ||
    name.endsWith('.webm') ||
    name.endsWith('.mkv') ||
    name.endsWith('.avi')
  );
};

export const isPhotoItem = (item: GalleryItem): boolean => {
  if (isAudioItem(item) || isVideoItem(item)) return false;
  const mime = (item.mime_type || '').toLowerCase();
  const name = (item.original_filename || '').toLowerCase();
  return (
    mime.startsWith('image/') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp') ||
    name.endsWith('.gif') ||
    name.endsWith('.svg')
  );
};

export const GalleryView: React.FC<Props> = ({ onSelectMemoryById, onNavigateAdd }) => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'photo' | 'audio' | 'video'>('all');

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const fetchGallery = async () => {
    setLoading(true);
    try {
      const data = await api.listGallery({
        category: categoryFilter || undefined,
        year: yearFilter || undefined,
        type: mediaTypeFilter !== 'all' ? mediaTypeFilter : undefined,
      });
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, [categoryFilter, yearFilter, mediaTypeFilter]);

  // Compute live media counts
  const counts = useMemo(() => {
    let photos = 0;
    let audios = 0;
    let videos = 0;
    items.forEach((it) => {
      if (isAudioItem(it)) audios++;
      else if (isVideoItem(it)) videos++;
      else photos++;
    });
    return { photos, audios, videos, total: items.length };
  }, [items]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : items.length - 1));
        setZoomLevel(1);
      }
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev !== null && prev < items.length - 1 ? prev + 1 : 0));
        setZoomLevel(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, items.length]);

  const activeItem = lightboxIndex !== null ? items[lightboxIndex] : null;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <span>Visual &amp; Voice Vault</span>
              <span aria-hidden="true">·</span>
              <span>Encrypted Storage</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{items.length} media records</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Photo, Audio &amp; Media Gallery
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Explore your photos, voice recordings, and video clips across all memories and timelines.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-3 py-2 focus:border-cyan-500 focus:outline-none"
            >
              <option value="">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
              <option value="2022">2022</option>
            </select>

            {(categoryFilter || yearFilter || mediaTypeFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('');
                  setYearFilter('');
                  setMediaTypeFilter('all');
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 px-2 py-1 cursor-pointer underline"
              >
                Reset All
              </button>
            )}
          </div>
        </div>

        {/* Media Format Filter Pills (Photo, Voice/Audio, Video, All) */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-800/80">
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Format:</span>
          </span>

          <button
            type="button"
            onClick={() => setMediaTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
              mediaTypeFilter === 'all'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
            }`}
          >
            <span>All Media</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded ${mediaTypeFilter === 'all' ? 'bg-cyan-900/60 text-cyan-100' : 'bg-slate-900 text-slate-400'}`}>
              {counts.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMediaTypeFilter('photo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
              mediaTypeFilter === 'photo'
                ? 'bg-teal-500 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photos</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded ${mediaTypeFilter === 'photo' ? 'bg-teal-900/60 text-teal-100' : 'bg-slate-900 text-slate-400'}`}>
              {counts.photos}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMediaTypeFilter('audio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
              mediaTypeFilter === 'audio'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voice &amp; Audio</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded ${mediaTypeFilter === 'audio' ? 'bg-amber-900/60 text-amber-100' : 'bg-slate-900 text-slate-400'}`}>
              {counts.audios}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMediaTypeFilter('video')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
              mediaTypeFilter === 'video'
                ? 'bg-indigo-500 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Videos</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded ${mediaTypeFilter === 'video' ? 'bg-indigo-900/60 text-indigo-100' : 'bg-slate-900 text-slate-400'}`}>
              {counts.videos}
            </span>
          </button>
        </div>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-slate-900 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item, index) => {
            const url = api.getAttachmentUrl(item.id);
            const isAud = isAudioItem(item);
            const isVid = isVideoItem(item);
            const isImg = isPhotoItem(item);

            return (
              <div
                key={item.id}
                onClick={() => {
                  setLightboxIndex(index);
                  setZoomLevel(1);
                }}
                className="group relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-cyan-500/60 cursor-pointer transition-all flex flex-col justify-between shadow-md"
              >
                {/* 1. AUDIO & VOICE NOTE CARD */}
                {isAud ? (
                  <div className="p-4 flex flex-col justify-between h-64 bg-gradient-to-b from-amber-950/40 via-slate-900/90 to-slate-950">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                          <Mic className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-mono text-amber-300 uppercase tracking-wider font-bold">
                          Voice Note
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800">
                        {(item.file_size / 1024).toFixed(0)} KB
                      </span>
                    </div>

                    {/* Animated sound equalizer bars */}
                    <div className="my-2 p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-center gap-1.5 h-16">
                      <div className="w-1.5 bg-amber-400/90 rounded-full h-5 animate-pulse" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 bg-amber-400/90 rounded-full h-10 animate-pulse" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 bg-amber-400/90 rounded-full h-7 animate-pulse" style={{ animationDelay: '300ms' }} />
                      <div className="w-1.5 bg-amber-400/90 rounded-full h-12 animate-pulse" style={{ animationDelay: '80ms' }} />
                      <div className="w-1.5 bg-amber-400/90 rounded-full h-6 animate-pulse" style={{ animationDelay: '220ms' }} />
                      <div className="w-1.5 bg-amber-400/90 rounded-full h-11 animate-pulse" style={{ animationDelay: '350ms' }} />
                      <div className="w-1.5 bg-amber-400/90 rounded-full h-4 animate-pulse" style={{ animationDelay: '120ms' }} />
                    </div>

                    {/* Audio Player */}
                    <div
                      className="w-full pt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <audio
                        src={url}
                        controls
                        preload="metadata"
                        className="w-full h-8"
                      >
                        Your browser does not support audio playback.
                      </audio>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80">
                      <div className="text-[11px] text-amber-400 font-mono">
                        {item.memory_category}
                      </div>
                      <h4 className="text-xs font-semibold text-white truncate">
                        {item.memory_title || item.original_filename}
                      </h4>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.memory_date}
                      </div>
                    </div>
                  </div>
                ) : isVid ? (
                  /* 2. VIDEO CARD */
                  <div className="relative aspect-square w-full h-64 bg-black">
                    <video
                      src={url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                    <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-indigo-400 shadow-md">
                      <Video className="w-4 h-4" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent p-3 flex flex-col justify-end">
                      <div className="text-[11px] text-cyan-400 font-mono flex items-center justify-between">
                        <span>{item.memory_category}</span>
                        <span className="text-indigo-300 text-[10px]">VIDEO</span>
                      </div>
                      <h4 className="text-xs font-semibold text-white truncate">
                        {item.memory_title}
                      </h4>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.memory_date}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 3. PHOTO / IMAGE CARD */
                  <div className="relative aspect-square w-full h-64 bg-slate-950">
                    <img
                      src={url}
                      alt={item.memory_title || item.original_filename}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                      <div className="text-[11px] text-teal-400 font-mono">
                        {item.memory_category}
                      </div>
                      <h4 className="text-xs font-semibold text-white truncate">
                        {item.memory_title}
                      </h4>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.memory_date}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center">
          <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No Media Records Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {categoryFilter || yearFilter || mediaTypeFilter !== 'all'
              ? 'No media matches your filter criteria. Try resetting filters.'
              : 'Add memories with photos, voice recordings, or videos to populate your gallery.'}
          </p>
          <button
            type="button"
            onClick={onNavigateAdd}
            className="mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Record Memory with Photos or Audio
          </button>
        </div>
      )}

      {/* Lightbox Modal */}
      {activeItem && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Top Bar */}
          <div
            className="w-full max-w-6xl flex items-center justify-between text-white z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">
                {lightboxIndex + 1} / {items.length}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-xs text-cyan-400 font-mono">{activeItem.memory_category}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-sm font-medium text-white truncate max-w-sm">
                {activeItem.memory_title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isAudioItem(activeItem) && !isVideoItem(activeItem) && (
                <>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                    className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                    className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </>
              )}
              <a
                href={api.getAttachmentUrl(activeItem.id)}
                download={activeItem.original_filename}
                className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
              {activeItem.memory_id && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeItem.memory_id) {
                      onSelectMemoryById(activeItem.memory_id);
                      setLightboxIndex(null);
                    }
                  }}
                  className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Memory</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white ml-2 cursor-pointer"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Media Canvas with Controls */}
          <div
            className="flex-1 w-full max-w-6xl flex items-center justify-between relative my-2 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : items.length - 1));
                setZoomLevel(1);
              }}
              className="p-3 rounded-full bg-slate-900/60 hover:bg-slate-800 text-white z-10 transition-colors cursor-pointer"
              title="Previous (Left Arrow)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div className="flex-1 h-full flex items-center justify-center overflow-auto p-4">
              {isAudioItem(activeItem) ? (
                /* Lightbox Audio Player */
                <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center shadow-2xl space-y-5">
                  <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 shadow-lg">
                    <Mic className="w-10 h-10" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                      AUDIO RECORDING
                    </span>
                    <h3 className="text-base font-bold text-white mt-2">
                      {activeItem.memory_title || activeItem.original_filename}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                      {activeItem.original_filename}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <audio
                      src={api.getAttachmentUrl(activeItem.id)}
                      controls
                      autoPlay
                      preload="metadata"
                      className="w-full h-10"
                    >
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                </div>
              ) : isVideoItem(activeItem) ? (
                /* Lightbox Video Player */
                <video
                  src={api.getAttachmentUrl(activeItem.id)}
                  controls
                  playsInline
                  autoPlay
                  className="max-h-[80vh] max-w-full rounded-lg bg-black"
                >
                  Your browser does not support video playback.
                </video>
              ) : (
                /* Lightbox Photo / Image */
                <img
                  src={api.getAttachmentUrl(activeItem.id)}
                  alt={activeItem.original_filename}
                  className="max-h-[80vh] max-w-full object-contain rounded-lg transition-transform duration-200"
                  style={{ transform: `scale(${zoomLevel})` }}
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setLightboxIndex((prev) => (prev !== null && prev < items.length - 1 ? prev + 1 : 0));
                setZoomLevel(1);
              }}
              className="p-3 rounded-full bg-slate-900/60 hover:bg-slate-800 text-white z-10 transition-colors cursor-pointer"
              title="Next (Right Arrow)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Bottom Info Footer */}
          <div
            className="w-full max-w-6xl text-center text-xs text-slate-400"
            onClick={(e) => e.stopPropagation()}
          >
            <span>{activeItem.original_filename}</span>
            <span aria-hidden="true" className="mx-2">·</span>
            <span>Recorded on {activeItem.memory_date}</span>
            <span aria-hidden="true" className="mx-2">·</span>
            <span className="tabular-nums">{(activeItem.file_size / 1024).toFixed(0)} KB</span>
          </div>
        </div>
      )}
    </div>
  );
};
