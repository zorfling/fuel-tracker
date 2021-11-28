import React from 'react';
import { FuelEntry } from '../pages/api/fuel/[lat]/[lng]';

interface Props {
  fuelEntry: FuelEntry;
}
//oops

export const FuelEntryCard = (props: Props) => {
  const {
    name,
    address,
    postcode,
    distance,
    distanceString,
    price,
    lastUpdated
  } = props.fuelEntry;
  return (
    <div>
      <h1>Fuel Entry</h1>
      <dl>
        <dt>Name</dt>
        <dd>{name}</dd>
        <dt>Address</dt>
        <dd>{address}</dd>
        <dt>Postcode</dt>
        <dd>{postcode}</dd>
        <dt>Distance</dt>
        <dd>{distanceString}</dd>
        <dt>Price</dt>
        <dd>{price}</dd>
        <dt>Last Updated</dt>
        <dd>{lastUpdated}</dd>
      </dl>
    </div>
  );
};
