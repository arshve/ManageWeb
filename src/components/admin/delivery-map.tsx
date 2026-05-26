'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export type MapStop = {
  id: string;
  invoiceNo: string;
  sku: string | undefined;
  buyerName: string;
  lat: number;
  lng: number;
  sequence: number | null;
  status: string;
  driverId: string | null;
  driverName: string | null;
};

export type MapDriver = {
  id: string;
  name: string;
  lastLat: number | null;
  lastLng: number | null;
  lastLocationAt: string | null;
};

// CSS var strings for use in HTML style attributes (DivIcon markers).
// Values live in --pin-1…--pin-8 in globals.css (Layer 3) — edit there.
const PIN_COLORS = Array.from({ length: 8 }, (_, i) => `var(--pin-${i + 1})`);

function colorFor(driverId: string | null, index: number): string {
  if (!driverId) return 'var(--pin-unassigned)';
  return PIN_COLORS[index % PIN_COLORS.length];
}

function numberedIcon(n: number, color: string): L.DivIcon {
  return L.divIcon({
    className: 'delivery-stop-marker',
    html: `<div style="background:${color};color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function depotIcon(): L.DivIcon {
  return L.divIcon({
    className: 'delivery-depot-marker',
    html: `<div style="background:#0f172a;color:#fff;width:32px;height:32px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);">🏠</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function driverIcon(color: string, label: string): L.DivIcon {
  return L.divIcon({
    className: 'driver-ping-marker',
    html: `<div style="display:flex;flex-direction:column;align-items:center;"><div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px ${color},0 1px 4px rgba(0,0,0,0.4);animation:pulse 2s infinite;"></div><div style="margin-top:2px;font-size:10px;background:#fff;padding:1px 4px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.2);">${label}</div></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, points]);
  return null;
}

export function DeliveryMap({
  depot,
  stops,
  drivers: initialDrivers,
}: {
  depot: { lat: number; lng: number };
  stops: MapStop[];
  drivers: MapDriver[];
}) {
  const [drivers, setDrivers] = useState(initialDrivers);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [routesPanelOpen, setRoutesPanelOpen] = useState(false);

  const toggleKey = (key: string) =>
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useEffect(() => setDrivers(initialDrivers), [initialDrivers]);

  useEffect(() => {
    const channel = supabase
      .channel('delivery-map-driver-locations')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'Profile' },
        (payload) => {
          const next = payload.new as Partial<MapDriver> & {
            id: string;
            role: string;
          };
          if (next.role !== 'DRIVER') return;
          setDrivers((prev) =>
            prev.map((d) =>
              d.id === next.id
                ? {
                    ...d,
                    lastLat: next.lastLat ?? d.lastLat,
                    lastLng: next.lastLng ?? d.lastLng,
                    lastLocationAt: next.lastLocationAt ?? d.lastLocationAt,
                  }
                : d,
            ),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const { driverGroups, driverIndexMap } = useMemo(() => {
    const groups = new Map<string, MapStop[]>();
    for (const s of stops) {
      const key = s.driverId ?? '__unassigned__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    }
    const indexMap = new Map<string, number>();
    let i = 0;
    for (const key of groups.keys()) {
      if (key !== '__unassigned__') indexMap.set(key, i++);
    }
    return { driverGroups: groups, driverIndexMap: indexMap };
  }, [stops]);

  // SVG stroke (Polyline) can't resolve CSS custom properties — read computed values once.
  const resolvedPinColors = useMemo(() => {
    if (typeof window === 'undefined') return PIN_COLORS; // SSR fallback (strings ignored by Leaflet SSR)
    const styles = getComputedStyle(document.documentElement);
    return Array.from({ length: 8 }, (_, i) =>
      styles.getPropertyValue(`--pin-${i + 1}`).trim() || PIN_COLORS[i],
    );
  }, []);

  const routeCacheRef = useRef<Record<string, [number, number][]>>({});
  const [routeVersion, setRouteVersion] = useState(0);
  const [routingFailed, setRoutingFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      const tasks: Array<{ cacheKey: string; coordsStr: string }> = [];
      for (const [key, list] of driverGroups.entries()) {
        if (key === '__unassigned__' || list.length === 0) continue;
        const coordsStr = [
          `${depot.lng},${depot.lat}`,
          ...list.map((s) => `${s.lng},${s.lat}`),
        ].join(';');
        const cacheKey = `${key}|${coordsStr}`;
        if (routeCacheRef.current[cacheKey]) continue;
        tasks.push({ cacheKey, coordsStr });
      }
      if (tasks.length === 0) return;

      const fetchRoute = async (coordsStr: string): Promise<[number, number][] | null> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) return null;
          const data = await res.json();
          if (data.code !== 'Ok' || !data.routes?.[0]) return null;
          const coords = data.routes[0].geometry.coordinates as [number, number][];
          return coords.map(([lng, lat]) => [lat, lng]);
        } catch (err) {
          console.warn('[delivery-map] OSRM fetch failed:', err);
          return null;
        } finally {
          clearTimeout(timer);
        }
      };

      let updated = false;
      let anyFailed = false;
      for (const { cacheKey, coordsStr } of tasks) {
        if (cancelled) return;
        let result = await fetchRoute(coordsStr);
        // retry once after a short pause before giving up
        if (!result && !cancelled) {
          await new Promise((r) => setTimeout(r, 1000));
          result = await fetchRoute(coordsStr);
        }
        if (result) {
          routeCacheRef.current[cacheKey] = result;
          updated = true;
        } else {
          anyFailed = true;
        }
        // small gap between sequential requests to avoid rate-limiting
        if (!cancelled) await new Promise((r) => setTimeout(r, 200));
      }
      if (!cancelled) {
        if (updated) setRouteVersion((v) => v + 1);
        if (anyFailed) setRoutingFailed(true);
        else setRoutingFailed(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [depot.lat, depot.lng, driverGroups]);

  const allPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [[depot.lat, depot.lng]];
    for (const s of stops) pts.push([s.lat, s.lng]);
    for (const d of drivers) {
      if (d.lastLat != null && d.lastLng != null)
        pts.push([d.lastLat, d.lastLng]);
    }
    return pts;
  }, [depot, stops, drivers]);

  const center: [number, number] = [depot.lat, depot.lng];

  const routeList = useMemo(
    () =>
      Array.from(driverGroups.entries()).map(([key, list]) => {
        const idx = driverIndexMap.get(key) ?? 0;
        return {
          key,
          color: colorFor(key === '__unassigned__' ? null : key, idx),
          name:
            key === '__unassigned__'
              ? 'Belum di-assign'
              : list[0]?.driverName ?? 'Driver',
          count: list.length,
        };
      }),
    [driverGroups, driverIndexMap],
  );

  return (
    <div className="flex flex-col gap-2">
    {routingFailed && (
      <p className="text-xs text-warning-fg bg-warning-bg border border-warning-ring/40 rounded px-3 py-2">
        ⚠ Gagal memuat rute jalan dari OSRM — menampilkan garis lurus. Periksa koneksi internet lalu refresh halaman.
      </p>
    )}
    <div className="relative h-[500px] w-full rounded-lg overflow-hidden border">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints} />

        <Marker position={[depot.lat, depot.lng]} icon={depotIcon()}>
          <Popup>
            <strong>Titik awal</strong>
            <br />
            {depot.lat.toFixed(5)}, {depot.lng.toFixed(5)}
          </Popup>
        </Marker>

        {Array.from(driverGroups.entries()).map(([key, list]) => {
          if (hiddenKeys.has(key)) return null;
          const idx = driverIndexMap.get(key) ?? 0;
          const markerColor = colorFor(key === '__unassigned__' ? null : key, idx);
          const lineColor = resolvedPinColors[idx % resolvedPinColors.length];
          const coordsStr = [
            `${depot.lng},${depot.lat}`,
            ...list.map((s) => `${s.lng},${s.lat}`),
          ].join(';');
          const cacheKey = `${key}|${coordsStr}`;
          void routeVersion;
          const linePoints: [number, number][] = routeCacheRef.current[
            cacheKey
          ] ?? [
            [depot.lat, depot.lng],
            ...list.map((s) => [s.lat, s.lng] as [number, number]),
          ];
          return (
            <div key={key}>
              {key !== '__unassigned__' && (
                <Polyline
                  positions={linePoints}
                  pathOptions={{ color: lineColor, weight: 4, opacity: 0.8 }}
                />
              )}
              {list.map((s) => (
                <Marker
                  key={s.id}
                  position={[s.lat, s.lng]}
                  icon={numberedIcon((s.sequence ?? 0) + 1, markerColor)}
                >
                  <Popup>
                    <strong>{s.buyerName}</strong>
                    <br />
                    {s.sku}
                    <br />
                    <span style={{ color: '#64748b' }}>
                      {s.driverName ?? 'Belum di-assign'} · {s.status}
                    </span>
                  </Popup>
                </Marker>
              ))}
            </div>
          );
        })}

        {drivers.map((d) => {
          if (d.lastLat == null || d.lastLng == null) return null;
          if (hiddenKeys.has(d.id)) return null;
          const idx = driverIndexMap.get(d.id) ?? 0;
          const color = colorFor(d.id, idx);
          return (
            <Marker
              key={`ping-${d.id}`}
              position={[d.lastLat, d.lastLng]}
              icon={driverIcon(color, d.name)}
              zIndexOffset={1000}
            >
              <Popup>
                <strong>{d.name}</strong>
                <br />
                {d.lastLat.toFixed(5)}, {d.lastLng.toFixed(5)}
                <br />
                {d.lastLocationAt && (
                  <span style={{ color: '#64748b', fontSize: 11 }}>
                    {new Date(d.lastLocationAt).toLocaleTimeString()}
                  </span>
                )}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {routeList.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[1000] w-56 max-w-[calc(100%-1.5rem)] overflow-hidden rounded-lg border bg-card/95 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => setRoutesPanelOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium"
          >
            <span>Rute Driver ({routeList.length})</span>
            {routesPanelOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
          {routesPanelOpen && (
            <div className="max-h-48 space-y-0.5 overflow-y-auto border-t p-1">
              {routeList.map((d) => {
                const hidden = hiddenKeys.has(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleKey(d.key)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: d.color, opacity: hidden ? 0.25 : 1 }}
                    />
                    <span
                      className={cn(
                        'flex-1 truncate text-left',
                        hidden && 'text-muted-foreground line-through',
                      )}
                    >
                      {d.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {d.count}
                    </span>
                    {hidden ? (
                      <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
