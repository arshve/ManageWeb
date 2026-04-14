export function getDefaultDepot(): { lat: number; lng: number } {
  return {
    lat: Number(process.env.FARM_LAT ?? 0),
    lng: Number(process.env.FARM_LNG ?? 0),
  };
}
