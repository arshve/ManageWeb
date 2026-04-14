type LatLng = { lat: number; lng: number };

export function navigationUrl(stop: {
  buyerMaps?: string | null;
  buyerLat?: number | null;
  buyerLng?: number | null;
  buyerAddress?: string | null;
}): string | null {
  if (stop.buyerMaps) return stop.buyerMaps;
  if (stop.buyerLat != null && stop.buyerLng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${stop.buyerLat},${stop.buyerLng}`;
  }
  if (stop.buyerAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.buyerAddress)}`;
  }
  return null;
}

/**
 * Multi-stop route URL — opens Google Maps directions with the full sequence.
 * Google Maps caps shareable URLs at ~10 legs, so we chunk longer routes.
 */
export function routeUrl(depot: LatLng, stops: LatLng[]): string[] {
  if (stops.length === 0) return [];
  const CHUNK = 9;
  const chunks: string[] = [];
  for (let i = 0; i < stops.length; i += CHUNK) {
    const slice = stops.slice(i, i + CHUNK);
    const origin = i === 0 ? depot : stops[i - 1];
    const destination = slice[slice.length - 1];
    const waypoints = slice.slice(0, -1);
    const params = new URLSearchParams({
      api: '1',
      origin: `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      travelmode: 'driving',
    });
    if (waypoints.length > 0) {
      params.set(
        'waypoints',
        waypoints.map((w) => `${w.lat},${w.lng}`).join('|'),
      );
    }
    chunks.push(`https://www.google.com/maps/dir/?${params.toString()}`);
  }
  return chunks;
}
