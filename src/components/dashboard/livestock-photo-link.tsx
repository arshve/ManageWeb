'use client';

import { useCallback, useState } from 'react';
import { Lightbox } from '@/components/ui/lightbox';

export function LivestockPhotoLink({
  photoUrl,
  alt,
  children,
  className,
}: {
  photoUrl: string | null;
  alt: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const onClose = useCallback(() => setOpen(false), []);

  if (!photoUrl) {
    return <span className={className}>{children}</span>;
  }

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }
        }}
        className={`${className ?? ''} underline decoration-dotted underline-offset-2 hover:text-primary cursor-zoom-in`}
        title="Lihat foto"
      >
        {children}
      </span>
      <Lightbox src={photoUrl} alt={alt} open={open} onClose={onClose} />
    </>
  );
}
