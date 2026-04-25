import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { InvoiceDocument } from '@/lib/pdf/invoice-pdf';
import { KwitansiDocument } from '@/lib/pdf/kwitansi-pdf';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireAuth();
  const { id } = await params;

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const variant = url.searchParams.get('variant');

  if (type !== 'invoice' && type !== 'kwitansi') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }
  if (type === 'kwitansi' && variant !== 'dp' && variant !== 'full') {
    return NextResponse.json({ error: 'Invalid variant' }, { status: 400 });
  }

  const entry = await prisma.entry.findUnique({
    where: { id },
    include: { items: { include: { livestock: true } } },
  });
  if (!entry) {
    return NextResponse.json({ error: 'Entry tidak ditemukan' }, { status: 404 });
  }

  if (profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN' && entry.salesId !== profile.id) {
    return NextResponse.json({ error: 'Tidak berhak' }, { status: 403 });
  }

  if (entry.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Entry belum disetujui' }, { status: 400 });
  }
  if (entry.buktiTransfer.length === 0) {
    return NextResponse.json({ error: 'Belum ada bukti transfer' }, { status: 400 });
  }

  const totalHargaJual = entry.items.reduce((s, i) => s + i.hargaJual, 0);

  const pdfBuffer =
    type === 'invoice'
      ? await renderToBuffer(
          <InvoiceDocument
            data={{
              invoiceNo: entry.invoiceNo,
              createdAt: entry.createdAt,
              buyerName: entry.buyerName,
              items: entry.items.map((i) => ({
                type: i.livestock.type,
                grade: i.livestock.grade,
                weightMin: i.livestock.weightMin,
                weightMax: i.livestock.weightMax,
                hargaJual: i.hargaJual,
                tag: i.livestock.tag,
              })),
              dp: entry.dp,
              pengiriman: entry.pengiriman,
              deliveryDate: entry.deliveryDate,
            }}
          />,
        )
      : await renderToBuffer(
          <KwitansiDocument
            data={{
              invoiceNo: entry.invoiceNo,
              createdAt: entry.createdAt,
              buyerName: entry.buyerName,
              hargaJual: totalHargaJual,
              dp: entry.dp,
              totalBayar: entry.totalBayar,
              variant: variant as 'dp' | 'full',
            }}
          />,
        );

  const filename =
    type === 'invoice'
      ? `invoice-${entry.invoiceNo}.pdf`
      : `kwitansi-${variant}-${entry.invoiceNo}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
