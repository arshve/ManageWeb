'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[error-boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold">Terjadi Kesalahan</h2>
      <p className="text-muted-foreground text-sm max-w-md">
        Maaf, terjadi kesalahan saat memproses halaman ini. Silakan coba lagi.
      </p>
      <Button onClick={reset}>Coba Lagi</Button>
    </div>
  );
}
