import React, { ChangeEventHandler, useCallback, useMemo, useRef } from 'react';
import { useQuery } from 'react-query';
import { useVirtual } from 'react-virtual';
import { FuelEntry } from '../pages/api/fuel/[lat]/[lng]';
import { useLocalStorageState } from '../utils';
import { FuelEntryCard } from './FuelEntry';
import { Map } from './Map';
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

const distanceFilterKeys = [
  '250km',
  '100km',
  '50km',
  '20km',
  '15km',
  '10km',
  '5km',
  '1km'
] as const;
type DistanceFilter = typeof distanceFilterKeys[number];

const FuelList = (props: Props) => {
  const currentLocation = useLocation();
  const { isLoading, data } = useQuery<FuelEntry[]>(
    ['GET_FUEL_LIST', currentLocation],
    async () => {
      if (currentLocation) {
        const res = await fetch(
          `/api/fuel/${currentLocation?.coords.latitude}/${currentLocation?.coords.longitude}`
        );
        return await res.json();
      }
      return Promise.resolve([]);
    }
  );

  const [filter, setFilter] = useLocalStorageState('filter', '');
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
    [setDistanceFilter]
  );

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    return data
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
      });
  }, [data, distanceFilter, filter, sort]);

  const theWindow = typeof window !== 'undefined' ? window : null;

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtual({
    size: filteredData.length,
    parentRef,
    overscan: 5,
    windowRef: useRef(theWindow)
  });

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
      <div>
        <Map currentLocation={currentLocation} results={filteredData} />
        <br />
        <br />
        <label>
          Filter: <input type="text" onChange={onChange} value={filter} />
        </label>
        <br />
        <label>
          Sort by:{' '}
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
          Distance less than:{' '}
          <select onChange={onChangeDistanceFilter} value={distanceFilter}>
            {distanceFilterKeys.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div ref={parentRef} style={{ width: '400px' }}>
        <div
          style={{
            height: `${rowVirtualizer.totalSize}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {rowVirtualizer.virtualItems.map((virtualRow) => (
            <div
              key={virtualRow.key}
              ref={virtualRow.measureRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <FuelEntryCard
                key={filteredData[virtualRow.index].id}
                fuelEntry={filteredData[virtualRow.index]}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FuelList;
