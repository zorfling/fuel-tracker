import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

function quantize(val: number): number {
  return Math.round(val * 100) / 100;
}

// GET /api/insights?lat=...&lng=...&fuelTypeId=2
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  const fuelTypeId = Number.parseInt(url.searchParams.get('fuelTypeId') || '2', 10);

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const latQ = quantize(Number.parseFloat(lat));
  const lngQ = quantize(Number.parseFloat(lng));

  const location = await prisma.trackedLocation.findUnique({
    where: { latQ_lngQ: { latQ, lngQ } },
  });

  if (!location) {
    return NextResponse.json({ tracked: false });
  }

  // Get all snapshots for this location + fuel type
  const snapshots = await prisma.priceSnapshot.findMany({
    where: {
      locationId: location.id,
      fuelTypeId,
    },
    orderBy: { timestamp: 'asc' },
  });

  if (snapshots.length === 0) {
    return NextResponse.json({ tracked: true, insufficient: true });
  }

  // Day-of-week analysis
  const dayBuckets: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const snap of snapshots) {
    const day = new Date(snap.timestamp).getDay();
    dayBuckets[day].push(snap.cheapest);
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames.map((name, i) => {
    const prices = dayBuckets[i];
    if (prices.length === 0) return { day: name, avg: null, samples: 0 };
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    return { day: name, avg: Math.round(avg * 10) / 10, samples: prices.length };
  });

  const cheapestDay = dayOfWeek
    .filter((d) => d.avg !== null && d.samples >= 2)
    .sort((a, b) => (a.avg ?? 999) - (b.avg ?? 999))[0] ?? null;

  // Overall stats
  const allCheapest = snapshots.map((s) => s.cheapest);
  const overallAvg = allCheapest.reduce((s, p) => s + p, 0) / allCheapest.length;
  const overallMin = Math.min(...allCheapest);
  const overallMax = Math.max(...allCheapest);

  // Recent trend (last 7 days vs previous 7)
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;
  const recentPrices = snapshots.filter((s) => s.timestamp.getTime() >= weekAgo).map((s) => s.cheapest);
  const prevPrices = snapshots.filter((s) => s.timestamp.getTime() >= twoWeeksAgo && s.timestamp.getTime() < weekAgo).map((s) => s.cheapest);
  
  let weekTrend: number | null = null;
  if (recentPrices.length > 0 && prevPrices.length > 0) {
    const recentAvg = recentPrices.reduce((s, p) => s + p, 0) / recentPrices.length;
    const prevAvg = prevPrices.reduce((s, p) => s + p, 0) / prevPrices.length;
    weekTrend = Math.round((recentAvg - prevAvg) * 10) / 10;
  }

  return NextResponse.json({
    tracked: true,
    insufficient: false,
    totalSnapshots: snapshots.length,
    daysSinceFirst: Math.round((now - snapshots[0].timestamp.getTime()) / (24 * 60 * 60 * 1000)),
    dayOfWeek,
    cheapestDay: cheapestDay ? { day: cheapestDay.day, avg: cheapestDay.avg } : null,
    overallAvg: Math.round(overallAvg * 10) / 10,
    overallMin,
    overallMax,
    weekTrend,
  });
}
