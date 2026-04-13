'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';

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
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
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
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
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
