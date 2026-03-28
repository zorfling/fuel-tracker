import type { Config } from '@netlify/functions';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import turfDistance from '@turf/distance';

const prisma = new PrismaClient();

const FUEL_TYPE_IDS = [2, 3, 4, 5, 8, 12, 14]; // All fuel types we care about
const DISTANCE_RADIUS_KM = 15; // Match the default search radius

export default async function handler() {
  const base = process.env.FUEL_API_BASE;
  const token = process.env.FUEL_API_TOKEN;

  if (!base || !token) {
    console.error('Missing FUEL_API_BASE or FUEL_API_TOKEN');
    return new Response('Missing config', { status: 500 });
  }

  const locations = await prisma.trackedLocation.findMany();

  if (locations.length === 0) {
    console.log('No tracked locations, skipping');
    return new Response('No locations', { status: 200 });
  }

  const countryId = 21;
  const geoRegionId = 1;
  const geoRegionLevel = 3;

  const instance = axios.create({
    baseURL: base,
    headers: { Authorization: `FPDAPI SubscriberToken=${token}` },
  });

  // Fetch all site details and prices once
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

  // Build a lookup: siteId -> { lat, lng }
  const siteCoords = new Map<number, { lat: number; lng: number }>();
  for (const site of sites) {
    siteCoords.set(site.S, { lat: site.Lat, lng: site.Lng });
  }

  let snapshotsCreated = 0;

  for (const location of locations) {
    // Find sites within radius of this location
    const nearbySiteIds = new Set<number>();
    for (const [siteId, coords] of siteCoords) {
      const distance = turfDistance(
        [location.latQ, location.lngQ],
        [coords.lat, coords.lng],
        { units: 'kilometers' }
      );
      if (distance <= DISTANCE_RADIUS_KM) {
        nearbySiteIds.add(siteId);
      }
    }

    // For each fuel type, calculate stats from nearby stations
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

  console.log(
    `Created ${snapshotsCreated} snapshots for ${locations.length} locations`
  );

  return new Response(
    JSON.stringify({ ok: true, snapshotsCreated, locations: locations.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

// Run every 6 hours
export const config: Config = {
  schedule: '0 */6 * * *',
};
