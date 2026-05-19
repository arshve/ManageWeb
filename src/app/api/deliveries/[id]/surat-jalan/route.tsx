import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { SuratJalanDocument } from '@/lib/pdf/surat-jalan-pdf';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await requireAuth();
  const { id } = await params;

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      driver: { select: { name: true, vehiclePlate: true } },
      entry: {
        include: {
          items: {
            include: {
              livestock: {
                select: {
                  type: true,
                  grade: true,
                  tag: true,
                  sku: true,
                  weightMin: true,
                  weightMax: true,
                  condition: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!delivery) {
    return NextResponse.json({ error: 'Pengiriman tidak ditemukan' }, { status: 404 });
  }

  const allowed =
    profile.role === 'ADMIN' ||
    profile.role === 'SUPER_ADMIN' ||
    (profile.role === 'DRIVER' && delivery.driverId === profile.id);

  if (!allowed) {
    return NextResponse.json({ error: 'Tidak berhak' }, { status: 403 });
  }

  const entry = delivery.entry;

  const pdfBuffer = await renderToBuffer(
    <SuratJalanDocument
      data={{
        noSuratJalan: `SJ/${entry.invoiceNo}`,
        tanggal: entry.deliveryDate ?? new Date(),
        driverName: delivery.driver?.name ?? null,
        vehiclePlate: delivery.driver?.vehiclePlate ?? null,
        buyerName: entry.buyerName,
        buyerPhone: entry.buyerPhone,
        buyerAddress: entry.buyerAddress,
        items: entry.items.map((i) => ({
          type: i.livestock.type,
          grade: i.livestock.grade,
          tag: i.livestock.tag,
          sku: i.livestock.sku,
          weightMin: i.livestock.weightMin,
          weightMax: i.livestock.weightMax,
          condition: i.livestock.condition,
        })),
        notes: entry.notes,
      }}
    />,
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="surat-jalan-${entry.invoiceNo}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
