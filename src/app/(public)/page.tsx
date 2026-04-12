import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main>
      {/* Hero — full viewport, centered bold text, Squarespace-style */}
      <section className="min-h-[90vh] flex items-center justify-center px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-8">
            Qurban yang
            <br />
            berkualitas dimulai
            <br />
            dari sini.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-10">
            Millenials Farm menyediakan kambing, domba, dan sapi pilihan
            langsung dari peternakan kami di Tangerang Selatan.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/catalogue"
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-full px-8 text-base"
              )}
            >
              Lihat Katalog
            </Link>
            <Link
              href="#about"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "rounded-full px-8 text-base"
              )}
            >
              Pelajari Lebih Lanjut
            </Link>
          </div>
        </div>
      </section>

      {/* Divider band */}
      <div className="border-t" />

      {/* Value props — large text blocks, generous whitespace */}
      <section className="py-24 md:py-32 px-4">
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
                num: "01",
                title: "Grading Transparan",
                desc: "Sistem grading jelas (Super, A, B, C, D) berdasarkan berat dan kualitas. Anda tahu persis apa yang Anda dapatkan.",
              },
              {
                num: "02",
                title: "Terpercaya & Resmi",
                desc: "PT. Millenials Farm Abadi — terdaftar resmi sebagai supplier hewan ternak di Tangerang Selatan.",
              },
              {
                num: "03",
                title: "Pengiriman Jabodetabek",
                desc: "Layanan pengiriman langsung ke lokasi Anda. Hewan diantar dalam kondisi sehat dan siap qurban.",
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
      <section id="about" className="bg-foreground text-background py-24 md:py-32 px-4">
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
                name: "Kambing",
                weight: "15 — 50+ kg",
                grades: "Super, A, B, C, D",
                desc: "Pilihan paling populer untuk qurban perorangan. Dirawat sehat dan gemuk.",
              },
              {
                name: "Domba",
                weight: "20 — 50+ kg",
                grades: "Super, A, B, C, D",
                desc: "Domba pilihan dengan bulu tebal dan badan gemuk, siap qurban.",
              },
              {
                name: "Sapi",
                weight: "200 — 400+ kg",
                grades: "—",
                desc: "Untuk qurban berjamaah. Sapi sehat dengan bobot optimal.",
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
      <section className="py-20 md:py-28 px-4 border-b">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center">
          {[
            { value: "200+", label: "Hewan Terjual" },
            { value: "3", label: "Jenis Hewan" },
            { value: "5", label: "Tingkat Grade" },
            { value: "15+", label: "Sales Aktif" },
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
      <section className="py-24 md:py-32 px-4">
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
              buttonVariants({ size: "lg" }),
              "rounded-full px-8 text-base gap-2"
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
