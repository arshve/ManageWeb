import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const pricing = await prisma.pricing.findMany({
      select: { animalType: true, grade: true, hargaJual: true },
    });
    return NextResponse.json(pricing);
  } catch {
    return NextResponse.json({ error: 'Gagal memuat data harga' }, { status: 500 });
  }
}
