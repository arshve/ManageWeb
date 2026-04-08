import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-16">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">
              Millenials Farm
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
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
              Tentang Kami
            </Link>
            <Link
              href="#contact"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Kontak
            </Link>
          </nav>
          <Link href="/login" className={buttonVariants({ size: "sm" })}>
            Masuk
          </Link>
        </div>
      </header>
      {children}
      <footer className="bg-sidebar text-sidebar-foreground">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-bold text-sidebar-primary mb-3">
                Millenials Farm
              </h3>
              <p className="text-sm text-sidebar-foreground/70">
                Supplier hewan ternak terpercaya untuk ibadah qurban Anda.
                Menyediakan kambing, domba, dan sapi berkualitas.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Alamat</h4>
              <p className="text-sm text-sidebar-foreground/70">
                Jalan Mahoni 2 No. 12A
                <br />
                Rt. 001 Rw. 003, Pamulang
                <br />
                Kota Tangerang Selatan, Banten
              </p>
            </div>
            <div id="contact">
              <h4 className="font-semibold mb-3">Hubungi Kami</h4>
              <div className="space-y-2 text-sm text-sidebar-foreground/70">
                <p>Instagram: @millenialsfarm_</p>
                <p>PT. Millenials Farm Abadi</p>
              </div>
            </div>
          </div>
          <div className="border-t border-sidebar-border mt-8 pt-6 text-center text-xs text-sidebar-foreground/50">
            &copy; {new Date().getFullYear()} Millenials Farm. All rights
            reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
