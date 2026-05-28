import { requireRole } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { getReportData } from '@/lib/report/get-report';
import { ReportDocument } from '@/lib/pdf/report-pdf';

const RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  await requireRole('SUPER_ADMIN');

  const { searchParams } = new URL(request.url);
  const startStr = searchParams.get('start');
  const endStr = searchParams.get('end');

  let start: Date, end: Date;
  if (startStr && endStr && RE.test(startStr) && RE.test(endStr)) {
    start = new Date(startStr + 'T00:00:00Z');
    end = new Date(endStr + 'T00:00:00Z');
  } else {
    const now = new Date();
    start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return NextResponse.json({ error: 'Rentang tanggal tidak valid' }, { status: 400 });
  }

  const data = await getReportData(start, end);
  const pdfBuffer = await renderToBuffer(<ReportDocument data={data} />);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="laporan-${data.range.start}_${data.range.end}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
