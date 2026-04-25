import Link from 'next/link';
import Image from 'next/image';
import { DM_Sans, DM_Serif_Display } from 'next/font/google';
import { getProfile, dashboardUrlForRole } from '@/lib/auth';
import { SiteHeader } from '@/components/layout/site-header';

// Load the custom fonts matching the HTML design
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' });
const dmSerif = DM_Serif_Display({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-serif',
});

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  const dashboardHref = profile ? dashboardUrlForRole(profile.role) : '/login';
  const masukLabel = profile ? 'Dashboard' : 'Masuk';

  return (
    <div className={`${dmSans.variable} ${dmSerif.variable} font-sans`}>
      {/* Header is now a Client Component handling its own scroll state */}
      <SiteHeader dashboardHref={dashboardHref} masukLabel={masukLabel} />

      {children}

      {/* Footer remains unchanged */}
      <footer className="bg-foreground text-background">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Image
                  src="/logo.png"
                  alt="Millenials Farm"
                  width={32}
                  height={32}
                  className="brightness-0 invert"
                />
                <h3 className="text-lg font-bold tracking-tight">
                  MILLENIALS FARM
                </h3>
              </div>
              <p className="text-sm opacity-60 leading-relaxed max-w-sm">
                PT. Millenials Farm Abadi — supplier hewan ternak terpercaya
                untuk ibadah qurban Anda. Menyediakan kambing, domba, dan sapi
                berkualitas.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold tracking-wide uppercase opacity-40 mb-4">
                Alamat
              </h4>
              <p className="text-sm opacity-60 leading-relaxed">
                Jalan Mahoni 2 No. 12A
                <br />
                Rt. 001 Rw. 003, Pamulang
                <br />
                Kota Tangerang Selatan
                <br />
                Banten
              </p>
            </div>
            <div id="contact">
              <h4 className="text-sm font-semibold tracking-wide uppercase opacity-40 mb-4">
                Kontak
              </h4>
              <div className="space-y-2 text-sm opacity-60">
                <p>Instagram: @millenialsfarm_</p>
                <p>PT. Millenials Farm Abadi</p>
              </div>
            </div>
          </div>
          <div className="border-t border-background/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs opacity-40">
            <p>
              &copy; {new Date().getFullYear()} Millenials Farm. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
