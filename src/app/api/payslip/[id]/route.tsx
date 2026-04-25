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

    // 1. Ambil data user
    const sales = await prisma.profile.findUnique({
      where: { id },
    });

    if (!sales) {
      return NextResponse.json(
        { error: 'Sales tidak ditemukan' },
        { status: 404 },
      );
    }

    // 2. Ambil data penjualan yang sudah APPROVED
    const entries = await prisma.entry.findMany({
      where: { salesId: id, status: 'APPROVED' },
      include: { livestock: true },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Proses data untuk Summary dan Recap
    //    Group key: weight range for SAPI, grade for KAMBING/DOMBA
    const summaryMap = new Map<
      string,
      { jumlah: number; totalHarga: number; resellerCut: number }
    >();
    const animalCounts: Record<string, number> = {};
    const recapItems: PayslipData['recapItems'] = [];

    for (const e of entries) {
      const animalType = e.livestock.type; // SAPI | KAMBING | DOMBA
      const typeLabel = animalType.charAt(0) + animalType.slice(1).toLowerCase(); // "Sapi" | "Kambing" | "Domba"

      // Weight range for SAPI, grade for KAMBING/DOMBA
      const subKey =
        animalType === 'SAPI'
          ? [e.livestock.weightMin, e.livestock.weightMax]
              .filter((n) => n != null)
              .join('-') || 'Unknown'
          : (e.livestock.grade ?? 'Unknown');

      // Items table: "Sapi 300-350" or "Kambing D"
      const summaryKey = `${typeLabel} ${subKey}`;

      // Hitung per group (Tabel Pertama)
      if (!summaryMap.has(summaryKey)) {
        summaryMap.set(summaryKey, { jumlah: 0, totalHarga: 0, resellerCut: 0 });
      }
      const sum = summaryMap.get(summaryKey)!;
      sum.jumlah += 1;
      sum.totalHarga += e.hargaJual;
      sum.resellerCut += e.resellerCut ?? 0;

      // Hitung per Spesies
      animalCounts[animalType] = (animalCounts[animalType] || 0) + 1;

      // Recap Item — type = just weight range or grade ("300-350" / "D")
      recapItems.push({
        tag: e.livestock.tag || undefined,
        salesName: sales.name,
        hewan: animalType,
        type: subKey,
        hargaJual: e.hargaJual,
        cut: e.resellerCut ?? 0,
        pembeli: e.buyerName,
        alamat: e.buyerAddress || undefined,
      });
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

    // 4. Render ke PDF
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
    return NextResponse.json(
      { error: 'Gagal generate payslip PDF' },
      { status: 500 },
    );
  }
}
