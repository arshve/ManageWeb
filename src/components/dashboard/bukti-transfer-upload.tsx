'use client';

import { useCallback, useState, useRef } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Lightbox } from '@/components/ui/lightbox';

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
    <div className="flex flex-wrap items-center gap-3">
      {photos.map((photo, index) => (
        <div key={photo.url} className="relative">
          <div className="w-14 h-14 rounded-md overflow-hidden border bg-muted">
            <button
              type="button"
              onClick={() => setPreviewUrl(photo.url)}
              className="block w-full h-full relative"
              title="Lihat bukti transfer"
            >
              <Image
                src={photo.url}
                alt="Bukti transfer"
                fill
                sizes="56px"
                className="object-cover"
              />
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleRemove(index)}
            disabled={removingUrl === photo.url}
            className="absolute -top-2 -right-2 bg-background border border-border hover:bg-destructive hover:text-destructive-foreground text-muted-foreground rounded-full p-1 transition-colors disabled:opacity-50 shadow-sm"
            title="Hapus"
          >
            {removingUrl === photo.url ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </button>
        </div>
      ))}

      {photos.length < MAX_PHOTOS && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-14 h-14 rounded-md border border-dashed border-muted-foreground/40 hover:border-muted-foreground hover:bg-muted/50 flex items-center justify-center text-muted-foreground transition-colors disabled:opacity-50"
          title={uploading ? 'Mengunggah...' : 'Tambah bukti transfer'}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Plus className="h-5 w-5" />
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
        <Lightbox
          src={previewUrl}
          alt="Bukti transfer"
          open={!!previewUrl}
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </div>
  );
}
