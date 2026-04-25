'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PublicHeader({
  dashboardHref,
  masukLabel,
}: {
  dashboardHref: string;
  masukLabel: string;
}) {
  const pathname = usePathname();
  const overHero = pathname === '/';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);

  const transparent = overHero && !scrolled;

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-colors duration-300 border-b',
        transparent
          ? 'bg-transparent border-transparent text-white'
          : 'bg-background/95 backdrop-blur border-border text-foreground',
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Millenials Farm" width={36} height={36} />
          <span className="text-base font-bold tracking-tight">
            MILLENIALS FARM
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          {[
            { href: '/', label: 'Beranda' },
            { href: '/catalogue', label: 'Katalog' },
            { href: '#about', label: 'Tentang' },
            { href: '#contact', label: 'Kontak' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'transition-colors',
                transparent
                  ? 'text-white/75 hover:text-white'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href={dashboardHref}
          className={cn(
            buttonVariants({ size: 'sm' }),
            'rounded-full px-5',
            transparent && 'bg-white text-black hover:bg-white/90',
          )}
        >
          {masukLabel}
        </Link>
      </div>
    </header>
  );
}
