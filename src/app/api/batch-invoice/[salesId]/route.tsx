import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { BatchInvoiceDocument, type BatchInvoiceEntry } from '@/lib/pdf/batch-invoice-pdf';
import { getCompanyInfo } from '@/lib/config/get-config';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ salesId: string }> },
) {
  try {
    await requireRole('SUPER_ADMIN');
    const { salesId } = await params;

    const sales = await prisma.profile.findUnique({ where: { id: salesId }, select: { id: true, name: true } });
    if (!sales) {
      return NextResponse.json({ error: 'Sales tidak ditemukan' }, { status: 404 });
    }

    // Outstanding = anyone with piutang: BELUM_BAYAR (0 paid) or DP (partial).
    const entries = await prisma.entry.findMany({
      where: {
        salesId,
        status: 'APPROVED',
        paymentStatus: { in: ['BELUM_BAYAR', 'DP'] },
      },
      include: { items: { include: { livestock: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (entries.length === 0) {
      return NextResponse.json({ error: 'Tidak ada tagihan terbuka untuk sales ini' }, { status: 404 });
    }

    const batch: BatchInvoiceEntry[] = entries.map((e) => {
      const totalHargaJual = e.items.reduce((s, i) => s + i.hargaJual, 0);
      const dp = e.dp ?? 0;
      return {
        invoiceNo: e.invoiceNo,
        createdAt: e.createdAt,
        buyerName: e.buyerName,
        items: e.items.map((i) => ({
          type: i.livestock.type,
          grade: i.livestock.grade,
          weightMin: i.livestock.weightMin,
          weightMax: i.livestock.weightMax,
          hargaJual: i.hargaJual,
          tag: i.livestock.tag,
        })),
        dp: e.dp,
        pengiriman: e.pengiriman,
        deliveryDate: e.deliveryDate,
        paymentStatus: e.paymentStatus as 'BELUM_BAYAR' | 'DP',
        totalHargaJual,
        outstanding: Math.max(0, totalHargaJual - dp),
      };
    });

    const company = await getCompanyInfo();
    const pdfBuffer = await renderToBuffer(<BatchInvoiceDocument salesName={sales.name} entries={batch} company={company} />);
    const filename = `BatchInvoice_${sales.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[api/batch-invoice/[salesId]]', err);
    return NextResponse.json({ error: 'Gagal generate batch invoice PDF' }, { status: 500 });
  }
}
