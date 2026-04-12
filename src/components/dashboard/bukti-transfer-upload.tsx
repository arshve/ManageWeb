/**
 * BuktiTransferUpload — Upload up to 5 bukti transfer photos.
 *
 * Each photo:
 * - Shows a file picker slot
 * - Uploads to /api/upload?folder=transfers on selection
 * - Displays as a clickable text link (alt label) that opens a lightbox
 * - Can be individually removed
 *
 * The final array of uploaded URLs is passed up via onChange so the
 * parent form can include them in the FormData before submitting.
 */

'use client';

import { useState, useRef } from 'react';
import { X, Paperclip, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

const MAX_PHOTOS = 5;

interface UploadedPhoto {
  url: string;
  label: string;
}

interface BuktiTransferUploadProps {
  /** Pre-existing URLs (edit mode) — component manages them alongside new uploads */
  initialUrls?: string[];
  onChange: (urls: string[]) => void;
}

export function BuktiTransferUpload({
  initialUrls = [],
  onChange,
}: BuktiTransferUploadProps) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>(
    initialUrls.map((url, i) => ({ url, label: `Bukti Transfer ${i + 1}` })),
  );
  const [uploading, setUploading] = useState(false);
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error('Hanya file gambar yang diperbolehkan');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran foto maksimal 5MB');
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      toast.error(`Maksimal ${MAX_PHOTOS} foto bukti transfer`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload?folder=transfers', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Gagal mengunggah foto');
      }

      const { url } = await res.json();
      const newPhotos = [
        ...photos,
        { url, label: `Bukti Transfer ${photos.length + 1}` },
      ];
      setPhotos(newPhotos);
      onChange(newPhotos.map((p) => p.url));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunggah foto');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(index: number) {
    const photo = photos[index];
    setRemovingUrl(photo.url);

    try {
      const res = await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: photo.url }),
      });
      if (!res.ok) console.warn('Failed to delete file:', photo.url);
    } catch {
      console.warn('Error deleting file:', photo.url);
    } finally {
      setRemovingUrl(null);
    }

    const newPhotos = photos
      .filter((_, i) => i !== index)
      .map((p, i) => ({ ...p, label: `Bukti Transfer ${i + 1}` }));
    setPhotos(newPhotos);
    onChange(newPhotos.map((p) => p.url));
  }

  return (
    <div className="space-y-2">
      {/* Uploaded photos list */}
      {photos.length > 0 && (
        <ul className="space-y-1.5">
          {photos.map((photo, index) => (
            <li key={photo.url} className="flex items-center gap-2 text-sm">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              {/* Clickable label — opens lightbox */}
              <button
                type="button"
                onClick={() => setPreviewUrl(photo.url)}
                className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors text-left"
              >
                {photo.label}
              </button>
              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={removingUrl === photo.url}
                className="ml-auto text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                title="Hapus"
              >
                {removingUrl === photo.url ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add photo button — hidden when max reached */}
      {photos.length < MAX_PHOTOS && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 rounded-md px-3 py-2 w-full transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
          <span>
            {uploading
              ? 'Mengunggah...'
              : photos.length === 0
                ? 'Tambah bukti transfer'
                : `Tambah lagi (${photos.length}/${MAX_PHOTOS})`}
          </span>
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Lightbox */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative max-w-lg w-full rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={previewUrl}
              alt="Bukti transfer"
              width={640}
              height={480}
              sizes="(max-width: 640px) 100vw, 640px"
              className="w-full h-auto object-contain"
            />
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
