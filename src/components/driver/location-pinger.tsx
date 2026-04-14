'use client';

import { useEffect, useRef } from 'react';

const INTERVAL_MS = 60_000;

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

    const watchId = navigator.geolocation.watchPosition(
      send,
      (err) => console.warn('geo error', err),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );

    const tick = setInterval(() => {
      navigator.geolocation.getCurrentPosition(send, () => {}, {
        enableHighAccuracy: true,
      });
    }, INTERVAL_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(tick);
    };
  }, []);

  return null;
}
