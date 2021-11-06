import React from 'react';
import { useQuery } from 'react-query';
import { FuelEntry } from '../pages/api/fuel';
import { FuelEntryCard } from './FuelEntry';

interface Props {}

const FuelList = (props: Props) => {
  const { isLoading, isSuccess, error, data } = useQuery<FuelEntry[]>(
    'GET_FUEL_LIST',
    () => {
      return fetch('/api/fuel').then((res) => res.json());
    }
  );
  console.log(data);
  return (
    <div>
      Fuel List
      {isSuccess &&
        (data ?? []).length > 0 &&
        (data ?? [])
          .sort((a, b) => a.price - b.price)
          .map((fuel: any) => {
            return <FuelEntryCard key={fuel.id} fuelEntry={fuel} />;
          })}
    </div>
  );
};

export default FuelList;
