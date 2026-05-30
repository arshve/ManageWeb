import { requireRole } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { exportAll } from '@/lib/data-transfer/export';

export async function GET() {
  await requireRole('OWNER');
  const payload = await exportAll();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="data-export-${stamp}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
