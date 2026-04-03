import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import turfDistance from '@turf/distance';

import { FUEL_TYPES } from '../../../../config/fuelTypes';
import { getNswFuelNearby } from '../../../../lib/nsw-fuel';
import { getState } from '../../../../lib/stateDetection';

export const dynamic = 'force-dynamic';

const DISTANCE_RADIUS_KM = 15;

export async function GET(request: Request) {
  // Simple auth via query param or header
  const url = new URL(request.url);
  const key = url.searchParams.get('key') || request.headers.get('x-cron-key');
  if (key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = process.env.FUEL_API_BASE;
  const token = process.env.FUEL_API_TOKEN;

  if (!base || !token) {
    return NextResponse.json({ error: 'Missing FUEL_API_BASE or FUEL_API_TOKEN' }, { status: 500 });
  }

  const prisma = new PrismaClient();

  try {
    const locations = await prisma.trackedLocation.findMany();

    if (locations.length === 0) {
      return NextResponse.json({ ok: true, message: 'No locations' });
    }

    const qldLocations = locations.filter(
      location => getState(location.latQ, location.lngQ) === 'QLD'
    );

    let sites: any[] = [];
    let allPrices: any[] = [];
    const siteCoords = new Map<number, { lat: number; lng: number }>();

    if (qldLocations.length > 0) {
      const countryId = 21;
      const geoRegionId = 1;
      const geoRegionLevel = 3;

      const instance = axios.create({
        baseURL: base,
        headers: { Authorization: `FPDAPI SubscriberToken=${token}` },
      });

      const [sitesRes, pricesRes] = await Promise.all([
        instance.get(
          `Subscriber/GetFullSiteDetails?countryId=${countryId}&geoRegionLevel=${geoRegionLevel}&geoRegionId=${geoRegionId}`
        ),
        instance.get(
          `Price/GetSitesPrices?countryId=${countryId}&geoRegionLevel=${geoRegionLevel}&geoRegionId=${geoRegionId}`
        ),
      ]);

      sites = sitesRes.data.S;
      allPrices = pricesRes.data.SitePrices;

      for (const site of sites) {
        siteCoords.set(site.S, { lat: site.Lat, lng: site.Lng });
      }
    }

    let snapshotsCreated = 0;

    for (const location of locations) {
      const state = getState(location.latQ, location.lngQ);

      if (state === 'QLD') {
        const nearbySiteIds = new Set<number>();
        for (const [siteId, coords] of Array.from(siteCoords.entries())) {
          const distance = turfDistance(
            [location.latQ, location.lngQ],
            [coords.lat, coords.lng],
            { units: 'kilometers' }
          );
          if (distance <= DISTANCE_RADIUS_KM) {
            nearbySiteIds.add(siteId);
          }
        }

        for (const fuelType of FUEL_TYPES) {
          const prices = allPrices
            .filter(
              (p: any) => p.FuelId === fuelType.id && nearbySiteIds.has(p.SiteId)
            )
            .map((p: any) => p.Price / 10)
            .filter((p: number) => p >= 50 && p < 500)
            .sort((a: number, b: number) => a - b);

          if (prices.length === 0) continue;

          const cheapest = prices[0];
          const median = prices[Math.floor(prices.length / 2)];
          const average =
            prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;

          await prisma.priceSnapshot.create({
            data: {
              locationId: location.id,
              fuelTypeId: fuelType.id,
              cheapest,
              median,
              average: Math.round(average * 10) / 10,
              stationCount: prices.length,
            },
          });

          snapshotsCreated++;
        }
      } else if (state === 'NSW') {
        for (const fuelType of FUEL_TYPES) {
          if (!fuelType.nswCode) continue;

          const { prices } = await getNswFuelNearby(
            location.latQ,
            location.lngQ,
            DISTANCE_RADIUS_KM,
            fuelType.nswCode
          );

          const priceValues = prices
            .map(price => price.price)
            .filter(price => price >= 50 && price < 500)
            .sort((a, b) => a - b);

          if (priceValues.length === 0) continue;

          const cheapest = priceValues[0];
          const median = priceValues[Math.floor(priceValues.length / 2)];
          const average =
            priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length;

          await prisma.priceSnapshot.create({
            data: {
              locationId: location.id,
              fuelTypeId: fuelType.id,
              cheapest,
              median,
              average: Math.round(average * 10) / 10,
              stationCount: priceValues.length,
            },
          });

          snapshotsCreated++;
        }
      }
    }

    return NextResponse.json({ ok: true, snapshotsCreated, locations: locations.length });
  } finally {
    await prisma.$disconnect();
  }
}
