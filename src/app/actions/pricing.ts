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
  await requireRole("ADMIN");

  const animalType = formData.get("animalType") as AnimalType;
  const grade = formData.get("grade") as AnimalGrade;
  const hargaBeli = Number(formData.get("hargaBeli"));
  const hargaJual = Number(formData.get("hargaJual"));

  await prisma.pricing.upsert({
    where: { animalType_grade: { animalType, grade } },
    create: { animalType, grade, hargaBeli, hargaJual },
    update: { hargaBeli, hargaJual },
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
  await requireRole("ADMIN");

  await prisma.pricing.delete({ where: { id } });
  revalidatePath("/admin/pricing");
  return { success: true };
}
