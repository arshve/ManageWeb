'use client';

import { useState, useRef } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

const MAX_PHOTOS = 5;

interface UploadedPhoto {
  url: string;
  isNew: boolean; // true = just uploaded, not yet in DB
}

interface BuktiTransferUploadProps {
  /** Pre-existing URLs (edit mode) — component manages them alongside new uploads */
  initialUrls?: string[];
  onChange: (urls: string[]) => void;
}

async function deleteFromStorage(url: string) {
  try {
    const res = await fetch('/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) console.warn('Failed to delete file from storage:', url);
  } catch {
    console.warn('Error deleting file from storage:', url);
  }
}

export function BuktiTransferUpload({
  initialUrls = [],
  onChange,
}: BuktiTransferUploadProps) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>(
    initialUrls.map((url) => ({ url, isNew: false })),
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
      const newPhotos = [...photos, { url, isNew: true }];
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

    // New uploads (not yet saved) are deleted from storage immediately.
    // Existing DB photos are cleaned up server-side after updateEntry saves.
    if (photo.isNew) {
      await deleteFromStorage(photo.url);
    }

    setRemovingUrl(null);

    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    onChange(newPhotos.map((p) => p.url));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {photos.map((photo, index) => (
        <div
          key={photo.url}
          className="relative w-9 h-9 rounded-md overflow-hidden border bg-muted"
        >
          <button
            type="button"
            onClick={() => setPreviewUrl(photo.url)}
            className="block w-full h-full"
            title="Lihat bukti transfer"
          >
            <Image
              src={photo.url}
              alt="Bukti transfer"
              fill
              sizes="36px"
              className="object-cover"
            />
          </button>
          <button
            type="button"
            onClick={() => handleRemove(index)}
            disabled={removingUrl === photo.url}
            className="absolute -top-1 -right-1 bg-background border border-border hover:bg-destructive hover:text-destructive-foreground text-muted-foreground rounded-full p-0.5 transition-colors disabled:opacity-50 shadow-sm"
            title="Hapus"
          >
            {removingUrl === photo.url ? (
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
            ) : (
              <X className="h-2.5 w-2.5" />
            )}
          </button>
        </div>
      ))}

      {photos.length < MAX_PHOTOS && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-9 h-9 rounded-md border border-dashed border-muted-foreground/40 hover:border-muted-foreground hover:bg-muted/50 flex items-center justify-center text-muted-foreground transition-colors disabled:opacity-50"
          title={uploading ? 'Mengunggah...' : 'Tambah bukti transfer'}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

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
