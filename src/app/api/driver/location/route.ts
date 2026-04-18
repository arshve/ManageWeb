import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProfile } from '@/lib/auth';

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (profile.role !== 'DRIVER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!isFinite(lat) || !isFinite(lng)) {
    return NextResponse.json({ error: 'Invalid coords' }, { status: 400 });
  }

  try {
    await prisma.profile.update({
      where: { id: profile.id },
      data: {
        lastLat: lat,
        lastLng: lng,
        lastLocationAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/driver/location]', err);
    return NextResponse.json({ error: 'Gagal memperbarui lokasi' }, { status: 500 });
  }
}
