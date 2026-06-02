'use client';

// Client-only loader for the Leaflet picker (Leaflet touches `window`, so ssr:false).

import dynamic from 'next/dynamic';

export const LocationPicker = dynamic(() => import('./location-picker'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/40 text-xs text-muted-foreground">
      Memuat peta…
    </div>
  ),
});

export type { LatLng } from './location-picker';
