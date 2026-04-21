import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getProfile, dashboardUrlForRole } from '@/lib/auth';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  const dashboardHref = profile ? dashboardUrlForRole(profile.role) : '/login';
  const masukLabel = profile ? 'Dashboard' : 'Masuk';
  return (
    <>
      {/* Header — clean, minimal, Squarespace-style */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight">
              MILLENIALS FARM
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Beranda
            </Link>
            <Link
              href="/catalogue"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Katalog
            </Link>
            <Link
              href="#about"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Tentang
            </Link>
            <Link
              href="#contact"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Kontak
            </Link>
          </nav>
          <Link
            href={dashboardHref}
            className={cn(
              buttonVariants({ size: 'sm' }),
              'rounded-full px-5',
            )}
          >
            {masukLabel}
          </Link>
        </div>
      </header>

      {children}

      {/* Footer — dark, clean, Squarespace-style */}
      <footer className="bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-2">
              <h3 className="text-lg font-bold tracking-tight mb-4">
                MILLENIALS FARM
              </h3>
              <p className="text-sm opacity-60 leading-relaxed max-w-sm">
                PT. Millenials Farm Abadi — supplier hewan ternak terpercaya
                untuk ibadah qurban Anda. Menyediakan kambing, domba, dan sapi
                berkualitas.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold tracking-wide uppercase opacity-40 mb-4">
                Alamat
              </h4>
              <p className="text-sm opacity-60 leading-relaxed">
                Jalan Mahoni 2 No. 12A
                <br />
                Rt. 001 Rw. 003, Pamulang
                <br />
                Kota Tangerang Selatan
                <br />
                Banten
              </p>
            </div>
            <div id="contact">
              <h4 className="text-sm font-semibold tracking-wide uppercase opacity-40 mb-4">
                Kontak
              </h4>
              <div className="space-y-2 text-sm opacity-60">
                <p>Instagram: @millenialsfarm_</p>
                <p>PT. Millenials Farm Abadi</p>
              </div>
            </div>
          </div>
          <div className="border-t border-background/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs opacity-40">
            <p>
              &copy; {new Date().getFullYear()} Millenials Farm. All rights
              reserved. Made with <span className="grayscale">❤️</span> by{' '}
              <a href="https://www.instagram.com/farvnn/" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity underline underline-offset-2">farvnn</a>
            </p>
            <div className="flex gap-6">
              <Link
                href="/catalogue"
                className="hover:opacity-100 transition-opacity"
              >
                Katalog
              </Link>
              <Link
                href={dashboardHref}
                className="hover:opacity-100 transition-opacity"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
