import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, DM_Serif_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { PwaRegister } from "@/components/pwa-register";
import { getAppConfig, brandThemeCss } from "@/lib/config/get-config";
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

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getAppConfig();
  return {
    title: cfg.appTitle,
    description: cfg.appDescription,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: cfg.brandName,
    },
    icons: {
      icon: "/icon.png",
      apple: "/apple-touch-icon.png",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1a2e1d",
};

export default async function RootLayout({
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

  // White-label theme: inject the configured brand scale to override the
  // build-time --brand-* mapping in globals.css (retheme light + dark).
  const cfg = await getAppConfig();
  const themeCss = brandThemeCss(cfg);

  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} ${dmSerif.variable} h-full antialiased`}
    >
      <head>
        {supabaseOrigin && <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />}
        {supabaseOrigin && <link rel="dns-prefetch" href={supabaseOrigin} />}
        {themeCss && <style id="brand-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />}
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
