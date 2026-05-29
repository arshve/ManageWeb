import { prisma } from '@/lib/prisma';

/** Queue position info for one delivery within its driver+date route. */
export type DeliveryProgress = {
  position: number;       // 1-based stop number
  totalStops: number;     // total stops on this driver's route for the day
  /**
   * Every stop on this driver's route for the day, in delivery order.
   * One entry per stop — the consumer can derive "ahead of me" / "after me"
   * counts and render a dot per stop with its real status (so visibility
   * extends past the user's own entry).
   */
  stops: { status: string }[];
};

type EntryWithDelivery = {
  deliveryDate: Date | null;
  delivery: { id: string; driverId: string | null; sequence: number | null } | null;
};

/**
 * Given a batch of entries, compute the per-delivery queue progression in a
 * single round-trip. Returns a Map keyed by delivery.id; entries whose delivery
 * isn't assigned to a driver/date are simply absent from the map.
 */
export async function getDeliveryProgressMap(
  entries: EntryWithDelivery[],
): Promise<Map<string, DeliveryProgress>> {
  // Collect unique (driverId, deliveryDate) pairs.
  const pairs = new Map<string, { driverId: string; date: Date }>();
  for (const e of entries) {
    if (!e.delivery?.driverId || !e.deliveryDate) continue;
    const key = `${e.delivery.driverId}|${e.deliveryDate.toISOString()}`;
    if (!pairs.has(key)) {
      pairs.set(key, { driverId: e.delivery.driverId, date: e.deliveryDate });
    }
  }
  if (pairs.size === 0) return new Map();

  // One query for every delivery on the involved routes.
  const allDeliveries = await prisma.delivery.findMany({
    where: {
      OR: Array.from(pairs.values()).map((p) => ({
        driverId: p.driverId,
        entry: { deliveryDate: p.date },
      })),
    },
    select: {
      id: true,
      driverId: true,
      sequence: true,
      status: true,
      entry: { select: { deliveryDate: true } },
    },
  });

  // Group by route, sort by sequence, then compute per-stop progression.
  const routes = new Map<string, typeof allDeliveries>();
  for (const d of allDeliveries) {
    if (!d.driverId || !d.entry.deliveryDate) continue;
    const key = `${d.driverId}|${d.entry.deliveryDate.toISOString()}`;
    const list = routes.get(key);
    if (list) list.push(d);
    else routes.set(key, [d]);
  }

  const result = new Map<string, DeliveryProgress>();
  for (const list of routes.values()) {
    list.sort(
      (a, b) =>
        (a.sequence ?? Number.MAX_SAFE_INTEGER) -
        (b.sequence ?? Number.MAX_SAFE_INTEGER),
    );
    // Snapshot of every stop's status (in delivery order) — shared across all
    // entries on the same route, so consumers can see the whole route.
    const stops = list.map((d) => ({ status: d.status }));
    list.forEach((d, idx) => {
      result.set(d.id, {
        position: idx + 1,
        totalStops: list.length,
        stops,
      });
    });
  }
  return result;
}
