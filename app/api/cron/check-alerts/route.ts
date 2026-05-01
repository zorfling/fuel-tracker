import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

const FUEL_TYPE_NAMES: Record<number, string> = {
  2: 'Unleaded 91',
  3: 'Diesel',
  4: 'LPG',
  5: 'Premium 95',
  8: 'Premium 98',
  12: 'E10',
  14: 'Premium Diesel',
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const alerts = await prisma.priceAlert.findMany({
    where: { enabled: true },
    include: {
      location: { select: { name: true, latQ: true, lngQ: true } },
    },
  });

  if (alerts.length === 0) {
    return NextResponse.json([]);
  }

  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const now = new Date();
  const triggered: Array<{
    alertId: string;
    locationName: string;
    fuelTypeName: string;
    threshold: number;
    currentPrice: number;
    stationName?: string;
    stationAddress?: string;
    lat?: number;
    lng?: number;
  }> = [];

  for (const alert of alerts) {
    const snapshot = await prisma.priceSnapshot.findFirst({
      where: {
        locationId: alert.locationId,
        fuelTypeId: alert.fuelTypeId,
      },
      orderBy: { timestamp: 'desc' },
      select: { cheapest: true },
    });

    if (!snapshot) continue;

    const shouldTrigger =
      snapshot.cheapest <= alert.threshold &&
      (!alert.lastTriggered || alert.lastTriggered < threeHoursAgo);

    if (!shouldTrigger) continue;

    // Find the cheapest station from the live API
    let stationName: string | undefined;
    let stationAddress: string | undefined;
    let stationLat: number | undefined;
    let stationLng: number | undefined;

    try {
      const siteUrl = process.env.URL || process.env.SITE_URL || 'https://zorfling-fuel-tracker.netlify.app';
      const fuelRes = await fetch(
        `${siteUrl}/api/fuel/${alert.location.latQ}/${alert.location.lngQ}?fuelId=${alert.fuelTypeId}`
      );
      if (fuelRes.ok) {
        const stations = await fuelRes.json();
        if (Array.isArray(stations) && stations.length > 0) {
          // Stations are sorted by price — first one is cheapest
          const cheapest = stations[0];
          stationName = cheapest.name;
          stationAddress = cheapest.address;
          stationLat = cheapest.lat;
          stationLng = cheapest.lng;
        }
      }
    } catch {
      // Non-critical — alert still works without station info
    }

    await prisma.priceAlert.update({
      where: { id: alert.id },
      data: {
        lastTriggered: now,
        threshold: snapshot.cheapest - 0.1,  // Set 0.1¢ below current — only trigger if it drops further
      },
    });

    triggered.push({
      alertId: alert.id,
      locationName: alert.location.name,
      fuelTypeName: FUEL_TYPE_NAMES[alert.fuelTypeId] ?? `Fuel ${alert.fuelTypeId}`,
      threshold: alert.threshold,
      currentPrice: snapshot.cheapest,
      stationName,
      stationAddress,
      lat: stationLat,
      lng: stationLng,
    });
  }

  // Send Telegram notification if any alerts triggered
  if (triggered.length > 0) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (botToken && chatId) {
      const lines = triggered.map((t) => {
        let line = `⛽ ${t.fuelTypeName} at ${t.locationName} dropped to ${t.currentPrice.toFixed(1)}¢ (was ${t.threshold}¢)`;
        if (t.stationName) {
          line += `\n   📍 ${t.stationName}`;
          if (t.stationAddress) line += ` — ${t.stationAddress}`;
          if (t.lat && t.lng) {
            line += `\n   🗺️ https://www.google.com/maps/search/?api=1&query=${t.lat},${t.lng}`;
          }
        }
        return line;
      });
      const message = `🔔 Fuel Price Alert!\n\n${lines.join('\n')}`;
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message }),
        });
      } catch (err) {
        console.error('Failed to send Telegram notification:', err);
      }
    }
  }

  return NextResponse.json(triggered);
}
