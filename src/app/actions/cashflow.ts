'use server';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

type CashflowData = {
  type: 'PENGELUARAN' | 'PEMASUKAN';
  name: string;
  amount: number;
  category: string | null;
  sourceBank: string | null;
  description: string | null;
  tag: string | null;
  createdAt?: Date;
};

// Shared validation/parsing for create + update.
function parseCashflowForm(formData: FormData): { error: string } | { data: CashflowData } {
  const type = formData.get('type') as 'PENGELUARAN' | 'PEMASUKAN';
  const name = (formData.get('name') as string)?.trim();
  const amount = Number(formData.get('amount'));
  const category = (formData.get('category') as string)?.trim() || null;
  const sourceBank = (formData.get('sourceBank') as string)?.trim() || null;
  const description = (formData.get('description') as string)?.trim() || null;
  const tag = (formData.get('tag') as string)?.trim() || null;

  if (type !== 'PENGELUARAN' && type !== 'PEMASUKAN') return { error: 'Tipe tidak valid' };
  if (!name || !amount || amount <= 0) return { error: 'Nama dan jumlah harus diisi' };

  // Optional transaction date (yyyy-mm-dd) → createdAt, the field the finance
  // list + report already treat as the transaction date. Noon UTC keeps the
  // calendar day stable when formatted.
  const dateStr = (formData.get('date') as string)?.trim();
  let createdAt: Date | undefined;
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = new Date(`${dateStr}T12:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) createdAt = d;
  }

  return { data: { type, name, amount, category, sourceBank, description, tag, ...(createdAt ? { createdAt } : {}) } };
}

export async function createCashflow(formData: FormData) {
  await requireRole('SUPER_ADMIN');

  const parsed = parseCashflowForm(formData);
  if ('error' in parsed) return parsed;

  const created = await prisma.cashflow.create({ data: parsed.data });

  revalidatePath('/admin/finance');
  return { success: true, item: created };
}

export async function updateCashflow(id: string, formData: FormData) {
  await requireRole('SUPER_ADMIN');

  const parsed = parseCashflowForm(formData);
  if ('error' in parsed) return parsed;

  // createdAt only present when a valid date was submitted; otherwise untouched.
  const updated = await prisma.cashflow.update({ where: { id }, data: parsed.data });

  revalidatePath('/admin/finance');
  return { success: true, item: updated };
}

export async function deleteCashflow(id: string) {
  await requireRole('SUPER_ADMIN');
  await prisma.cashflow.delete({ where: { id } });
  revalidatePath('/admin/finance');
  return { success: true };
}
