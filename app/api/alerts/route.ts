import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

// GET /api/alerts — list all alerts with location name
export async function GET() {
  const alerts = await prisma.priceAlert.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      location: { select: { name: true } },
    },
  });

  const alertsWithPrice = await Promise.all(
    alerts.map(async (alert) => {
      const snapshot = await prisma.priceSnapshot.findFirst({
        where: {
          locationId: alert.locationId,
          fuelTypeId: alert.fuelTypeId,
        },
        orderBy: { timestamp: 'desc' },
        select: { cheapest: true },
      });

      return {
        ...alert,
        currentPrice: snapshot?.cheapest ?? null,
      };
    })
  );

  return NextResponse.json(alertsWithPrice);
}

// POST /api/alerts — create an alert
export async function POST(request: Request) {
  const body = await request.json();
  const { locationId, fuelTypeId, threshold } = body;

  const parsedThreshold = Number(threshold);
  const parsedFuelTypeId = Number(fuelTypeId);

  if (!locationId || !Number.isFinite(parsedFuelTypeId)) {
    return NextResponse.json({ error: 'locationId and fuelTypeId are required' }, { status: 400 });
  }

  if (!Number.isFinite(parsedThreshold) || parsedThreshold <= 0) {
    return NextResponse.json({ error: 'threshold must be > 0' }, { status: 400 });
  }

  const alert = await prisma.priceAlert.create({
    data: {
      locationId,
      fuelTypeId: parsedFuelTypeId,
      threshold: parsedThreshold,
    },
  });

  return NextResponse.json(alert);
}

// PATCH /api/alerts — toggle enabled
export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, enabled } = body;

  if (!id || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'id and enabled are required' }, { status: 400 });
  }

  const alert = await prisma.priceAlert.update({
    where: { id },
    data: { enabled },
  });

  return NextResponse.json(alert);
}

// DELETE /api/alerts?id=xxx — delete an alert
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  await prisma.priceAlert.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
