/**
 * GET /api/livestock/available
 *
 * Returns a list of livestock that are available for sale.
 * Filters: not yet sold (isSold=false) and healthy (condition=SEHAT).
 * Used by the "Tambah Entry" form (sales/new page) to populate the
 * animal selection dropdown.
 *
 * Returns: Array of { id, sku, type, grade, weightMin, weightMax, condition }
 */

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const livestock = await prisma.livestock.findMany({
      where: { isSold: false, condition: 'SEHAT', entryItem: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sku: true,
        type: true,
        grade: true,
        tag: true,
        hargaJual: true,
        hargaModal: true,
        weightMin: true,
        weightMax: true,
        condition: true,
        photoUrl: true,
      },
    });

    return NextResponse.json(livestock);
  } catch (err) {
    console.error('[api/livestock/available]', err);
    return NextResponse.json({ error: 'Gagal memuat data hewan' }, { status: 500 });
  }
}
