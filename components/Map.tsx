import {
  GoogleMap,
  InfoWindow,
  Marker,
  useJsApiLoader
} from '@react-google-maps/api';
import { memo, useCallback, useState } from 'react';
import styled from 'styled-components';

import { FuelEntry } from '../pages/api/fuel/[lat]/[lng]';
import { FuelEntryCard } from './FuelEntry';

interface MapProps {
  currentLocation: GeolocationPosition;
  results: FuelEntry[];
}

const containerStyle = {
  width: '400px',
  height: '400px'
};

const StyledFuelEntryCard = styled(FuelEntryCard)`
  margin-top: 0;
  border: none;
`;
export const Map = memo(({ currentLocation, results }: MapProps) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_MAPS_API_KEY ?? ''
  });
  const [map, setMap] = useState(null);

  const [showInfo, setShowInfo] = useState<FuelEntry>();
  const onLoad = useCallback(function callback(map) {
    google.maps.event.addListener(map, 'click', function () {
      setShowInfo(undefined);
    });

    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map) {
    setMap(null);
  }, []);

  const { latitude, longitude } = currentLocation.coords;

  return isLoaded ? (
    <GoogleMap
      zoom={12}
      center={{
        lat: latitude,
        lng: longitude
      }}
      onLoad={onLoad}
      onUnmount={onUnmount}
      mapContainerStyle={containerStyle}
    >
      <Marker
        position={{
          lat: latitude,
          lng: longitude
        }}
        icon="https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
      ></Marker>
      {results &&
        results.map((fuelEntry, idx) => (
          <Marker
            key={idx}
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
          <StyledFuelEntryCard fuelEntry={showInfo} />
        </InfoWindow>
      )}
    </GoogleMap>
  ) : (
    <div>Map not loaded</div>
  );
});
