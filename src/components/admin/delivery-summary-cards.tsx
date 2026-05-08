import { StatCard } from '@/components/ui/stat-card';

type StatsProps = {
  scheduledCount: number;
  unscheduledCount: number;
  availableDriverCount: number;
  deliveredCount?: number;
};

export function DeliverySummaryCards({
  scheduledCount,
  unscheduledCount,
  availableDriverCount,
  deliveredCount = 0,
}: StatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <StatCard accent="info"    label="Dijadwalkan"    value={scheduledCount}       sub="pengiriman hari ini" />
      <StatCard accent="success" label="Terkirim"       value={deliveredCount}       sub={`dari ${scheduledCount}`} />
      <StatCard accent="warning" label="Belum dijadwal" value={unscheduledCount}     sub="menunggu penugasan" />
      <StatCard accent="primary" label="Driver aktif"   value={availableDriverCount} sub="tersedia hari ini" />
    </div>
  );
}
