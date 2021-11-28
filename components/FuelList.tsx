import React, { useCallback, useState } from 'react';
import { useQuery } from 'react-query';
import { FuelEntry } from '../pages/api/fuel';
import { FuelEntryCard } from './FuelEntry';
import { useLocation } from './useLocation';

interface Props {}

const Location = ({
  currentLocation
}: {
  currentLocation: GeolocationPosition | null;
}) => (
  <div>
    Your location is: {currentLocation?.coords.latitude},{' '}
    {currentLocation?.coords.longitude}
  </div>
);

const FuelList = (props: Props) => {
  const currentLocation = useLocation();
  const { isLoading, isSuccess, error, data } = useQuery<FuelEntry[]>(
    ['GET_FUEL_LIST', currentLocation],
    () => {
      return fetch(
        `/api/fuel/${currentLocation?.coords.latitude}/${currentLocation?.coords.longitude}`
      ).then((res) => res.json());
    }
  );

  const [filter, setFilter] = useState('7-Eleven');
  const onChange = useCallback((evt) => {
    setFilter(evt.target.value);
  }, []);

  type SortField = 'price' | 'distance';
  const [sort, setSort] = useState<SortField>('price');
  const onChangeSort = useCallback((evt) => {
    setSort(evt.target.value);
  }, []);

  if (isLoading || !currentLocation) {
    return (
      <div>
        Loading...
        <Location currentLocation={currentLocation} />
      </div>
    );
  }

  return (
    <div>
      <Location currentLocation={currentLocation} />
      <br />
      <br />
      <label>
        Filter: <input type="text" onChange={onChange} value={filter} />
      </label>
      <br />
      <label>
        Sort by({sort}):{' '}
        <select onChange={onChangeSort} value={sort}>
          {['Distance', 'Price'].map((option) => (
            <option key={option.toLowerCase()} value={option.toLowerCase()}>
              {option}
            </option>
          ))}
        </select>
      </label>
      {isSuccess &&
        (data ?? []).length > 0 &&
        (data ?? [])
          .filter((entry) =>
            entry.name.toLowerCase().includes(filter.toLowerCase())
          )
          .sort((a, b) => {
            switch (sort) {
              case 'distance':
                return a.distance.radians - b.distance.radians;
              case 'price':
              default:
                return a.price - b.price;
            }
          })
          .map((fuel) => {
            return <FuelEntryCard key={fuel.id} fuelEntry={fuel} />;
          })}
    </div>
  );
};

export default FuelList;
