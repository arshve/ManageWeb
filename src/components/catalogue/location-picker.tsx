'use client';

// Interactive "pick from map" location picker (Leaflet + OSM tiles — no API key).
// Tap the map or drag the pin to set the exact delivery point. Value is lat/lng;
// the parent turns it into a Google Maps link + feeds buyerLat/buyerLng to the
// delivery flow. Loaded client-only (see location-picker-loader).

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type LatLng = { lat: number; lng: number };

// Default view: farm depot area (Tangerang Selatan) when nothing picked yet.
const DEFAULT_CENTER: [number, number] = [-6.3078445, 106.6943313];

const round = (n: number) => Math.round(n * 1e6) / 1e6;

const pinIcon = L.divIcon({
  className: 'mf-pick-pin',
  html: `<div style="transform:translate(-50%,-100%);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
    <svg width="34" height="44" viewBox="0 0 34 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 43C17 43 32 27.5 32 16C32 7.71573 25.2843 1 17 1C8.71573 1 2 7.71573 2 16C2 27.5 17 43 17 43Z" fill="#0C4C3C" stroke="#fff" stroke-width="2"/>
      <circle cx="17" cy="16" r="5.5" fill="#fff"/>
    </svg>
  </div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

function ClickCapture({ onPick }: { onPick: (c: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: round(e.latlng.lat), lng: round(e.latlng.lng) });
    },
  });
  return null;
}

// Map mounts inside an animating dialog — recompute size once it settles so
// tiles don't render greyed/clipped.
function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function Recenter({ value }: { value: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
    // re-run only when the picked point changes
  }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function LocationPicker({
  value,
  onChange,
}: {
  value: LatLng | null;
  onChange: (c: LatLng) => void;
}) {
  return (
    <MapContainer
      center={value ? [value.lat, value.lng] : DEFAULT_CENTER}
      zoom={value ? 16 : 11}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      <ClickCapture onPick={onChange} />
      <InvalidateOnMount />
      <Recenter value={value} />
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const p = (e.target as L.Marker).getLatLng();
              onChange({ lat: round(p.lat), lng: round(p.lng) });
            },
          }}
        />
      )}
    </MapContainer>
  );
}
