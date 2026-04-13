/**
 * Server Actions: Livestock Management
 *
 * CRUD operations for managing livestock (hewan qurban) data.
 * All operations are admin-only since only admins can add/edit/delete animals.
 *
 * Each livestock has: SKU, type (KAMBING/DOMBA/SAPI), grade (SUPER/A/B/C/D),
 * condition (SEHAT/SAKIT/MATI), weight, tag identifiers, photo, and notes.
 */

'use server';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { logAudit } from '@/lib/audit';
import type {
  AnimalType,
  AnimalGrade,
  AnimalCondition,
} from '@/generated/prisma/client';

/**
 * Creates a new livestock record. Admin/Manage-only.
 * Extracts all fields from form data and inserts into the database.
 * After creation, revalidates the livestock page to show the new animal.
 *
 * @param formData - Form data with sku, type, grade, condition, weight, tags, etc.
 * @returns { success }
 */
export async function createLivestock(formData: FormData) {
  const actor = await requireRole('ADMIN', 'MANAGE');

  const type = formData.get('type') as AnimalType;
  const gradeRaw = formData.get('grade') as string | null;

  const data = {
    sku: formData.get('sku') as string,
    type,
    // Sapi doesn't have a grade; other types require it.
    grade: type === 'SAPI' ? null : ((gradeRaw || null) as AnimalGrade | null),
    condition: (formData.get('condition') as AnimalCondition) || 'SEHAT',
    weightMin: formData.get('weightMin')
      ? Number(formData.get('weightMin'))
      : null,
    weightMax: formData.get('weightMax')
      ? Number(formData.get('weightMax'))
      : null,
    hargaJual: formData.get('hargaJual')
      ? Number(formData.get('hargaJual'))
      : null,
    tag: (formData.get('tag') as string) || null,
    photoUrl: (formData.get('photoUrl') as string) || null,
    notes: (formData.get('notes') as string) || null,
  };

  const created = await prisma.livestock.create({ data });

  await logAudit({
    actor,
    action: 'CREATE',
    entity: 'Livestock',
    entityId: created.id,
    label: `${created.sku} — ${created.type}${created.grade ? ' ' + created.grade : ''}`,
    after: created,
  });

  revalidatePath('/admin/livestock');
  revalidatePath('/manage');
  return { success: true };
}

/**
 * Updates an existing livestock record. Admin/Manage-only.
 * All fields can be changed — the form pre-fills current values.
 *
 * @param id - The livestock ID to update
 * @param formData - Updated form data
 * @returns { success }
 */
export async function updateLivestock(id: string, formData: FormData) {
  const actor = await requireRole('ADMIN', 'MANAGE');

  const before = await prisma.livestock.findUnique({ where: { id } });
  if (!before) return { error: 'Hewan tidak ditemukan' };

  const type = formData.get('type') as AnimalType;
  const gradeRaw = formData.get('grade') as string | null;

  const data = {
    sku: formData.get('sku') as string,
    type,
    grade: type === 'SAPI' ? null : ((gradeRaw || null) as AnimalGrade | null),
    condition: formData.get('condition') as AnimalCondition,
    weightMin: formData.get('weightMin')
      ? Number(formData.get('weightMin'))
      : null,
    weightMax: formData.get('weightMax')
      ? Number(formData.get('weightMax'))
      : null,
    hargaJual: formData.get('hargaJual')
      ? Number(formData.get('hargaJual'))
      : null,
    tag: (formData.get('tag') as string) || null,
    photoUrl: (formData.get('photoUrl') as string) || null,
    notes: (formData.get('notes') as string) || null,
  };

  const updated = await prisma.livestock.update({ where: { id }, data });

  await logAudit({
    actor,
    action: 'UPDATE',
    entity: 'Livestock',
    entityId: id,
    label: `${updated.sku} — ${updated.type}${updated.grade ? ' ' + updated.grade : ''}`,
    before,
    after: updated,
  });

  revalidatePath('/admin/livestock');
  revalidatePath('/manage');
  return { success: true };
}

/**
 * Deletes a livestock record. Admin/Manage-only.
 * Note: This will fail if the animal has a linked sale entry
 * (due to foreign key constraint). Delete the entry first.
 *
 * @param id - The livestock ID to delete
 * @returns { success }
 */
export async function deleteLivestock(id: string) {
  const actor = await requireRole('ADMIN', 'MANAGE');

  const before = await prisma.livestock.findUnique({ where: { id } });
  if (!before) return { error: 'Hewan tidak ditemukan' };

  await prisma.livestock.delete({ where: { id } });

  await logAudit({
    actor,
    action: 'DELETE',
    entity: 'Livestock',
    entityId: id,
    label: `${before.sku} — ${before.type}${before.grade ? ' ' + before.grade : ''}`,
    before,
  });

  revalidatePath('/admin/livestock');
  revalidatePath('/manage');
  return { success: true };
}
