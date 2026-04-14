'use client';

import dynamic from 'next/dynamic';

export const DeliveryMap = dynamic(
  () => import('./delivery-map').then((m) => m.DeliveryMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] w-full rounded-lg border bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
        Memuat peta...
      </div>
    ),
  },
);

export type { MapStop, MapDriver } from './delivery-map';
