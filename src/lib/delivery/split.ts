type Pt = { id: string; lat: number; lng: number };

function sqDist(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dlat = a.lat - b.lat;
  const dlng = a.lng - b.lng;
  return dlat * dlat + dlng * dlng;
}

/**
 * Split stops into driver buckets using k-means geographic clustering.
 *
 * Centers are seeded with k-means++ (start from the point furthest from the
 * depot, then pick each subsequent seed as the point furthest from any
 * existing center). This spreads initial seeds across the map so each
 * driver naturally owns one geographic zone — no equal-count constraint,
 * so a dense far-east cluster stays together rather than being split across
 * adjacent sector boundaries.
 */
export function splitToDrivers(
  depot: Pt,
  points: Pt[],
  driverCount: number,
  maxPerDriver = 30,
): Pt[][] {
  if (driverCount <= 0 || points.length === 0) return [];
  if (driverCount === 1) return [points];
  if (points.length <= driverCount) return points.map((p) => [p]);

  // Seed: first center = point furthest from depot.
  const centers: { lat: number; lng: number }[] = [];
  {
    let best = points[0];
    let bestD = sqDist(best, depot);
    for (const p of points) {
      const d = sqDist(p, depot);
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    centers.push({ lat: best.lat, lng: best.lng });
  }

  // Remaining seeds: farthest from nearest existing center.
  while (centers.length < driverCount) {
    let next = points[0];
    let nextD = -Infinity;
    for (const p of points) {
      const d = Math.min(...centers.map((c) => sqDist(p, c)));
      if (d > nextD) {
        nextD = d;
        next = p;
      }
    }
    centers.push({ lat: next.lat, lng: next.lng });
  }

  // Iterate k-means until convergence.
  let clusters: Pt[][] = Array.from({ length: driverCount }, () => []);
  for (let iter = 0; iter < 100; iter++) {
    const next: Pt[][] = Array.from({ length: driverCount }, () => []);
    for (const p of points) {
      let best = 0;
      let bestD = sqDist(p, centers[0]);
      for (let i = 1; i < driverCount; i++) {
        const d = sqDist(p, centers[i]);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      next[best].push(p);
    }

    let moved = false;
    for (let i = 0; i < driverCount; i++) {
      if (next[i].length === 0) continue;
      const lat = next[i].reduce((s, p) => s + p.lat, 0) / next[i].length;
      const lng = next[i].reduce((s, p) => s + p.lng, 0) / next[i].length;
      if (
        Math.abs(lat - centers[i].lat) > 1e-8 ||
        Math.abs(lng - centers[i].lng) > 1e-8
      ) {
        centers[i] = { lat, lng };
        moved = true;
      }
    }
    clusters = next;
    if (!moved) break;
  }

  // Enforce per-driver cap: move excess stops to the nearest under-capacity cluster.
  // Takes the point furthest from its current cluster center each pass so the
  // most "borderline" stop moves first, minimising total route disruption.
  const CAP = maxPerDriver;
  const maxPasses = driverCount * CAP;
  for (let pass = 0; pass < maxPasses; pass++) {
    let anyOver = false;
    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i].length <= CAP) continue;
      anyOver = true;

      // Pick the point furthest from this cluster's center.
      let farthestIdx = 0;
      let farthestD = -1;
      for (let pi = 0; pi < clusters[i].length; pi++) {
        const d = sqDist(clusters[i][pi], centers[i]);
        if (d > farthestD) {
          farthestD = d;
          farthestIdx = pi;
        }
      }
      const p = clusters[i][farthestIdx];

      // Move it to the nearest cluster that still has capacity.
      let bestJ = -1;
      let bestD = Infinity;
      for (let j = 0; j < clusters.length; j++) {
        if (j === i || clusters[j].length >= CAP) continue;
        const d = sqDist(p, centers[j]);
        if (d < bestD) {
          bestD = d;
          bestJ = j;
        }
      }
      if (bestJ === -1) break; // all clusters at capacity — leave remaining over-cap
      clusters[i].splice(farthestIdx, 1);
      clusters[bestJ].push(p);
    }
    if (!anyOver) break;
  }

  // Filter empty clusters (can happen when driverCount exceeds meaningful zones).
  return clusters.filter((c) => c.length > 0);
}
