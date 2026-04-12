/**
 * LivestockPhoto — Thumbnail with lightbox preview for the admin livestock table.
 *
 * Shows a small 40x40 avatar-style thumbnail in the table row.
 * Clicking it opens a centered lightbox overlay with the full image.
 * Clicking the overlay or the X button closes it.
 */
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, Beef } from 'lucide-react';

export function LivestockPhoto({
  photoUrl,
  alt,
  thumbnailClassName = 'w-10 h-10',
  priority = false,
}: {
  photoUrl: string | null;
  alt: string;
  thumbnailClassName?: string;
  priority?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!photoUrl) {
    return (
      <div
        className={`${thumbnailClassName} rounded bg-muted flex items-center justify-center flex-shrink-0`}
      >
        <Beef className="h-4 w-4 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <>
      {/* Thumbnail — size controlled by thumbnailClassName */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${thumbnailClassName} rounded-md overflow-hidden relative flex-shrink-0 ring-1 ring-border hover:ring-2 hover:ring-primary transition-all cursor-zoom-in`}
        title="Lihat foto"
      >
        <Image
          src={photoUrl}
          alt={alt}
          fill
          sizes={thumbnailClassName.includes('w-24') ? '96px' : '40px'}
          loading={priority ? 'eager' : 'lazy'}
          priority={priority}
          className="object-cover"
        />
      </button>

      {/* Lightbox overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-w-lg w-full rounded-lg overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={photoUrl}
              alt={alt}
              width={640}
              height={480}
              sizes="(max-width: 640px) 100vw, 640px"
              className="w-full h-auto object-contain"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
