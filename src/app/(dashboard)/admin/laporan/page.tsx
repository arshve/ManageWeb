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
  // default: current month
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
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
    <DashboardShell title="Laporan" description="Ringkasan penjualan, pengiriman & stok">
      <ReportView data={data} />
    </DashboardShell>
  );
}
