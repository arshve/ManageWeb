import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold">Halaman Tidak Ditemukan</h2>
      <p className="text-muted-foreground text-sm">
        Halaman yang Anda cari tidak ada atau telah dipindahkan.
      </p>
      <Link href="/" className={buttonVariants({ variant: 'outline' })}>
        Kembali ke Beranda
      </Link>
    </div>
  );
}
