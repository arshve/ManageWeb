import { requireRole } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { importAll, importGuardError } from '@/lib/data-transfer/import';
import { EXPORT_VERSION, type ExportPayload } from '@/lib/data-transfer/export';
import { logAudit } from '@/lib/audit';

export async function POST(request: Request) {
  const actor = await requireRole('OWNER');

  const guard = importGuardError();
  if (guard) return NextResponse.json({ error: guard }, { status: 403 });

  let body: { confirm?: boolean; payload?: ExportPayload };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid' }, { status: 400 });
  }

  if (body.confirm !== true) {
    return NextResponse.json({ error: 'Konfirmasi diperlukan' }, { status: 400 });
  }
  const payload = body.payload;
  if (!payload?.tables) {
    return NextResponse.json({ error: 'File ekspor tidak valid' }, { status: 400 });
  }
  if (typeof payload.version === 'number' && payload.version !== EXPORT_VERSION) {
    return NextResponse.json(
      { error: `Versi ekspor (${payload.version}) tidak cocok dengan versi aplikasi (${EXPORT_VERSION}).` },
      { status: 400 },
    );
  }

  try {
    const result = await importAll(payload, { confirm: true });
    await logAudit({
      actor,
      action: 'UPDATE',
      entity: 'DataImport',
      entityId: 'restore',
      label: `Restore ${Object.values(result.inserted).reduce((a, b) => a + b, 0)} baris`,
      after: result.inserted,
    });
    return NextResponse.json({ success: true, inserted: result.inserted });
  } catch (err) {
    console.error('[api/owner/import]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import gagal' },
      { status: 500 },
    );
  }
}
