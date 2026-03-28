'use client';

import {
  GoogleMap,
  InfoWindow,
  Marker,
  useJsApiLoader
} from '@react-google-maps/api';
import { memo, useCallback, useMemo, useState } from 'react';

import type { FuelEntry } from '../types/fuel';
import { FuelEntryCard } from './FuelEntry';

interface MapProps {
  currentLocation: { lat: number; lng: number };
  results: FuelEntry[];
  priceTierFor: (price: number) => 'cheap' | 'mid' | 'expensive';
}

const containerStyle = {
  width: '100%',
  height: '320px'
};

export const Map = memo(({ currentLocation, results, priceTierFor }: MapProps) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_MAPS_API_KEY ?? ''
  });
  const [showInfo, setShowInfo] = useState<FuelEntry>();
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const { latitude, longitude } = useMemo(
    () => ({
      latitude: currentLocation.lat,
      longitude: currentLocation.lng
    }),
    [currentLocation]
  );

  const [mapCentre, setMapCentre] = useState<
    google.maps.LatLng | google.maps.LatLngLiteral | undefined
  >({ lat: latitude, lng: longitude });

  const onLoad = useCallback(function callback(mapInstance: google.maps.Map) {
    google.maps.event.addListener(mapInstance, 'click', function () {
      setShowInfo(undefined);
    });
    setMap(mapInstance);
  }, []);

  if (!isLoaded) {
    return (
      <div className="rounded-2xl border bg-white/70 p-4 text-sm text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
        Map loading…
      </div>
    );
  }

  return (
    <GoogleMap
      zoom={12}
      center={mapCentre}
      onLoad={onLoad}
      onUnmount={() => setMap(null)}
      mapContainerStyle={containerStyle}
      onCenterChanged={() => {
        const centre = map?.getCenter();
        if (!centre) {
          return;
        }
        setMapCentre(centre);
      }}
    >
      <Marker
        position={{
          lat: latitude,
          lng: longitude
        }}
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
            pixelOffset: new window.google.maps.Size(0, -40)
          }}
          onCloseClick={() => setShowInfo(undefined)}
        >
          <div className="w-64">
            <FuelEntryCard
              fuelEntry={showInfo}
              priceTier={priceTierFor(showInfo.price)}
            />
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
});

Map.displayName = 'Map';
