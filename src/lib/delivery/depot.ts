const FALLBACK_DEPOT = { lat: -6.3078445, lng: 106.6943313 };

export function getDefaultDepot(): { lat: number; lng: number } {
  const lat = Number(process.env.FARM_LAT);
  const lng = Number(process.env.FARM_LNG);
  if (isFinite(lat) && isFinite(lng) && !(lat === 0 && lng === 0)) {
    return { lat, lng };
  }
  return { ...FALLBACK_DEPOT };
}
