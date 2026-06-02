'use server';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function createCashflow(formData: FormData) {
  await requireRole('SUPER_ADMIN');

  const type = formData.get('type') as 'PENGELUARAN' | 'PEMASUKAN';
  const name = (formData.get('name') as string)?.trim();
  const amount = Number(formData.get('amount'));
  const category = (formData.get('category') as string)?.trim() || null;
  const sourceBank = (formData.get('sourceBank') as string)?.trim() || null;
  const description = (formData.get('description') as string)?.trim() || null;
  const tag = (formData.get('tag') as string)?.trim() || null;

  if (!name || !amount || amount <= 0) {
    return { error: 'Nama dan jumlah harus diisi' };
  }

  const created = await prisma.cashflow.create({
    data: { type, name, amount, category, sourceBank, description, tag },
  });

  revalidatePath('/admin/finance');
  return { success: true, item: created };
}

export async function deleteCashflow(id: string) {
  await requireRole('SUPER_ADMIN');
  await prisma.cashflow.delete({ where: { id } });
  revalidatePath('/admin/finance');
  return { success: true };
}
