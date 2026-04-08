import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Beef, ShieldCheck, Truck, Star } from "lucide-react";

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-secondary/30 py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Qurban Berkualitas
            <br />
            <span className="text-primary">Millenials Farm</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Menyediakan hewan qurban pilihan terbaik — kambing, domba, dan sapi
            berkualitas langsung dari peternakan kami di Tangerang Selatan.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/catalogue" className={buttonVariants({ size: "lg" })}>
              Lihat Katalog
            </Link>
            <Link
              href="#contact"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Hubungi Kami
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Kenapa Millenials Farm?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Beef,
                title: "Hewan Berkualitas",
                desc: "Semua hewan dirawat dengan baik, sehat, dan sudah memenuhi syarat qurban.",
              },
              {
                icon: ShieldCheck,
                title: "Terpercaya",
                desc: "PT. Millenials Farm Abadi — terdaftar resmi sebagai supplier hewan ternak.",
              },
              {
                icon: Star,
                title: "Grading Jelas",
                desc: "Sistem grading transparan (Super, A, B, C, D) sesuai berat dan kualitas.",
              },
              {
                icon: Truck,
                title: "Pengiriman",
                desc: "Layanan pengiriman ke lokasi Anda di area Jabodetabek dan sekitarnya.",
              },
            ].map((feature) => (
              <Card key={feature.title} className="text-center">
                <CardContent className="pt-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Animal Types */}
      <section id="about" className="py-16 md:py-24 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">
            Jenis Hewan Qurban
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Kami menyediakan berbagai jenis hewan qurban dengan kualitas terbaik
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Kambing",
                desc: "Kambing pilihan dengan berbagai grade. Berat 15-50+ kg.",
                grades: "Super, A, B, C, D",
              },
              {
                name: "Domba",
                desc: "Domba sehat dan gemuk, cocok untuk qurban perorangan.",
                grades: "Super, A, B, C, D",
              },
              {
                name: "Sapi",
                desc: "Sapi qurban berkualitas untuk qurban berjamaah.",
                grades: "Super, A, B, C, D",
              },
            ].map((animal) => (
              <Card key={animal.name} className="overflow-hidden">
                <div className="h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Beef className="h-20 w-20 text-primary/30" />
                </div>
                <CardContent className="pt-4">
                  <h3 className="text-xl font-bold mb-2">{animal.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    {animal.desc}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Grade: {animal.grades}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Pesan Hewan Qurban Sekarang
          </h2>
          <p className="text-lg opacity-90 mb-8">
            Lihat katalog hewan kami dan pilih yang terbaik untuk ibadah qurban
            Anda.
          </p>
          <Link
            href="/catalogue"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Buka Katalog
          </Link>
        </div>
      </section>
    </main>
  );
}
