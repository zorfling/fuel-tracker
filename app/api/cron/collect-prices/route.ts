import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import turfDistance from '@turf/distance';

export const dynamic = 'force-dynamic';

const FUEL_TYPE_IDS = [2, 3, 4, 5, 8, 12, 14];
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

    const sites = sitesRes.data.S;
    const allPrices = pricesRes.data.SitePrices;

    const siteCoords = new Map<number, { lat: number; lng: number }>();
    for (const site of sites) {
      siteCoords.set(site.S, { lat: site.Lat, lng: site.Lng });
    }

    let snapshotsCreated = 0;

    for (const location of locations) {
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

      for (const fuelTypeId of FUEL_TYPE_IDS) {
        const prices = allPrices
          .filter(
            (p: any) => p.FuelId === fuelTypeId && nearbySiteIds.has(p.SiteId)
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
            fuelTypeId,
            cheapest,
            median,
            average: Math.round(average * 10) / 10,
            stationCount: prices.length,
          },
        });

        snapshotsCreated++;
      }
    }

    return NextResponse.json({ ok: true, snapshotsCreated, locations: locations.length });
  } finally {
    await prisma.$disconnect();
  }
}
