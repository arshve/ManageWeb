'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[error-boundary]', error);
  }, [error]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center px-4">
      <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-dm-serif), 'DM Serif Display', serif" }}>
        Terjadi Kesalahan
      </h2>
      <p className="text-muted-foreground text-sm max-w-md">
        Maaf, terjadi kesalahan saat memproses halaman ini. Silakan coba lagi.
      </p>
      <div className="flex gap-3 mt-2">
        <Button onClick={reset}>Coba Lagi</Button>
        <Button variant="outline" onClick={handleLogout}>Keluar</Button>
      </div>
    </div>
  );
}
