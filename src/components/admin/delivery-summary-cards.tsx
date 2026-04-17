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
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-xs text-muted-foreground mb-1">Dijadwalkan</p>
        <p className="text-2xl font-medium">{scheduledCount}</p>
        <p className="text-xs text-muted-foreground mt-1">
          pengiriman hari ini
        </p>
      </div>
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-xs text-muted-foreground mb-1">Terkirim</p>
        <p className="text-2xl font-medium text-green-700">{deliveredCount}</p>
        <p className="text-xs text-muted-foreground mt-1">
          dari {scheduledCount}
        </p>
      </div>
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-xs text-muted-foreground mb-1">Belum dijadwal</p>
        <p className="text-2xl font-medium text-amber-600">
          {unscheduledCount}
        </p>
        <p className="text-xs text-muted-foreground mt-1">menunggu penugasan</p>
      </div>
      <div className="bg-muted/50 rounded-lg p-4">
        <p className="text-xs text-muted-foreground mb-1">Driver aktif</p>
        <p className="text-2xl font-medium text-blue-700">
          {availableDriverCount}
        </p>
        <p className="text-xs text-muted-foreground mt-1">tersedia hari ini</p>
      </div>
    </div>
  );
}
