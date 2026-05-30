'use client';

import { useEffect, useState, useCallback } from 'react';

// Built-in default slides (3 responsive variants each). Used when the owner
// hasn't configured a custom carousel.
const DEFAULT_SLIDES = [
  {
    mobile: '/caraosel/website-mobile.png',
    tab: '/caraosel/website-tab.png',
    desktop: '/caraosel/website-destop.png',
    alt: 'Millenials Farm — Qurban Ga Pake Ribet',
  },
  {
    mobile: '/caraosel/website-mobile-2.png',
    tab: '/caraosel/website-tab-2.png',
    desktop: '/caraosel/website-destop-2.png',
    alt: 'Millenials Farm — Price List 2026',
  },
];

const AUTOPLAY_MS = 6000;

type ConfiguredSlide = { desktop: string; tab?: string; mobile?: string; alt?: string };

export function HeroCarousel({ slides }: { slides?: ConfiguredSlide[] | null }) {
  // Configured slides + defaults both render <picture> with per-breakpoint
  // sources; tab/mobile fall back to desktop when not provided.
  const configured = slides && slides.length > 0
    ? slides
    : DEFAULT_SLIDES.map((s) => ({ desktop: s.desktop, tab: s.tab, mobile: s.mobile, alt: s.alt }));
  const count = configured.length;
  const [index, setIndex] = useState(0);

  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [next, count]);

  return (
    <>
      {configured.map((slide, i) => {
        const tab = slide.tab || slide.desktop;
        const mobile = slide.mobile || slide.tab || slide.desktop;
        return (
          <picture
            key={`${slide.desktop}-${i}`}
            className={`absolute inset-0 transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}
          >
            <source media="(min-width: 1024px)" srcSet={slide.desktop} />
            <source media="(min-width: 640px)" srcSet={tab} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mobile}
              alt={slide.alt || `Slide ${i + 1}`}
              className="absolute inset-0 w-full h-full object-cover"
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          </picture>
        );
      })}

      {/* Dots Indicator */}
      {count > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}
