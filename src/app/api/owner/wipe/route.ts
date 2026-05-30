import { requireRole } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { wipeBusinessData } from '@/lib/data-transfer/import';
import { logAudit } from '@/lib/audit';

export async function POST(request: Request) {
  const actor = await requireRole('OWNER');

  let body: { confirm?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Konfirmasi diperlukan' }, { status: 400 });
  }

  try {
    const result = await wipeBusinessData({ confirm: true });
    const total = Object.values(result.deleted).reduce((a, b) => a + b, 0);
    await logAudit({
      actor,
      action: 'DELETE',
      entity: 'DataImport',
      entityId: 'wipe',
      label: `Wipe data bisnis — ${total} baris dihapus`,
      after: result.deleted,
    });
    return NextResponse.json({ success: true, deleted: result.deleted });
  } catch (err) {
    console.error('[api/owner/wipe]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Wipe gagal' },
      { status: 500 },
    );
  }
}
