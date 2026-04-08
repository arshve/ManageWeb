/**
 * Server Actions: Livestock Management
 *
 * CRUD operations for managing livestock (hewan qurban) data.
 * All operations are admin-only since only admins can add/edit/delete animals.
 *
 * Each livestock has: SKU, type (KAMBING/DOMBA/SAPI), grade (SUPER/A/B/C/D),
 * condition (SEHAT/SAKIT/MATI), weight, tag identifiers, photo, and notes.
 */

"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { AnimalType, AnimalGrade, AnimalCondition } from "@/generated/prisma/client";

/**
 * Creates a new livestock record. Admin-only.
 * Extracts all fields from form data and inserts into the database.
 * After creation, revalidates the livestock page to show the new animal.
 *
 * @param formData - Form data with sku, type, grade, condition, weight, tags, etc.
 * @returns { success }
 */
export async function createLivestock(formData: FormData) {
  await requireRole("ADMIN");

  const data = {
    sku: formData.get("sku") as string,
    type: formData.get("type") as AnimalType,
    grade: formData.get("grade") as AnimalGrade,
    condition: (formData.get("condition") as AnimalCondition) || "SEHAT",
    weight: formData.get("weight") ? Number(formData.get("weight")) : null,
    tagBsd: (formData.get("tagBsd") as string) || null,
    tagKandang: (formData.get("tagKandang") as string) || null,
    tagMf: (formData.get("tagMf") as string) || null,
    photoUrl: (formData.get("photoUrl") as string) || null,
    notes: (formData.get("notes") as string) || null,
  };

  await prisma.livestock.create({ data });
  revalidatePath("/admin/livestock");
  return { success: true };
}

/**
 * Updates an existing livestock record. Admin-only.
 * All fields can be changed — the form pre-fills current values.
 *
 * @param id - The livestock ID to update
 * @param formData - Updated form data
 * @returns { success }
 */
export async function updateLivestock(id: string, formData: FormData) {
  await requireRole("ADMIN");

  const data = {
    sku: formData.get("sku") as string,
    type: formData.get("type") as AnimalType,
    grade: formData.get("grade") as AnimalGrade,
    condition: formData.get("condition") as AnimalCondition,
    weight: formData.get("weight") ? Number(formData.get("weight")) : null,
    tagBsd: (formData.get("tagBsd") as string) || null,
    tagKandang: (formData.get("tagKandang") as string) || null,
    tagMf: (formData.get("tagMf") as string) || null,
    photoUrl: (formData.get("photoUrl") as string) || null,
    notes: (formData.get("notes") as string) || null,
  };

  await prisma.livestock.update({ where: { id }, data });
  revalidatePath("/admin/livestock");
  return { success: true };
}

/**
 * Deletes a livestock record. Admin-only.
 * Note: This will fail if the animal has a linked sale entry
 * (due to foreign key constraint). Delete the entry first.
 *
 * @param id - The livestock ID to delete
 * @returns { success }
 */
export async function deleteLivestock(id: string) {
  await requireRole("ADMIN");
  await prisma.livestock.delete({ where: { id } });
  revalidatePath("/admin/livestock");
  return { success: true };
}
