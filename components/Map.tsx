'use client';

import {
  GoogleMap,
  InfoWindow,
  Marker,
  useJsApiLoader
} from '@react-google-maps/api';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import type { FuelEntry } from '../types/fuel';
import { MapInfoCard } from './MapInfoCard';

interface MapProps {
  currentLocation: { lat: number; lng: number };
  results: FuelEntry[];
  priceTierFor: (price: number) => 'cheap' | 'mid' | 'expensive';
  onRecenter?: () => void;
}

const containerStyle = {
  width: '100%',
  height: '320px'
};

export const Map = memo(({ currentLocation, results, priceTierFor, onRecenter }: MapProps) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_MAPS_API_KEY ?? ''
  });
  const [showInfo, setShowInfo] = useState<FuelEntry>();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const userDragging = useRef(false);

  const center = useMemo(
    () => ({ lat: currentLocation.lat, lng: currentLocation.lng }),
    [currentLocation.lat, currentLocation.lng]
  );

  const onLoad = useCallback(function callback(mapInstance: google.maps.Map) {
    google.maps.event.addListener(mapInstance, 'click', function () {
      setShowInfo(undefined);
    });
    google.maps.event.addListener(mapInstance, 'dragstart', function () {
      userDragging.current = true;
    });
    google.maps.event.addListener(mapInstance, 'dragend', function () {
      userDragging.current = true;
    });
    setMap(mapInstance);
  }, []);

  // Reset drag flag and pan map when location changes
  const prevLocationKey = useRef(`${currentLocation.lat},${currentLocation.lng}`);
  const locationKey = `${currentLocation.lat},${currentLocation.lng}`;
  if (locationKey !== prevLocationKey.current) {
    prevLocationKey.current = locationKey;
    userDragging.current = false;
    // Imperatively pan if map is already loaded
    if (map) {
      map.panTo(center);
    }
  }

  const handleRecenter = useCallback(() => {
    if (map) {
      map.panTo(center);
      userDragging.current = false;
    }
    onRecenter?.();
  }, [map, center, onRecenter]);

  if (!isLoaded) {
    return (
      <div className="rounded-2xl border bg-white/70 p-4 text-sm text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
        Map loading…
      </div>
    );
  }

  return (
    <div className="relative">
      <GoogleMap
        zoom={12}
        center={userDragging.current ? undefined : center}
        onLoad={onLoad}
        onUnmount={() => setMap(null)}
        mapContainerStyle={containerStyle}
      >
        <Marker
          position={center}
          icon="https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
        ></Marker>
        {results.map((fuelEntry, idx) => (
          <Marker
            key={`${fuelEntry.id}-${idx}`}
            position={{
              lat: fuelEntry.lat,
              lng: fuelEntry.lng
            }}
            label={`${idx + 1}`}
            title={fuelEntry.name}
            onClick={() => setShowInfo(fuelEntry)}
          />
        ))}
        {showInfo && (
          <InfoWindow
            position={{
              lat: showInfo.lat,
              lng: showInfo.lng
            }}
            options={{
              pixelOffset: new window.google.maps.Size(0, -40),
              maxWidth: 300,
            }}
            onCloseClick={() => setShowInfo(undefined)}
          >
            <MapInfoCard
              fuelEntry={showInfo}
              priceTier={priceTierFor(showInfo.price)}
            />
          </InfoWindow>
        )}
      </GoogleMap>
      <button
        onClick={handleRecenter}
        className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md border border-slate-200 hover:bg-slate-50 transition"
        title="Re-center on current location"
        type="button"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" fill="currentColor">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2a1 1 0 0 1 1 1v2.07A7.004 7.004 0 0 1 18.93 11H21a1 1 0 1 1 0 2h-2.07A7.004 7.004 0 0 1 13 18.93V21a1 1 0 1 1-2 0v-2.07A7.004 7.004 0 0 1 5.07 13H3a1 1 0 1 1 0-2h2.07A7.004 7.004 0 0 1 11 5.07V3a1 1 0 0 1 1-1Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" fillRule="evenodd" />
        </svg>
      </button>
    </div>
  );
});

Map.displayName = 'Map';
