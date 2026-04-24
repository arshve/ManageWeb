/**
 * GET /api/payslip
 *
 * Generates payslip data for all active sales persons. Admin-only endpoint.
 * For each sales person, it calculates:
 * - Total number of approved entries (sales made)
 * - Total reseller cut (commission earned)
 * - Total sales amount
 * - Breakdown of each individual sale
 *
 * This data can be used to generate PDF payslips or display in a report.
 * Returns an array of payslip objects, one per sales person.
 */

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
  // Only admins can view payslip data
  await requireRole("ADMIN", "SUPER_ADMIN");

  // Fetch all active sales persons with their approved entries
  const salesPersons = await prisma.profile.findMany({
    where: { role: "SALES", isActive: true },
    include: {
      entries: {
        where: { status: "APPROVED" },
        include: { livestock: true },
      },
    },
  });

  // Transform into payslip format with calculated totals
  const payslips = salesPersons.map((sales) => {
    const totalEntries = sales.entries.length;
    const totalResellerCut = sales.entries.reduce(
      (sum, e) => sum + (e.resellerCut ?? 0),
      0
    );
    const totalSales = sales.entries.reduce(
      (sum, e) => sum + e.hargaJual,
      0
    );
    const entries = sales.entries.map((e) => ({
      invoiceNo: e.invoiceNo,
      animalType: e.livestock.type,
      animalGrade: e.livestock.grade,
      buyerName: e.buyerName,
      hargaJual: e.hargaJual,
      resellerCut: e.resellerCut ?? 0,
      date: e.createdAt,
    }));

    return {
      salesId: sales.id,
      salesName: sales.name,
      salesUsername: sales.username,
      salesPhone: sales.phone,
      totalEntries,
      totalResellerCut,
      totalSales,
      entries,
    };
  });

  return NextResponse.json(payslips);
  } catch (err) {
    console.error('[api/payslip]', err);
    return NextResponse.json({ error: 'Gagal memuat data payslip' }, { status: 500 });
  }
}
