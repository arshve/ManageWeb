export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getAvailableLivestock } from '@/app/actions/livestock';
import {
  CatalogueGrid,
  CatalogueGridSkeleton,
} from '@/components/catalogue/CatalogueGrid';

/* ─── SEO Metadata ──────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  title: 'Katalog Hewan Qurban — Millenials Farm',
  description:
    'Temukan sapi, domba, dan kambing qurban terbaik dengan harga transparan. Semua hewan dalam kondisi sehat dan siap qurban.',
  openGraph: {
    title: 'Katalog Hewan Qurban — Millenials Farm',
    description:
      'Temukan sapi, domba, dan kambing qurban terbaik dengan harga transparan.',
    type: 'website',
  },
};

/* ─── Async data component ───────────────────────────────────────────────── */
async function CatalogueData() {
  const livestock = await getAvailableLivestock();
  return <CatalogueGrid livestock={livestock} />;
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function CataloguePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* ── Hero header ──────────────────────────────────────────────────── */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 md:pt-24 pb-2">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-3">
            Katalog
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-[1.1] mb-4">
            Hewan Qurban
            <br />
            <span className="text-success-fg">
              Terpercaya
            </span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            Semua hewan dalam kondisi sehat, bobot terverifikasi, dan siap
            dikirim ke lokasi Anda.
          </p>
        </div>
      </header>

      {/* ── Grid with Suspense ────────────────────────────────────────────── */}
      <Suspense fallback={<CatalogueGridSkeleton />}>
        <CatalogueData />
      </Suspense>
    </main>
  );
}
