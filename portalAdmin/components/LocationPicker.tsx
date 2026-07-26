"use client";

import { useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker icon points at bundled image files that don't resolve
// correctly through Next's webpack build — an inline SVG divIcon avoids that broken-icon
// problem entirely and gives us the red pin look without any external image asset.
const redPinIcon = L.divIcon({
  className: "",
  html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#dc2626"/>
    <circle cx="15" cy="15" r="6" fill="#fff"/>
  </svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
});

export interface LocationPickResult {
  lat: number;
  lng: number;
  address?: string;
}

interface LocationPickerProps {
  lat: number | null;
  lng: number | null;
  /** Used as the initial map view when there's no pin yet. */
  centerFallback: { lat: number; lng: number };
  /** Bump this whenever the parent wants the map to pan/zoom to the current lat/lng (or
   *  centerFallback) — e.g. on first load. Not tied to every pick, so clicking/dragging
   *  the pin never yanks the viewport. */
  recenterSignal: number;
  onPick: (result: LocationPickResult) => void;
  onGeocodeError?: (message: string) => void;
}

// Nominatim (OpenStreetMap's free reverse-geocoding service) has a fair-use policy of
// ~1 request/second for its public instance — comfortably covered by an admin
// clicking/dragging a pin a few times while reviewing a shop. No API key needed.
async function reverseGeocode(lat: number, lng: number, signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=0`,
      { signal, headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.error || !data.display_name) return null;
    return data.display_name as string;
  } catch {
    return null;
  }
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lng, zoom, signal }: { lat: number; lng: number; zoom: number; signal: number }) {
  const map = useMap();
  const lastSignal = useRef(signal);
  if (lastSignal.current !== signal) {
    lastSignal.current = signal;
    map.setView([lat, lng], zoom);
  }
  return null;
}

/** Interactive map for admin to verify/mark a shop's exact pickup point against its
 *  typed address. No "use my location" control here — unlike the shop-profile picker
 *  this replaced, the admin reviewing a shop isn't physically there. */
export default function LocationPicker({
  lat,
  lng,
  centerFallback,
  recenterSignal,
  onPick,
  onGeocodeError,
}: LocationPickerProps) {
  const [geocoding, setGeocoding] = useState(false);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const center = lat != null && lng != null ? { lat, lng } : centerFallback;
  const zoom = lat != null && lng != null ? 16 : 12;

  async function handlePick(newLat: number, newLng: number) {
    onPick({ lat: newLat, lng: newLng });

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;

    setGeocoding(true);
    const address = await reverseGeocode(newLat, newLng, controller.signal);
    // A newer pick superseded this one while the request was in flight — discard the
    // stale response so it can't overwrite the feedback for a since-abandoned position.
    if (requestId !== requestIdRef.current) return;
    setGeocoding(false);

    if (address) {
      onPick({ lat: newLat, lng: newLng, address });
    } else {
      onGeocodeError?.("Couldn't look up an address for this exact spot — that's fine, you can still save the pin as-is.");
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-border">
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom className="h-64 w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ClickHandler onClick={handlePick} />
        {lat != null && lng != null && (
          <Marker
            position={[lat, lng]}
            icon={redPinIcon}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const pos = (e.target as L.Marker).getLatLng();
                void handlePick(pos.lat, pos.lng);
              },
            }}
          />
        )}
        <Recenter lat={center.lat} lng={center.lng} zoom={zoom} signal={recenterSignal} />
      </MapContainer>

      {geocoding && (
        <div className="absolute bottom-2 left-2 z-[1000] rounded-full bg-white/90 px-3 py-1 text-[11px] font-700 text-primary shadow-md">
          Looking up address…
        </div>
      )}
    </div>
  );
}
