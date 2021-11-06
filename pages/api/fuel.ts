import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import Geo from 'geo-nearby';
import { format, parseISO } from 'date-fns';
import { enAU } from 'date-fns/locale';
import Distance from 'geo-distance';

export interface FuelEntry {
  id: number;
  name: string;
  address: string;
  postcode: string;
  distance: number;
  distanceString: string;
  price: number;
  lastUpdated: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FuelEntry[]>
) {
  const countryId = 21;
  let geoRegionId = 1;
  let geoRegionLevel = 2;

  const base = process.env.FUEL_API_BASE;
  const token = process.env.FUEL_API_TOKEN;
  const priceEndpoint = `Price/GetSitesPrices?countryId=${countryId}&geoRegionLevel=${geoRegionLevel}&geoRegionId=${geoRegionId}`;
  const instance = axios.create({
    baseURL: base,
    headers: {
      Authorization: `FPDAPI SubscriberToken=${token}`
    }
  });

  // get fuel types
  // const fuelTypes = await instance.get(
  //   `Subscriber/GetCountryFuelTypes?countryId=${countryId}`
  // );
  // console.log(fuelTypes.data);
  // unleaded is 2

  // get sites
  const sites = (
    await instance.get(
      `Subscriber/GetFullSiteDetails?countryId=${countryId}&geoRegionLevel=${geoRegionLevel}&geoRegionId=${geoRegionId}`
    )
  ).data;
  // console.log(sites.S);

  // find nearby sites

  let currentLocation = {
    lat: -27.54749,
    lon: 152.93571
  };
  // currentLocation = { lat: -26.795640, lon: 153.108276 };

  const geoData = sites.S.map((site: any) => {
    return [site.Lat, site.Lng, site.S, site.N, site.A, site.P];
  });
  // console.log(geoData);
  const siteDetails = sites.S.map((site: any) => {
    return {
      lat: site.Lat,
      lng: site.Lng,
      id: site.S,
      name: site.N,
      address: site.A,
      postcode: site.P
    };
  });
  // console.log(siteDetails);

  const dataSet = (Geo as any).createCompactSet(geoData);
  const geo = new (Geo as any)(dataSet, { sorted: true });

  const distanceRadiusKms = 10;

  const nearbySites = geo
    .nearBy(currentLocation.lat, currentLocation.lon, distanceRadiusKms * 1000)
    .map((site: any) => site.i);
  // console.log(nearbySites);

  // get prices
  const siteprices = (await instance.get(priceEndpoint)).data.SitePrices;
  // console.log(resp);

  const unleadedPrices = siteprices.filter((site: any) => site.FuelId === 2);
  // console.log(unleadedPrices);

  const nearbyPrices = unleadedPrices
    .filter((price: any) => nearbySites.includes(price.SiteId))
    .map((site: any) => {
      const { id, name, address, postcode, lat, lng } = siteDetails.find(
        (deet: any) => deet.id === site.SiteId
      );
      const distance = (Distance as any).between(currentLocation, {
        lat,
        lon: lng
      });
      return {
        id: site.SiteId,
        name,
        address,
        postcode,
        distance: distance,
        distanceString: distance.human_readable().toString(),
        price: site.Price,
        lastUpdated: format(
          parseISO(site.TransactionDateUtc + '+00'),
          'yyyy-MM-dd HH:mm:ss',
          { locale: enAU }
        )
      };
    })
    .filter((site: any) => site.name.includes('7-Eleven'))
    .sort((a: any, b: any) => (a.distance < b.distance ? -1 : 1));
  // .filter(site => site.price < 1500);*/

  res.status(200).json(nearbyPrices);
}
