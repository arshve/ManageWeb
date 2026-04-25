import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { PayslipDocument, type PayslipData } from '@/lib/pdf/payslip-pdf';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole('SUPER_ADMIN');

    const { id } = await params;

    const sales = await prisma.profile.findUnique({ where: { id } });
    if (!sales) {
      return NextResponse.json({ error: 'Sales tidak ditemukan' }, { status: 404 });
    }

    const entries = await prisma.entry.findMany({
      where: { salesId: id, status: 'APPROVED' },
      include: { items: { include: { livestock: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const summaryMap = new Map<
      string,
      { jumlah: number; totalHarga: number; resellerCut: number }
    >();
    const animalCounts: Record<string, number> = {};
    const recapItems: PayslipData['recapItems'] = [];

    for (const e of entries) {
      for (const item of e.items) {
        const animalType = item.livestock.type;
        const typeLabel = animalType.charAt(0) + animalType.slice(1).toLowerCase();

        const subKey =
          animalType === 'SAPI'
            ? [item.livestock.weightMin, item.livestock.weightMax]
                .filter((n) => n != null)
                .join('-') || 'Unknown'
            : (item.livestock.grade ?? 'Unknown');

        const summaryKey = `${typeLabel} ${subKey}`;

        if (!summaryMap.has(summaryKey)) {
          summaryMap.set(summaryKey, { jumlah: 0, totalHarga: 0, resellerCut: 0 });
        }
        const sum = summaryMap.get(summaryKey)!;
        sum.jumlah += 1;
        sum.totalHarga += item.hargaJual;
        sum.resellerCut += item.resellerCut ?? 0;

        animalCounts[animalType] = (animalCounts[animalType] || 0) + 1;

        recapItems.push({
          tag: item.livestock.tag || undefined,
          salesName: sales.name,
          hewan: animalType,
          type: subKey,
          hargaJual: item.hargaJual,
          cut: item.resellerCut ?? 0,
          pembeli: e.buyerName,
          alamat: e.buyerAddress || undefined,
        });
      }
    }

    const summaryItems = Array.from(summaryMap.entries()).map(
      ([sku, data]) => ({ sku, ...data }),
    );

    const data: PayslipData = {
      salesName: sales.name,
      date: new Date().toLocaleDateString('en-US'),
      summaryItems,
      animalCounts,
      recapItems,
    };

    const pdfBuffer = await renderToBuffer(<PayslipDocument data={data} />);
    const filename = `Payslip_${sales.name.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[api/payslip/[id]]', err);
    return NextResponse.json({ error: 'Gagal generate payslip PDF' }, { status: 500 });
  }
}
