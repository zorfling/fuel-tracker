import React from 'react';
import { FuelEntry } from '../pages/api/fuel/[lat]/[lng]';
import styled from 'styled-components';
import Image from 'next/image';

interface Props {
  fuelEntry: FuelEntry;
}

const Card = styled.div`
  border: 1px solid #333;
  border-radius: 5px;
  box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);
  padding: 1rem;
  margin-top: 1rem;
  display: flex;
  justify-content: space-between;
`;

const Name = styled.h2`
  padding: 0;
  margin: 0;
`;
const Price = styled.h2`
  font-size: 2rem;
  padding: 0;
  margin: 0 0 1rem;
`;
const Address = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;
const PriceContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export const FuelEntryCard = (props: Props) => {
  const {
    name,
    address,
    postcode,
    distanceString,
    price,
    brandLogo,
    lastUpdated
  } = props.fuelEntry;
  return (
    <Card>
      <Address>
        <Name>{name}</Name>
        <div>
          <a
            href={`https://www.google.com.au/maps/search/${name}+${address}+${postcode}`}
            target="_blank"
            rel="noreferrer"
          >
            {address} {[postcode]}
          </a>

          <div>{distanceString}</div>
          <div>Last updated: {lastUpdated}</div>
        </div>
      </Address>
      <PriceContainer>
        <Price>{price}</Price>
        <div
          style={{
            minHeight: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Image src={brandLogo} width={100} height={100} alt="brand logo" />
        </div>
      </PriceContainer>

      {/* <dl>
        <dt>Name</dt>
        <dd>{name}</dd>
        <dt>Address</dt>
        <dd>
          <a
            href={`https://www.google.com.au/maps/search/${name}+${address}+${postcode}`}
            target="_blank"
            rel="noreferrer"
          >
            {address}
          </a>
        </dd>
        <dt>Postcode</dt>
        <dd>{postcode}</dd>
        <dt>Distance</dt>
        <dd>{distanceString}</dd>
        <dt>Price</dt>
        <dd>{price}</dd>
        <dt>Last Updated</dt>
        <dd>{lastUpdated}</dd>
      </dl> */}
    </Card>
  );
};
