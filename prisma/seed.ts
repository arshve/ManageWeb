import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin profile
  const admin = await prisma.profile.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: hashSync("admin", 10),
      name: "Admin MF",
      role: "ADMIN",
      phone: "08123456789",
    },
  });

  // Create sales profile
  const sales = await prisma.profile.upsert({
    where: { username: "sales" },
    update: {},
    create: {
      username: "sales",
      password: hashSync("sales", 10),
      name: "Sales MF",
      role: "SALES",
      phone: "08111111111",
    },
  });

  // Create pricing
  const pricingData = [
    { animalType: "KAMBING" as const, grade: "SUPER" as const, hargaBeli: 4000000, hargaJual: 5000000 },
    { animalType: "KAMBING" as const, grade: "A" as const, hargaBeli: 3500000, hargaJual: 4400000 },
    { animalType: "KAMBING" as const, grade: "B" as const, hargaBeli: 2700000, hargaJual: 3800000 },
    { animalType: "KAMBING" as const, grade: "C" as const, hargaBeli: 2300000, hargaJual: 3300000 },
    { animalType: "KAMBING" as const, grade: "D" as const, hargaBeli: 1700000, hargaJual: 2350000 },
    { animalType: "DOMBA" as const, grade: "A" as const, hargaBeli: 3200000, hargaJual: 4000000 },
    { animalType: "DOMBA" as const, grade: "B" as const, hargaBeli: 2500000, hargaJual: 3400000 },
    { animalType: "DOMBA" as const, grade: "C" as const, hargaBeli: 2000000, hargaJual: 2800000 },
    { animalType: "SAPI" as const, grade: "A" as const, hargaBeli: 22000000, hargaJual: 25000000 },
    { animalType: "SAPI" as const, grade: "B" as const, hargaBeli: 18000000, hargaJual: 21000000 },
    { animalType: "SAPI" as const, grade: "C" as const, hargaBeli: 15000000, hargaJual: 18000000 },
  ];

  for (const p of pricingData) {
    await prisma.pricing.upsert({
      where: { animalType_grade: { animalType: p.animalType, grade: p.grade } },
      update: { hargaBeli: p.hargaBeli, hargaJual: p.hargaJual },
      create: p,
    });
  }

  // Create livestock
  const livestockData = [
    { sku: "MF-001K-Super", type: "KAMBING" as const, grade: "SUPER" as const, weight: 48, hargaJual: 5000000, tag: "BSD-01 / K-01", condition: "SEHAT" as const },
    { sku: "MF-002K-A", type: "KAMBING" as const, grade: "A" as const, weight: 42, hargaJual: 4400000, tag: "BSD-02 / K-02", condition: "SEHAT" as const },
    { sku: "MF-003K-A", type: "KAMBING" as const, grade: "A" as const, weight: 40, hargaJual: 4400000, tag: "BSD-03 / K-03", condition: "SEHAT" as const },
    { sku: "MF-004K-B", type: "KAMBING" as const, grade: "B" as const, weight: 38, hargaJual: 3800000, tag: "BSD-04 / K-04", condition: "SEHAT" as const },
    { sku: "MF-005K-B", type: "KAMBING" as const, grade: "B" as const, weight: 36, hargaJual: 3800000, tag: "BSD-05 / K-05", condition: "SEHAT" as const },
    { sku: "MF-006K-C", type: "KAMBING" as const, grade: "C" as const, weight: 30, hargaJual: 3300000, tag: "BSD-06 / K-06", condition: "SEHAT" as const },
    { sku: "MF-007K-C", type: "KAMBING" as const, grade: "C" as const, weight: 28, hargaJual: 3300000, tag: "BSD-07 / K-07", condition: "SAKIT" as const },
    { sku: "MF-008K-D", type: "KAMBING" as const, grade: "D" as const, weight: 20, hargaJual: 2350000, tag: "BSD-08 / K-08", condition: "SEHAT" as const },
    { sku: "MF-009D-A", type: "DOMBA" as const, grade: "A" as const, weight: 45, hargaJual: 4000000, tag: "BSD-09 / K-09", condition: "SEHAT" as const },
    { sku: "MF-010D-B", type: "DOMBA" as const, grade: "B" as const, weight: 35, hargaJual: 3400000, tag: "BSD-10 / K-10", condition: "SEHAT" as const },
    { sku: "MF-011D-C", type: "DOMBA" as const, grade: "C" as const, weight: 28, hargaJual: 2800000, tag: "BSD-11 / K-11", condition: "SEHAT" as const },
    { sku: "MF-012S-A", type: "SAPI" as const, grade: "A" as const, weight: 350, hargaJual: 25000000, tag: "BSD-12 / K-12", condition: "SEHAT" as const },
    { sku: "MF-013S-B", type: "SAPI" as const, grade: "B" as const, weight: 300, hargaJual: 21000000, tag: "BSD-13 / K-13", condition: "SEHAT" as const },
    { sku: "MF-014S-C", type: "SAPI" as const, grade: "C" as const, weight: 250, hargaJual: 18000000, tag: "BSD-14 / K-14", condition: "SEHAT" as const },
    { sku: "MF-015K-A", type: "KAMBING" as const, grade: "A" as const, weight: 43, hargaJual: 4400000, tag: "BSD-15 / K-15", condition: "SEHAT" as const },
  ];

  for (const l of livestockData) {
    await prisma.livestock.upsert({
      where: { sku: l.sku },
      update: {},
      create: l,
    });
  }

  // Create some entries
  const allLivestock = await prisma.livestock.findMany({ take: 5 });

  const entriesData = [
    { livestock: allLivestock[0], salesId: sales.id, buyerName: "Serjay", buyerPhone: "08333333333", hargaJual: 5000000, resellerCut: 300000, status: "APPROVED" as const, paymentStatus: "LUNAS" as const },
    { livestock: allLivestock[1], salesId: sales.id, buyerName: "Bu Devi", buyerPhone: "08444444444", hargaJual: 4400000, resellerCut: 250000, status: "APPROVED" as const, paymentStatus: "DP" as const, dp: 2000000 },
    { livestock: allLivestock[2], salesId: sales.id, buyerName: "Harmon", buyerPhone: "08555555555", hargaJual: 4400000, resellerCut: 300000, status: "PENDING" as const, paymentStatus: "BELUM_BAYAR" as const },
    { livestock: allLivestock[3], salesId: sales.id, buyerName: "Dimas Augie", buyerPhone: "08666666666", hargaJual: 3800000, resellerCut: 250000, status: "APPROVED" as const, paymentStatus: "LUNAS" as const },
    { livestock: allLivestock[4], salesId: sales.id, buyerName: "Radhitya Wawan", buyerPhone: "08777777777", hargaJual: 3800000, resellerCut: 200000, status: "PENDING" as const, paymentStatus: "DP" as const, dp: 1500000 },
  ];

  let invoiceCounter = 1;
  for (const e of entriesData) {
    const pricing = await prisma.pricing.findUnique({
      where: { animalType_grade: { animalType: e.livestock.type, grade: e.livestock.grade } },
    });
    const hargaModal = pricing?.hargaBeli ?? 0;
    const hpp = hargaModal + (e.resellerCut ?? 0);
    const profit = e.hargaJual - hpp;

    await prisma.entry.upsert({
      where: { invoiceNo: `INV-SEED-${String(invoiceCounter).padStart(3, "0")}` },
      update: {},
      create: {
        invoiceNo: `INV-SEED-${String(invoiceCounter).padStart(3, "0")}`,
        livestockId: e.livestock.id,
        salesId: e.salesId,
        status: e.status,
        hargaJual: e.hargaJual,
        hargaModal,
        resellerCut: e.resellerCut,
        hpp,
        profit,
        dp: e.dp ?? null,
        totalBayar: e.paymentStatus === "LUNAS" ? e.hargaJual : e.dp ?? null,
        paymentStatus: e.paymentStatus,
        buyerName: e.buyerName,
        buyerPhone: e.buyerPhone,
        buyerAddress: "Tangerang Selatan",
        approvedAt: e.status === "APPROVED" ? new Date() : null,
        approvedBy: e.status === "APPROVED" ? admin.id : null,
      },
    });

    if (e.status === "APPROVED") {
      await prisma.livestock.update({
        where: { id: e.livestock.id },
        data: { isSold: true },
      });
    }

    invoiceCounter++;
  }

  console.log("Seed complete!");
  console.log(`- ${await prisma.profile.count()} profiles`);
  console.log(`- ${await prisma.livestock.count()} livestock`);
  console.log(`- ${await prisma.pricing.count()} pricing entries`);
  console.log(`- ${await prisma.entry.count()} sale entries`);
  console.log("");
  console.log("Login accounts:");
  console.log("  admin / admin (ADMIN)");
  console.log("  sales / sales (SALES)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
