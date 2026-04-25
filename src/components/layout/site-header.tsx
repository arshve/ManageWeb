'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface SiteHeaderProps {
  dashboardHref: string;
  masukLabel: string;
}

export function SiteHeader({ dashboardHref, masukLabel }: SiteHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const isCatalogue = pathname?.startsWith('/catalogue') ?? false;
  const opaque = isScrolled || isCatalogue;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 60);
    };

    handleScroll(); // Check on mount
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 h-[68px] flex items-center justify-between px-6 md:px-12 transition-all duration-500 font-sans',
        opaque
          ? 'bg-[#f7f4ed]/95 backdrop-blur-md border-b border-[#ede8dc]'
          : 'bg-transparent border-transparent',
      )}
    >
      <Link
        href="/"
        className={cn(
          'flex items-center gap-2.5 font-bold text-[14px] tracking-[0.12em] uppercase transition-colors duration-500',
          opaque ? 'text-[#1a1a14]' : 'text-white',
        )}
      >
        <Image
          src="/logofix.png"
          alt="Millenials Farm"
          width={36}
          height={36}
          className={cn(
            'transition-all duration-500',
            // If your logo.png is white, this turns it black when scrolling.
            // If your logo is naturally black, change this to: !isScrolled && "brightness-0 invert"
            opaque && 'brightness-0',
          )}
        />
        Millenials Farm
      </Link>

      <nav className="hidden md:flex items-center gap-8">
        {[
          { label: 'Beranda', href: '/' },
          { label: 'Katalog', href: '/catalogue' },
          { label: 'Tentang', href: '#about' },
          { label: 'Kontak', href: '#contact' },
        ]
          .filter((item) => !isCatalogue || !item.href.startsWith('#'))
          .map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'text-[13px] font-medium tracking-[0.02em] transition-colors duration-200',
              opaque
                ? 'text-[#5a5a48] hover:text-[#1a1a14]'
                : 'text-white/75 hover:text-white',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <Link
        href={dashboardHref}
        className={cn(
          'px-5 py-2 rounded-full text-[13px] font-semibold tracking-[0.02em] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)]',
          opaque ? 'bg-[#1a2f1a] text-white' : 'bg-white text-[#1a2f1a]',
        )}
      >
        {masukLabel}
      </Link>
    </header>
  );
}
