import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, DM_Serif_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Millenials Farm - Qurban Terpercaya",
  description:
    "Millenials Farm menyediakan hewan qurban berkualitas. Kambing, Domba, dan Sapi pilihan terbaik untuk ibadah qurban Anda.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MF Farm",
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a2e1d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Pre-establish the TLS connection to Supabase Storage so the first image
  // request doesn't pay the DNS + TLS handshake cost (~100–400 ms saved).
  const supabaseOrigin = (() => {
    const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
    try { return u ? new URL(u).origin : null; } catch { return null; }
  })();

  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} ${dmSerif.variable} h-full antialiased`}
    >
      <head>
        {supabaseOrigin && <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />}
        {supabaseOrigin && <link rel="dns-prefetch" href={supabaseOrigin} />}
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
        <SpeedInsights />
        <Analytics />
        <PwaRegister />
      </body>
    </html>
  );
}
