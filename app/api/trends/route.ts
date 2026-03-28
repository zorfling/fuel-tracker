import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

function quantize(val: number): number {
  return Math.round(val * 100) / 100;
}

// GET /api/trends?lat=...&lng=...&fuelTypeId=2&days=30
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  const fuelTypeId = Number.parseInt(url.searchParams.get('fuelTypeId') || '2', 10);
  const days = Number.parseInt(url.searchParams.get('days') || '30', 10);

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const latQ = quantize(Number.parseFloat(lat));
  const lngQ = quantize(Number.parseFloat(lng));

  const location = await prisma.trackedLocation.findUnique({
    where: { latQ_lngQ: { latQ, lngQ } },
  });

  if (!location) {
    return NextResponse.json({ tracked: false, snapshots: [] });
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const snapshots = await prisma.priceSnapshot.findMany({
    where: {
      locationId: location.id,
      fuelTypeId,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: 'asc' },
    select: {
      cheapest: true,
      median: true,
      average: true,
      stationCount: true,
      timestamp: true,
    },
  });

  return NextResponse.json({
    tracked: true,
    locationId: location.id,
    name: location.name,
    snapshots,
  });
}
