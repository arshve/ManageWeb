'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SiteHeaderProps {
  dashboardHref: string;
  masukLabel: string;
}

export function SiteHeader({ dashboardHref, masukLabel }: SiteHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

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
        isScrolled
          ? 'bg-[#f7f4ed]/95 backdrop-blur-md border-b border-[#ede8dc]'
          : 'bg-transparent border-transparent',
      )}
    >
      <Link
        href="/"
        className={cn(
          'flex items-center gap-2.5 font-bold text-[14px] tracking-[0.12em] uppercase transition-colors duration-500',
          isScrolled ? 'text-[#1a1a14]' : 'text-white',
        )}
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-9 h-9"
        >
          <rect
            width="36"
            height="36"
            rx="8"
            fill={isScrolled ? 'rgba(26,47,26,0.1)' : 'rgba(255,255,255,0.15)'}
            className="transition-colors duration-500"
          />
          <path
            d="M8 26c0-5.523 4.477-10 10-10s10 4.477 10 10"
            stroke={isScrolled ? '#1a2f1a' : 'white'}
            strokeWidth="1.5"
            strokeLinecap="round"
            className="transition-colors duration-500"
          />
          <circle
            cx="18"
            cy="13"
            r="4"
            fill="none"
            stroke={isScrolled ? '#1a2f1a' : 'white'}
            strokeWidth="1.5"
            className="transition-colors duration-500"
          />
          <path
            d="M14 20l-4 6M22 20l4 6"
            stroke={isScrolled ? '#1a2f1a' : 'white'}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.6"
            className="transition-colors duration-500"
          />
        </svg>
        Millenials Farm
      </Link>

      <nav className="hidden md:flex items-center gap-8">
        {[
          { label: 'Beranda', href: '/' },
          { label: 'Katalog', href: '/catalogue' },
          { label: 'Tentang', href: '#about' },
          { label: 'Kontak', href: '#contact' },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              'text-[13px] font-medium tracking-[0.02em] transition-colors duration-200',
              isScrolled
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
          isScrolled ? 'bg-[#1a2f1a] text-white' : 'bg-white text-[#1a2f1a]',
        )}
      >
        {masukLabel}
      </Link>
    </header>
  );
}
