/**
 * LivestockPhoto — Thumbnail with lightbox preview for the admin livestock table.
 *
 * Shows a small 40x40 avatar-style thumbnail in the table row.
 * Clicking it opens a centered lightbox overlay with the full image.
 * Clicking the overlay or the X button closes it.
 */
'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import { Beef } from 'lucide-react';
import { Lightbox } from '@/components/ui/lightbox';

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
  const onClose = useCallback(() => setOpen(false), []);

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

      <Lightbox src={photoUrl} alt={alt} open={open} onClose={onClose} />
    </>
  );
}
