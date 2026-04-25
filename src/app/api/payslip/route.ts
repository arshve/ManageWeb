import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireRole("ADMIN", "SUPER_ADMIN");

    const salesPersons = await prisma.profile.findMany({
      where: { role: "SALES", isActive: true },
      include: {
        entries: {
          where: { status: "APPROVED" },
          include: { items: { include: { livestock: true } } },
        },
      },
    });

    const payslips = salesPersons.map((sales) => {
      const allItems = sales.entries.flatMap((e) => e.items);
      const totalEntries = allItems.length;
      const totalResellerCut = allItems.reduce((sum, i) => sum + (i.resellerCut ?? 0), 0);
      const totalSalesAmount = allItems.reduce((sum, i) => sum + i.hargaJual, 0);
      const entries = sales.entries.flatMap((e) =>
        e.items.map((i) => ({
          invoiceNo: e.invoiceNo,
          animalType: i.livestock.type,
          animalGrade: i.livestock.grade,
          buyerName: e.buyerName,
          hargaJual: i.hargaJual,
          resellerCut: i.resellerCut ?? 0,
          date: e.createdAt,
        })),
      );

      return {
        salesId: sales.id,
        salesName: sales.name,
        salesUsername: sales.username,
        salesPhone: sales.phone,
        totalEntries,
        totalResellerCut,
        totalSales: totalSalesAmount,
        entries,
      };
    });

    return NextResponse.json(payslips);
  } catch (err) {
    console.error('[api/payslip]', err);
    return NextResponse.json({ error: 'Gagal memuat data payslip' }, { status: 500 });
  }
}
