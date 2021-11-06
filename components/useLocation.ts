import { useEffect, useState } from 'react';

export const useLocation = () => {
  const [location, setLocation] = useState<GeolocationPosition | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      return navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(position);
        },
        (error) => {
          console.error(error);
        }
      );
    } else {
      console.error('No navigator.geolocation');
    }
  }, []);
  return location;
};
