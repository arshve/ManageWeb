'use client';

import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  vehiclePlate: string | null;
  isAvailable: boolean;
};

type MapDriver = {
  id: string;
  name: string;
  lastLat: number | null;
  lastLng: number | null;
  lastLocationAt: string | null;
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DriverAvailableTable({
  drivers,
  mapDrivers,
  dateStr,
}: {
  drivers: Driver[];
  mapDrivers: MapDriver[];
  dateStr: string;
}) {
  const locationMap = Object.fromEntries(mapDrivers.map((d) => [d.id, d]));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">
          Driver Available —{' '}
          <span className="text-muted-foreground font-normal">{dateStr}</span>
        </h2>
        <span className="text-xs text-muted-foreground">
          {drivers.filter((d) => d.isAvailable).length} dari {drivers.length}{' '}
          tersedia
        </span>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10"></TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead>Plat Kendaraan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lokasi Terakhir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drivers.map((driver) => {
              const loc = locationMap[driver.id];
              return (
                <TableRow key={driver.id}>
                  <TableCell>
                    <Checkbox />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium shrink-0">
                        {getInitials(driver.name)}
                      </div>
                      <span className="font-medium text-sm">{driver.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {driver.phone ?? '—'}
                  </TableCell>
                  <TableCell>
                    {driver.vehiclePlate ? (
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                        {driver.vehiclePlate}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {driver.isAvailable ? (
                      <Badge
                        variant="outline"
                        className="text-green-700 bg-green-50 border-green-200 gap-1.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-green-600 inline-block" />
                        Tersedia
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground bg-muted gap-1.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
                        Tidak tersedia
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {loc?.lastLat && loc?.lastLng ? (
                      <span>
                        {loc.lastLat.toFixed(4)}, {loc.lastLng.toFixed(4)}
                        <span className="ml-2 text-muted-foreground/60">
                          · {formatTime(loc.lastLocationAt)}
                        </span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              );
            })}

            {drivers.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  Tidak ada driver terdaftar
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
