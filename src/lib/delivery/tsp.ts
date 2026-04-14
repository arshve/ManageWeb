import { haversineKm } from './geo';

type Pt = { id: string; lat: number; lng: number };

export function nearestNeighbor(depot: Pt, pts: Pt[]): Pt[] {
  const remaining = [...pts];
  const route: Pt[] = [];
  let cur = depot;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((p, i) => {
      const d = haversineKm(cur, p);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    const next = remaining.splice(bestIdx, 1)[0];
    route.push(next);
    cur = next;
  }
  return route;
}

function tourDist(depot: Pt, route: Pt[]): number {
  if (route.length === 0) return 0;
  let total = haversineKm(depot, route[0]);
  for (let i = 0; i < route.length - 1; i++) {
    total += haversineKm(route[i], route[i + 1]);
  }
  return total;
}

export function twoOpt(depot: Pt, route: Pt[]): Pt[] {
  if (route.length < 4) return route;
  let best = [...route];
  let improved = true;
  while (improved) {
    improved = false;
    // route[0] is pinned as the nearest to depot — 2-opt optimizes the tail only.
    for (let i = 1; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        if (tourDist(depot, candidate) + 1e-9 < tourDist(depot, best)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

export function solveTSP(depot: Pt, pts: Pt[]): Pt[] {
  return twoOpt(depot, nearestNeighbor(depot, pts));
}
