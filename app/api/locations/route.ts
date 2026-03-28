import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

function quantize(val: number): number {
  return Math.round(val * 100) / 100;
}

// GET /api/locations — list all tracked locations
export async function GET() {
  const locations = await prisma.trackedLocation.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { snapshots: true } },
    },
  });
  return NextResponse.json(locations);
}

// POST /api/locations — add a tracked location
export async function POST(request: Request) {
  const body = await request.json();
  const { lat, lng, name } = body;

  if (!lat || !lng || !name) {
    return NextResponse.json({ error: 'lat, lng, and name are required' }, { status: 400 });
  }

  const latQ = quantize(lat);
  const lngQ = quantize(lng);

  const location = await prisma.trackedLocation.upsert({
    where: { latQ_lngQ: { latQ, lngQ } },
    update: { name },
    create: { latQ, lngQ, name },
  });

  return NextResponse.json(location);
}

// DELETE /api/locations?id=xxx — remove a tracked location
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  await prisma.trackedLocation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
