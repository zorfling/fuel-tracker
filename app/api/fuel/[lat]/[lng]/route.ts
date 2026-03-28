import turfDistance from '@turf/distance';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { enAU } from 'date-fns/locale';
import Geo from 'geo-nearby';
import { NextResponse } from 'next/server';

import type { FuelEntry } from '../../../../../types/fuel';
import { DEFAULT_FUEL_ID } from '../../../../../config/fuelTypes';

export async function GET(
  request: Request,
  context: { params: Promise<Record<string, string | string[] | undefined>> }
) {
  const params = await context.params;
  const lat = Array.isArray(params.lat) ? params.lat[0] : params.lat;
  const lng = Array.isArray(params.lng) ? params.lng[0] : params.lng;

  const url = new URL(request.url);
  const fuelId = Number.parseInt(url.searchParams.get('fuelId') || String(DEFAULT_FUEL_ID), 10);

  const countryId = 21;
  const geoRegionId = 1;
  const geoRegionLevel = 3;

  const base = process.env.FUEL_API_BASE;
  const token = process.env.FUEL_API_TOKEN;
  const priceEndpoint = `Price/GetSitesPrices?countryId=${countryId}&geoRegionLevel=${geoRegionLevel}&geoRegionId=${geoRegionId}`;
  const instance = axios.create({
    baseURL: base,
    headers: {
      Authorization: `FPDAPI SubscriberToken=${token}`
    }
  });

  const sites = (
    await instance.get(
      `Subscriber/GetFullSiteDetails?countryId=${countryId}&geoRegionLevel=${geoRegionLevel}&geoRegionId=${geoRegionId}`
    )
  ).data;

  if (!lat || !lng) {
    return NextResponse.json([], { status: 400 });
  }

  const currentLocation = {
    lat: Number.parseFloat(lat),
    lng: Number.parseFloat(lng)
  };

  const geoData = sites.S.map((site: any) => {
    return [site.Lat, site.Lng, site.S, site.N, site.A, site.P];
  });

  const siteDetails = sites.S.map((site: any) => {
    return {
      lat: site.Lat,
      lng: site.Lng,
      id: site.S,
      name: site.N,
      address: site.A,
      postcode: site.P,
      brandId: site.B
    };
  });

  const dataSet = (Geo as any).createCompactSet(geoData);
  const geo = new (Geo as any)(dataSet, {
    setOptions: { id: 'name', lat: 'lat', lon: 'lng' },
    sorted: true
  });

  const distanceRadiusKms = 500;
  const nearbySites = geo
    .nearBy(currentLocation.lat, currentLocation.lng, distanceRadiusKms * 1000)
    .map((site: any) => site.i);

  const siteprices = (await instance.get(priceEndpoint)).data.SitePrices;
  const unleadedPrices = siteprices.filter((site: any) => site.FuelId === fuelId);

  const nearbyPrices: FuelEntry[] = unleadedPrices
    .filter((price: any) => nearbySites.includes(price.SiteId))
    .map((site: any) => {
      const { id, name, address, postcode, lat, lng, brandId } =
        siteDetails.find((deet: any) => deet.id === site.SiteId);

      const distance = turfDistance(
        [currentLocation.lat, currentLocation.lng],
        [lat, lng],
        {
          units: 'kilometers'
        }
      );

      return {
        id: site.SiteId,
        name,
        address,
        postcode,
        distance: distance,
        distanceString: distance.toFixed(2) + ' km',
        price: site.Price / 10,
        brandId: brandId,
        brandLogo: '',
        lastUpdated: format(
          parseISO(site.TransactionDateUtc + '+00'),
          'yyyy-MM-dd HH:mm:ss',
          { locale: enAU }
        ),
        lat,
        lng
      };
    })
    .sort((a: any, b: any) => (a.distance < b.distance ? -1 : 1));

  return NextResponse.json(nearbyPrices);
}
