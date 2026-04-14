import { haversineKm } from './geo';

type Pt = { id: string; lat: number; lng: number };

/**
 * Balanced split into N driver buckets via farthest-first seeding,
 * then assign each remaining point to its nearest non-full seed.
 */
export function splitToDrivers(points: Pt[], driverCount: number): Pt[][] {
  if (driverCount <= 0 || points.length === 0) return [];
  if (driverCount === 1) return [points];

  const cap = Math.ceil(points.length / driverCount);
  const buckets: Pt[][] = Array.from({ length: driverCount }, () => []);
  const remaining = [...points];

  const seeds: Pt[] = [remaining.shift()!];
  buckets[0].push(seeds[0]);

  while (seeds.length < driverCount && remaining.length > 0) {
    let farIdx = 0;
    let farDist = -1;
    remaining.forEach((p, i) => {
      const d = Math.min(...seeds.map((s) => haversineKm(s, p)));
      if (d > farDist) {
        farDist = d;
        farIdx = i;
      }
    });
    const s = remaining.splice(farIdx, 1)[0];
    buckets[seeds.length].push(s);
    seeds.push(s);
  }

  for (const p of remaining) {
    const ranked = seeds
      .map((s, i) => ({
        i,
        full: buckets[i].length >= cap,
        d: haversineKm(s, p),
      }))
      .filter((x) => !x.full)
      .sort((a, b) => a.d - b.d);
    const target = ranked[0]?.i ?? 0;
    buckets[target].push(p);
  }
  return buckets;
}
