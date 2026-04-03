import turfDistance from '@turf/distance';
import axios from 'axios';
import { format, parseISO } from 'date-fns';
import { enAU } from 'date-fns/locale';
import Geo from 'geo-nearby';
import { NextResponse } from 'next/server';

import type { FuelEntry } from '../../../../../types/fuel';
import { DEFAULT_FUEL_ID, FUEL_TYPES } from '../../../../../config/fuelTypes';
import { getNswFuelNearby } from '../../../../../lib/nsw-fuel';
import { getState } from '../../../../../lib/stateDetection';

export async function GET(
  request: Request,
  context: { params: Promise<Record<string, string | string[] | undefined>> }
) {
  const params = await context.params;
  const lat = Array.isArray(params.lat) ? params.lat[0] : params.lat;
  const lng = Array.isArray(params.lng) ? params.lng[0] : params.lng;

  const url = new URL(request.url);
  const fuelId = Number.parseInt(url.searchParams.get('fuelId') || String(DEFAULT_FUEL_ID), 10);

  if (!lat || !lng) {
    return NextResponse.json([], { status: 400 });
  }

  const currentLocation = {
    lat: Number.parseFloat(lat),
    lng: Number.parseFloat(lng)
  };

  const state = getState(currentLocation.lat, currentLocation.lng);

  if (state === 'NSW') {
    const fuelType = FUEL_TYPES.find(type => type.id === fuelId);
    if (!fuelType?.nswCode) {
      return NextResponse.json([], { status: 400 });
    }

    let { stations, prices } = await getNswFuelNearby(
      currentLocation.lat,
      currentLocation.lng,
      250,
      fuelType.nswCode
    );

    // Fallback: if U91 returns very few results, also fetch E10 and merge
    if (fuelType.nswCode === 'U91') {
      const fallback = await getNswFuelNearby(
        currentLocation.lat,
        currentLocation.lng,
        250,
        'E10'
      );
      // Merge, avoiding duplicate station codes
      const existingCodes = new Set(prices.map(p => p.stationcode));
      for (const p of fallback.prices) {
        if (!existingCodes.has(p.stationcode)) {
          prices.push(p);
          existingCodes.add(p.stationcode);
        }
      }
      const existingStationCodes = new Set(stations.map(s => s.code));
      for (const s of fallback.stations) {
        if (!existingStationCodes.has(s.code)) {
          stations.push(s);
          existingStationCodes.add(s.code);
        }
      }
    }

    const stationsByCode = new Map(stations.map(station => [station.code, station]));
    const entries: FuelEntry[] = prices
      .map(price => {
        const station = stationsByCode.get(price.stationcode);
        if (!station) return null;
        const postcodeMatch = station.address.match(/(\d{4})(?!.*\d{4})/);
        const postcode = postcodeMatch ? postcodeMatch[1] : '';
        const distance = station.location.distance;

        return {
          id: station.code,
          name: station.name,
          address: station.address,
          postcode,
          distance,
          distanceString: `${distance.toFixed(2)} km`,
          price: price.price,
          brandId: Number.parseInt(station.brandid, 10) || 0,
          brandLogo: '',
          lastUpdated: price.lastupdated,
          lat: station.location.latitude,
          lng: station.location.longitude
        };
      })
      .filter((entry): entry is FuelEntry => Boolean(entry))
      .sort((a, b) => (a.distance < b.distance ? -1 : 1));

    return NextResponse.json(entries);
  }

  if (state !== 'QLD') {
    return NextResponse.json([], { status: 400 });
  }

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
