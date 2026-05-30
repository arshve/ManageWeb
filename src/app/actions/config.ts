/**
 * Server Actions: white-label app configuration (OWNER-only).
 *
 * Writes the singleton AppConfig row. On a brand-color change we regenerate the
 * 11-stop OKLCH scale + cover ink so the runtime theme injection (root layout)
 * picks it up. Cache is busted via `revalidateTag(APP_CONFIG_TAG)` and the
 * root layout is revalidated so chrome/metadata refresh immediately.
 */

'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';
import { hexToBrandScale } from '@/lib/theme/palette';

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

function str(fd: FormData, key: string): string | null {
  const v = (fd.get(key) as string | null)?.trim();
  return v ? v : null;
}

export async function updateAppConfig(formData: FormData) {
  const actor = await requireAuth();
  if (actor.role !== 'OWNER') {
    return { error: 'Hanya Owner yang bisa mengubah konfigurasi.' };
  }

  try {
    const brandHexRaw = str(formData, 'brandHex');
    let brandHex: string | null = null;
    let brandScale = null as ReturnType<typeof hexToBrandScale> | null;
    if (brandHexRaw) {
      if (!HEX_RE.test(brandHexRaw)) {
        return { error: 'Warna brand harus berupa hex 6 digit (mis. #0C4C3C).' };
      }
      brandHex = brandHexRaw.startsWith('#') ? brandHexRaw : `#${brandHexRaw}`;
      brandScale = hexToBrandScale(brandHex);
    }

    // Cover color is stored as a HEX (or null = auto-derive from brand at
    // render time). We never store the derived OKLCH here, so the value can
    // always round-trip back into the hex picker without failing validation.
    let coverColor: string | null = null;
    const coverRaw = str(formData, 'coverColor');
    if (coverRaw) {
      if (!HEX_RE.test(coverRaw)) {
        return { error: 'Warna latar laporan harus berupa hex 6 digit.' };
      }
      coverColor = coverRaw.startsWith('#') ? coverRaw : `#${coverRaw}`;
    }

    // Carousel slides arrive as a JSON string ([] = clear → use defaults).
    // Each slide: { desktop, tab?, mobile?, alt? } — desktop is required.
    type SlideIn = { desktop?: unknown; tab?: unknown; mobile?: unknown; alt?: unknown };
    let carouselSlides: { desktop: string; tab?: string; mobile?: string; alt?: string }[] | null = null;
    const slidesRaw = formData.get('carouselSlides');
    if (typeof slidesRaw === 'string' && slidesRaw.trim()) {
      try {
        const parsed = JSON.parse(slidesRaw);
        if (!Array.isArray(parsed)) throw new Error('bukan array');
        const s = (v: unknown) => (typeof v === 'string' && v.trim() ? String(v) : undefined);
        const clean: { desktop: string; tab?: string; mobile?: string; alt?: string }[] = [];
        for (const sl of parsed as SlideIn[]) {
          const desktop = s(sl.desktop);
          if (!desktop) continue;
          clean.push({ desktop, tab: s(sl.tab), mobile: s(sl.mobile), alt: s(sl.alt) });
        }
        carouselSlides = clean.length ? clean : null;
      } catch {
        return { error: 'Data carousel tidak valid.' };
      }
    }

    const data = {
      brandName: str(formData, 'brandName'),
      companyName: str(formData, 'companyName'),
      tagline: str(formData, 'tagline'),
      address: str(formData, 'address'),
      city: str(formData, 'city'),
      bankName: str(formData, 'bankName'),
      bankAccountName: str(formData, 'bankAccountName'),
      bankAccountNo: str(formData, 'bankAccountNo'),
      signer: str(formData, 'signer'),
      instagram: str(formData, 'instagram'),
      appTitle: str(formData, 'appTitle'),
      appDescription: str(formData, 'appDescription'),
      logoUrl: str(formData, 'logoUrl'),
      logoLightUrl: str(formData, 'logoLightUrl'),
      signatureUrl: str(formData, 'signatureUrl'),
      brandHex,
      brandScale: brandScale ?? undefined,
      coverColor,
      // [] when cleared — get-config normalizes empty back to the defaults.
      carouselSlides: carouselSlides ?? [],
    };

    await prisma.appConfig.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });

    await logAudit({
      actor,
      action: 'UPDATE',
      entity: 'AppConfig',
      entityId: 'singleton',
      label: data.companyName ?? 'Branding',
    });

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    console.error('[updateAppConfig]', err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
