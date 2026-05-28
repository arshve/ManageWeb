import { requireRole } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { ReportView } from '@/components/admin/report-view';
import { getReportData } from '@/lib/report/get-report';

type SearchParams = { start?: string; end?: string };

function parseRange(params: SearchParams): { start: Date; end: Date } {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (params.start && params.end && re.test(params.start) && re.test(params.end)) {
    const start = new Date(params.start + 'T00:00:00Z');
    const end = new Date(params.end + 'T00:00:00Z');
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start <= end) {
      return { start, end };
    }
  }
  // default: current year (event is annual)
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
  return { start, end };
}

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireRole('SUPER_ADMIN');
  const params = await searchParams;
  const { start, end } = parseRange(params);
  const data = await getReportData(start, end);

  return (
    <DashboardShell title="Laporan Tahunan" description="Rekap penjualan, pengiriman, fee reseller & stok">
      <ReportView data={data} />
    </DashboardShell>
  );
}
