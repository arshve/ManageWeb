'use client';

import { useEffect, useRef } from 'react';

const INTERVAL_MS = 60_000;

const GEO_ERRORS: Record<number, string> = {
  1: 'Permission denied — user blocked location access',
  2: 'Position unavailable — no GPS signal',
  3: 'Timeout — took too long to get location',
};

export function LocationPinger() {
  const lastSent = useRef(0);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    async function send(pos: GeolocationPosition) {
      if (Date.now() - lastSent.current < INTERVAL_MS - 5000) return;
      lastSent.current = Date.now();
      try {
        await fetch('/api/driver/location', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        });
      } catch {
        // swallow — next tick retries
      }
    }

    function onError(err: GeolocationPositionError) {
      // Code 3 (timeout) is normal on first lock — don't spam console
      if (err.code === 3) return;
      console.warn('geo error', GEO_ERRORS[err.code] ?? err.message);
    }

    const watchId = navigator.geolocation.watchPosition(send, onError, {
      enableHighAccuracy: true,
      maximumAge: 30_000,
      timeout: 30_000, // was 20s — give more time for initial GPS lock
    });

    const tick = setInterval(() => {
      navigator.geolocation.getCurrentPosition(send, onError, {
        enableHighAccuracy: true,
        timeout: 30_000,
      });
    }, INTERVAL_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(tick);
    };
  }, []);

  return null;
}
