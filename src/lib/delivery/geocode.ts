import { prisma } from '@/lib/prisma';

function normalizeKey(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Parse lat/lng directly out of a Google Maps URL when possible.
 * Handles common shapes: `@lat,lng`, `!3dlat!4dlng`, `q=lat,lng`, `ll=lat,lng`.
 * Zero API cost — admins often paste these already.
 */
export function parseLatLngFromMapsUrl(
  url: string,
): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /[?&](?:q|ll|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (isFinite(lat) && isFinite(lng)) return { lat, lng };
    }
  }
  return null;
}

const SHORT_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.co'];

function isShortMapsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return SHORT_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

/**
 * Expand a Google Maps short link (maps.app.goo.gl) to its full URL.
 * Tries redirect-follow first (res.url holds the final URL); if that still
 * has no coords, scrapes the HTML response for meta tags / inline data.
 */
export async function expandMapsUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; MillenialsFarm/1.0; +https://millenialsfarm.example)',
        Accept: 'text/html,*/*',
      },
      cache: 'no-store',
    });
    if (res.url && res.url !== url) return res.url;
    const html = await res.text();
    const metaUrl = html.match(
      /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
    );
    if (metaUrl) return metaUrl[1];
    const canonical = html.match(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
    );
    if (canonical) return canonical[1];
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve an address or maps URL to coordinates with cache-first lookup.
 * Order: URL parse → cache → Google Geocoding API (paid, optional).
 * Returns null if all fail; caller decides whether to skip or flag manually.
 */
export async function resolveLocation(
  input: string,
): Promise<{ lat: number; lng: number; source: string } | null> {
  if (!input) return null;

  if (input.includes('http')) {
    let parsed = parseLatLngFromMapsUrl(input);
    let source = 'maps-url';
    if (!parsed && isShortMapsUrl(input)) {
      const expanded = await expandMapsUrl(input);
      if (expanded) {
        parsed = parseLatLngFromMapsUrl(expanded);
        source = 'maps-short';
      }
    }
    if (parsed) {
      const key = normalizeKey(input);
      await prisma.geocodeCache.upsert({
        where: { key },
        create: { key, ...parsed, source },
        update: { hitCount: { increment: 1 } },
      });
      return { ...parsed, source };
    }
  }

  const key = normalizeKey(input);
  const cached = await prisma.geocodeCache.findUnique({ where: { key } });
  if (cached) {
    await prisma.geocodeCache.update({
      where: { key },
      data: { hitCount: { increment: 1 } },
    });
    return { lat: cached.lat, lng: cached.lng, source: cached.source };
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({
    address: input,
    key: apiKey,
    region: 'id',
  });
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
    { cache: 'no-store' },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const loc = data?.results?.[0]?.geometry?.location;
  if (!loc) return null;

  await prisma.geocodeCache.create({
    data: { key, lat: loc.lat, lng: loc.lng, source: 'google' },
  });
  return { lat: loc.lat, lng: loc.lng, source: 'google' };
}
