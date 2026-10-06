import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { api } from '../api';
import { CategoryType, GalleryItem, Memory } from '../types';

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

export const GalleryView: React.FC<Props> = ({ onSelectMemoryById, onNavigateAdd }) => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [yearFilter, setYearFilter] = useState<string>('');

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  const fetchGallery = async () => {
    setLoading(true);
    try {
      const data = await api.listGallery({
        category: categoryFilter || undefined,
        year: yearFilter || undefined,
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
  }, [categoryFilter, yearFilter]);

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
              <span>Visual Vault</span>
              <span aria-hidden="true">·</span>
              <span>Encrypted Storage</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{items.length} media items</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Photo &amp; Media Gallery</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Explore your photographic memories across all categories and timelines.
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

            {(categoryFilter || yearFilter) && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('');
                  setYearFilter('');
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 px-2 py-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Masonry / Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square bg-slate-900 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item, index) => {
            const url = api.getAttachmentUrl(item.id);
            return (
              <div
                key={item.id}
                onClick={() => {
                  setLightboxIndex(index);
                  setZoomLevel(1);
                }}
                className="group relative aspect-square rounded-xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-cyan-500/60 cursor-pointer transition-all"
              >
                <img
                  src={url}
                  alt={item.memory_title || item.original_filename}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                  <div className="text-[11px] text-cyan-400 font-mono">
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
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center">
          <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No Photos or Images Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {categoryFilter || yearFilter
              ? 'No media matches your filter criteria. Try resetting filters.'
              : 'Add photo memories with image attachments to populate your visual gallery.'}
          </p>
          <button
            type="button"
            onClick={onNavigateAdd}
            className="mt-4 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold rounded-lg transition-colors"
          >
            Create Memory with Photos
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
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <a
                href={api.getAttachmentUrl(activeItem.id)}
                download={activeItem.original_filename}
                className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white"
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
                  className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-semibold flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Memory</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white ml-2"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Image Canvas with Controls */}
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
              className="p-3 rounded-full bg-slate-900/60 hover:bg-slate-800 text-white z-10 transition-colors"
              title="Previous (Left Arrow)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div className="flex-1 h-full flex items-center justify-center overflow-auto p-2">
              <img
                src={api.getAttachmentUrl(activeItem.id)}
                alt={activeItem.original_filename}
                className="max-h-[80vh] max-w-full object-contain rounded-lg transition-transform duration-200"
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setLightboxIndex((prev) => (prev !== null && prev < items.length - 1 ? prev + 1 : 0));
                setZoomLevel(1);
              }}
              className="p-3 rounded-full bg-slate-900/60 hover:bg-slate-800 text-white z-10 transition-colors"
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
