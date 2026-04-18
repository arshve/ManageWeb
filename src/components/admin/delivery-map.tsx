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
import { supabase } from '@/lib/supabase';

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

const DRIVER_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#ea580c',
  '#9333ea',
  '#0891b2',
  '#ca8a04',
  '#db2777',
];

function colorFor(driverId: string | null, index: number): string {
  if (!driverId) return '#64748b';
  return DRIVER_COLORS[index % DRIVER_COLORS.length];
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

  const routeCacheRef = useRef<Record<string, [number, number][]>>({});
  const [routeVersion, setRouteVersion] = useState(0);

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

      let updated = false;
      for (const { cacheKey, coordsStr } of tasks) {
        if (cancelled) return;
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.code !== 'Ok' || !data.routes?.[0]) continue;
          const coords = data.routes[0].geometry.coordinates as [
            number,
            number,
          ][];
          routeCacheRef.current[cacheKey] = coords.map(([lng, lat]) => [
            lat,
            lng,
          ]);
          updated = true;
        } catch {
          // fall back to straight line
        }
      }
      if (!cancelled && updated) setRouteVersion((v) => v + 1);
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

  return (
    <div className="h-[500px] w-full rounded-lg overflow-hidden border">
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
          const idx = driverIndexMap.get(key) ?? 0;
          const color = colorFor(key === '__unassigned__' ? null : key, idx);
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
                  pathOptions={{ color, weight: 4, opacity: 0.8 }}
                />
              )}
              {list.map((s) => (
                <Marker
                  key={s.id}
                  position={[s.lat, s.lng]}
                  icon={numberedIcon((s.sequence ?? 0) + 1, color)}
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
          const idx = driverIndexMap.get(d.id) ?? 0;
          const color = DRIVER_COLORS[idx % DRIVER_COLORS.length];
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
    </div>
  );
}
