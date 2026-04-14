'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type DriverLoc = {
  id: string;
  name: string;
  lastLat: number | null;
  lastLng: number | null;
  lastLocationAt: string | null;
};

export function DriverTracker({ initial }: { initial: DriverLoc[] }) {
  const [drivers, setDrivers] = useState(initial);

  useEffect(() => {
    const channel = supabase
      .channel('driver-locations')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'Profile' },
        (payload) => {
          const next = payload.new as Partial<DriverLoc> & {
            id: string;
            role: string;
          };
          if (next.role !== 'DRIVER') return;
          setDrivers((prev) =>
            prev.map((d) =>
              d.id === next.id
                ? {
                    ...d,
                    lastLat: next.lastLat ?? d.lastLat,
                    lastLng: next.lastLng ?? d.lastLng,
                    lastLocationAt: next.lastLocationAt ?? d.lastLocationAt,
                  }
                : d,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <ul className="text-sm space-y-1 border rounded-lg p-3">
      {drivers.length === 0 && (
        <li className="text-muted-foreground text-xs">
          Belum ada driver terdaftar.
        </li>
      )}
      {drivers.map((d) => (
        <li key={d.id} className="flex items-center gap-2">
          <span className="font-medium">{d.name}</span>
          {d.lastLat != null && d.lastLng != null ? (
            <>
              <span className="text-muted-foreground">
                {d.lastLat.toFixed(4)}, {d.lastLng.toFixed(4)}
              </span>
              {d.lastLocationAt && (
                <span className="text-muted-foreground text-xs ml-auto">
                  {new Date(d.lastLocationAt).toLocaleTimeString()}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground text-xs">no signal</span>
          )}
        </li>
      ))}
    </ul>
  );
}
