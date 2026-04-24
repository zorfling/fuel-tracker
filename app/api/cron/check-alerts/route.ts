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
      location: { select: { name: true } },
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

    await prisma.priceAlert.update({
      where: { id: alert.id },
      data: {
        lastTriggered: now,
        threshold: snapshot.cheapest,  // Reset to current price — only trigger again if it drops further
      },
    });

    triggered.push({
      alertId: alert.id,
      locationName: alert.location.name,
      fuelTypeName: FUEL_TYPE_NAMES[alert.fuelTypeId] ?? `Fuel ${alert.fuelTypeId}`,
      threshold: alert.threshold,
      currentPrice: snapshot.cheapest,
    });
  }

  // Send Telegram notification if any alerts triggered
  if (triggered.length > 0) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (botToken && chatId) {
      const lines = triggered.map(
        (t) => `⛽ ${t.fuelTypeName} at ${t.locationName} dropped to ${t.currentPrice.toFixed(1)}¢ (was ${t.threshold}¢). Alert reset to ${t.currentPrice.toFixed(1)}¢`
      );
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
