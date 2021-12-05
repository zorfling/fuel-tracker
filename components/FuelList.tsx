import React, {
  ChangeEventHandler,
  useCallback,
  useMemo,
  useState
} from 'react';
import { useQuery } from 'react-query';
import { FuelEntry } from '../pages/api/fuel/[lat]/[lng]';
import { useLocalStorageState } from '../utils';
import { FuelEntryCard } from './FuelEntry';
import { useLocation } from './useLocation';

interface Props {}

const Location = ({
  currentLocation
}: {
  currentLocation: GeolocationPosition | null;
}) =>
  !currentLocation ? (
    <></>
  ) : (
    <div>
      Your location is:{' '}
      <a
        href={`https://www.google.com.au/maps/search/${currentLocation?.coords.latitude},${currentLocation?.coords.longitude}`}
        target="_blank"
        rel="noreferrer"
      >
        {currentLocation?.coords.latitude}, {currentLocation?.coords.longitude}
      </a>
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

  const [filter, setFilter] = useLocalStorageState('filter', '7-Eleven');
  const onChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
    (evt) => {
      setFilter(evt.target.value);
    },
    [setFilter]
  );

  type SortField = 'price' | 'distance';
  const [sort, setSort] = useLocalStorageState<SortField>('sort', 'price');
  const onChangeSort = useCallback<ChangeEventHandler<HTMLSelectElement>>(
    (evt) => {
      const isSortField = (field: string): field is SortField =>
        field === 'distance' || field === 'price';
      const field = evt.target.value;
      if (isSortField(field)) {
        setSort(field);
      }
    },
    [setSort]
  );

  type DistanceFilter = '20km' | '15km' | '10km' | '5km' | '1km';
  const distanceFilterKeys = useMemo<DistanceFilter[]>(
    () => ['20km', '15km', '10km', '5km', '1km'],
    []
  );
  const [distanceFilter, setDistanceFilter] =
    useLocalStorageState<DistanceFilter>('distanceFilter', '10km');
  const onChangeDistanceFilter = useCallback<
    ChangeEventHandler<HTMLSelectElement>
  >(
    (evt) => {
      const isDistanceFilter = (field: string): field is DistanceFilter =>
        distanceFilterKeys.includes(field as DistanceFilter);
      const field = evt.target.value;
      if (isDistanceFilter(field)) {
        setDistanceFilter(field);
      }
    },
    [distanceFilterKeys, setDistanceFilter]
  );

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
      <br />
      <label>
        Distance less than ({distanceFilter}):{' '}
        <select onChange={onChangeDistanceFilter} value={distanceFilter}>
          {distanceFilterKeys.map((option) => (
            <option key={option} value={option}>
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
          .filter(
            (entry) =>
              entry.distance <= Number.parseFloat(distanceFilter.split('km')[0])
          )
          .sort((a, b) => {
            switch (sort) {
              case 'distance':
                return a.distance - b.distance;
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
