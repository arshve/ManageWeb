import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';
import { HeroCarousel } from '@/components/landing/hero-carousel';

export default function HomePage() {
  return (
    <main>
      {/* New Hero — Balanced visibility and readability */}
      <section className="relative w-full h-[100svh] min-h-[700px] flex items-center justify-center overflow-hidden bg-[#1a2f1a]">
        {/* Background Image Carousel */}
        <div className="absolute inset-0 z-0">
          <HeroCarousel />
        </div>

        {/* 1. Lighter Green Gradient + Softer Blur */}
        {/* We reduced the opacity significantly so the banner shows through, and lowered the blur to 2px */}
        <div
          className="absolute inset-0 z-10 backdrop-blur-[2px]"
          style={{
            background:
              'linear-gradient(160deg, rgba(20,38,20,0.5) 0%, rgba(20,38,20,0.2) 50%, rgba(20,38,20,0.5) 100%)',
          }}
        />

        {/* 2. Targeted Ellipse Shadow */}
        {/* This creates a horizontal dark pill *only* behind the text, leaving the rest of the banner bright */}
        <div className="absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,_rgba(0,0,0,0.6)_0%,_transparent_45%)]" />

        {/* Content */}
        <div className="relative z-20 text-center max-w-[900px] px-6 pt-[68px]">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] uppercase text-white/90 mb-6 border border-white/30 rounded-full px-4 py-1.5 backdrop-blur-md bg-black/30">
            <span className="w-[5px] h-[5px] rounded-full bg-[#7bcf8e] animate-pulse" />
            Suplier Hewan Ternak Sejak 2019
          </div>

          {/* Main Heading - Heavy Text Shadow protects readability against the brighter background */}
          <h1 className="font-serif text-[clamp(48px,7vw,96px)] font-normal leading-[1.0] text-white mb-7 [text-shadow:_0_2px_15px_rgba(0,0,0,0.8),_0_10px_40px_rgba(0,0,0,0.6)]">
            Best animal for
            <br />
            the <em className="italic text-[#a8d5b4]">best customer.</em>
          </h1>

          {/* Subtitle */}
          <p className="text-[clamp(15px,1.5vw,19px)] text-white max-w-[520px] mx-auto mb-10 leading-[1.65] font-medium [text-shadow:_0_2px_10px_rgba(0,0,0,0.9)]">
            PT. Millenials Farm Abadi — kambing, domba, dan sapi pilihan
            langsung dari peternakan kami di Pamulang. Sehat, terverifikasi, dan
            siap kirim ke seluruh Jabodetabek.
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap gap-3.5 justify-center">
            <Link
              href="/catalogue"
              className="inline-flex items-center gap-2 bg-[#4a7c59] text-white px-8 py-3.5 rounded-full text-[14px] font-semibold transition-all duration-200 hover:bg-[#3a6347] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(74,124,89,0.4)]"
            >
              Lihat Katalog
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="#about"
              className="inline-flex items-center gap-2 bg-black/30 text-white border border-white/30 px-8 py-3.5 rounded-full text-[14px] font-medium backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:-translate-y-0.5"
            >
              Pelajari Lebih
            </Link>
          </div>
        </div>

        {/* Bouncing Scroll Indicator (Text only) */}
        <div className="absolute bottom-9 left-1/2 -translate-x-1/2 z-20 text-white/80 text-[10px] tracking-[0.12em] uppercase animate-bounce cursor-default [text-shadow:_0_2px_10px_rgba(0,0,0,0.8)]">
          Scroll
        </div>
      </section>

      {/* Divider band */}
      <div className="border-t border-border" />

      {/* Value props — large text blocks, generous whitespace */}
      <section className="py-24 md:py-32 px-4 bg-background text-foreground">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm font-medium tracking-widest uppercase text-muted-foreground mb-6">
            Kenapa Millenials Farm
          </p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight max-w-3xl mb-20">
            Setiap hewan dipilih dengan teliti, dirawat dengan baik, dan siap
            untuk ibadah qurban Anda.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
            {[
              {
                num: '01',
                title: 'Grading Transparan',
                desc: 'Sistem grading jelas (Super, A, B, C, D) berdasarkan berat dan kualitas. Anda tahu persis apa yang Anda dapatkan.',
              },
              {
                num: '02',
                title: 'Terpercaya & Resmi',
                desc: 'PT. Millenials Farm Abadi — terdaftar resmi sebagai supplier hewan ternak di Tangerang Selatan.',
              },
              {
                num: '03',
                title: 'Pengiriman Jabodetabek',
                desc: 'Layanan pengiriman langsung ke lokasi Anda. Hewan diantar dalam kondisi sehat dan siap qurban.',
              },
            ].map((item) => (
              <div key={item.num}>
                <p className="text-sm font-medium text-muted-foreground mb-4">
                  {item.num}
                </p>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Full-width dark band — animal types */}
      <section
        id="about"
        className="bg-foreground text-background py-24 md:py-32 px-4"
      >
        <div className="max-w-6xl mx-auto">
          <p className="text-sm font-medium tracking-widest uppercase opacity-50 mb-6">
            Jenis Hewan Qurban
          </p>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight max-w-3xl mb-16">
            Tiga pilihan hewan qurban, semua berkualitas premium.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-background/10">
            {[
              {
                name: 'Kambing',
                weight: '15 — 50+ kg',
                grades: 'Super, A, B, C, D',
                desc: 'Pilihan paling populer untuk qurban perorangan. Dirawat sehat dan gemuk.',
              },
              {
                name: 'Domba',
                weight: '20 — 50+ kg',
                grades: 'Super, A, B, C, D',
                desc: 'Domba pilihan dengan bulu tebal dan badan gemuk, siap qurban.',
              },
              {
                name: 'Sapi',
                weight: '200 — 400+ kg',
                grades: '—',
                desc: 'Untuk qurban berjamaah. Sapi sehat dengan bobot optimal.',
              },
            ].map((animal) => (
              <div
                key={animal.name}
                className="bg-foreground p-8 md:p-10 flex flex-col justify-between min-h-[280px]"
              >
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-4">
                    {animal.name}
                  </h3>
                  <p className="opacity-60 leading-relaxed mb-6">
                    {animal.desc}
                  </p>
                </div>
                <div className="space-y-1 text-sm opacity-50">
                  <p>Berat: {animal.weight}</p>
                  <p>Grade: {animal.grades}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="py-20 md:py-28 px-4 border-b bg-background text-foreground">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center">
          {[
            { value: '200+', label: 'Hewan Terjual' },
            { value: '3', label: 'Jenis Hewan' },
            { value: '5', label: 'Tingkat Grade' },
            { value: '15+', label: 'Sales Aktif' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
                {stat.value}
              </p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA — minimal, clean */}
      <section className="py-24 md:py-32 px-4 bg-background text-foreground">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
            Siap memilih hewan qurban?
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
            Lihat katalog lengkap kami dan temukan hewan yang tepat untuk ibadah
            qurban Anda.
          </p>
          <Link
            href="/catalogue"
            className={cn(
              buttonVariants({ size: 'lg' }),
              'rounded-full px-8 text-base gap-2',
            )}
          >
            Buka Katalog
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
