'use client';

import { useEffect, useState, useCallback } from 'react';

const SLIDES = [
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

export function HeroCarousel() {
  const [index, setIndex] = useState(0);

  const next = useCallback(() => setIndex((i) => (i + 1) % SLIDES.length), []);

  useEffect(() => {
    const id = setInterval(next, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [next]);

  return (
    <>
      {SLIDES.map((slide, i) => (
        <picture
          key={slide.desktop}
          className={`absolute inset-0 transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}
        >
          <source media="(min-width: 1024px)" srcSet={slide.desktop} />
          <source media="(min-width: 640px)" srcSet={slide.tab} />
          <img
            src={slide.mobile}
            alt={slide.alt}
            className="absolute inset-0 w-full h-full object-cover"
            loading={i === 0 ? 'eager' : 'lazy'}
          />
        </picture>
      ))}

      {/* Dots Indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {SLIDES.map((_, i) => (
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
    </>
  );
}
