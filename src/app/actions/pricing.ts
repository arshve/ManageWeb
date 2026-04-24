/**
 * Server Actions: Pricing Management
 *
 * Manages the pricing table that maps animal type + grade to buy/sell prices.
 * Each combination (e.g., KAMBING + A) has one pricing entry.
 * Uses upsert: if a pricing for that type+grade exists, it updates; otherwise creates.
 *
 * These prices are used when creating sale entries — the hargaModal (buy price)
 * is automatically filled from this table.
 */

"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import type { AnimalType, AnimalGrade } from "@/generated/prisma/client";

/**
 * Creates or updates a pricing entry. Admin-only.
 * Uses upsert with the unique constraint [animalType, grade] — if a pricing
 * for that combination already exists, it updates the prices instead of
 * creating a duplicate.
 *
 * @param formData - Form data with animalType, grade, hargaBeli, hargaJual
 * @returns { success }
 */
export async function upsertPricing(formData: FormData) {
  const actor = await requireRole("ADMIN", "SUPER_ADMIN");

  const animalType = formData.get("animalType") as AnimalType;
  const grade = formData.get("grade") as AnimalGrade;
  const hargaBeli = Number(formData.get("hargaBeli"));
  const hargaJual = Number(formData.get("hargaJual"));

  const before = await prisma.pricing.findUnique({
    where: { animalType_grade: { animalType, grade } },
  });

  const upserted = await prisma.pricing.upsert({
    where: { animalType_grade: { animalType, grade } },
    create: { animalType, grade, hargaBeli, hargaJual },
    update: { hargaBeli, hargaJual },
  });

  await logAudit({
    actor,
    action: before ? "UPDATE" : "CREATE",
    entity: "Pricing",
    entityId: upserted.id,
    label: `${animalType} ${grade}`,
    before: before ?? undefined,
    after: upserted,
  });

  revalidatePath("/admin/pricing");
  return { success: true };
}

/**
 * Deletes a pricing entry by ID. Admin-only.
 *
 * @param id - The pricing record ID to delete
 * @returns { success }
 */
export async function deletePricing(id: string) {
  const actor = await requireRole("ADMIN", "SUPER_ADMIN");

  const before = await prisma.pricing.findUnique({ where: { id } });
  if (!before) return { error: "Harga tidak ditemukan" };

  await prisma.pricing.delete({ where: { id } });

  await logAudit({
    actor,
    action: "DELETE",
    entity: "Pricing",
    entityId: id,
    label: `${before.animalType} ${before.grade}`,
    before,
  });

  revalidatePath("/admin/pricing");
  return { success: true };
}
