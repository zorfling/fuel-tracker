'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FuelEntry } from '../types/fuel';

type PriceSnapshot = {
  timestamp: number;
  cheapest: number;
  median: number;
  fuelTypeId: number;
  location: string;
};

type DbSnapshot = {
  cheapest: number;
  median: number;
  average: number;
  stationCount: number;
  timestamp: string;
};

type TrendsResponse = {
  tracked: boolean;
  locationId?: string;
  name?: string;
  snapshots: DbSnapshot[];
};

const STORAGE_KEY = 'fuelTrends';
const MAX_SNAPSHOTS = 90;

function getLocalSnapshots(): PriceSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalSnapshot(snapshot: PriceSnapshot) {
  const existing = getLocalSnapshots();
  const today = new Date(snapshot.timestamp).toDateString();
  const isDuplicate = existing.some(
    (s) =>
      new Date(s.timestamp).toDateString() === today &&
      s.fuelTypeId === snapshot.fuelTypeId &&
      s.location === snapshot.location
  );
  if (isDuplicate) return;
  const updated = [...existing, snapshot].slice(-MAX_SNAPSHOTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

function MiniSparkline({ values, width = 120, height = 32 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const points = values
    .map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={(values.length - 1) * step}
        cy={height - ((values[values.length - 1] - min) / range) * (height - 4) - 2}
        r="2.5"
        fill="currentColor"
      />
    </svg>
  );
}

interface TrendBarProps {
  data: FuelEntry[];
  fuelTypeId: number;
  locationName: string;
  lat: number;
  lng: number;
}

export function TrendBar({ data, fuelTypeId, locationName, lat, lng }: TrendBarProps) {
  const [isTracking, setIsTracking] = useState(false);

  const sanePrices = useMemo(
    () => data.map((e) => e.price).filter((p) => p >= 50 && p < 500).sort((a, b) => a - b),
    [data]
  );

  const cheapest = sanePrices[0];
  const median = sanePrices[Math.floor(sanePrices.length / 2)];

  // Fetch DB trends
  const { data: trendsData, refetch: refetchTrends } = useQuery<TrendsResponse>({
    queryKey: ['trends', lat, lng, fuelTypeId],
    queryFn: async () => {
      const res = await fetch(`/api/trends?lat=${lat}&lng=${lng}&fuelTypeId=${fuelTypeId}&days=90`);
      return res.json();
    },
    enabled: Boolean(lat && lng),
    staleTime: 5 * 60 * 1000,
  });

  const isDbTracked = trendsData?.tracked ?? false;
  const dbSnapshots = trendsData?.snapshots ?? [];

  // Save to localStorage as fallback
  useEffect(() => {
    if (cheapest && median && locationName) {
      saveLocalSnapshot({
        timestamp: Date.now(),
        cheapest,
        median,
        fuelTypeId,
        location: locationName,
      });
    }
  }, [cheapest, median, fuelTypeId, locationName]);

  // Get local history for fallback
  const localHistory = useMemo(() => {
    const all = getLocalSnapshots();
    return all
      .filter((s) => s.fuelTypeId === fuelTypeId && s.location === locationName)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [fuelTypeId, locationName]);

  // Use DB snapshots if tracked, otherwise localStorage
  const chartValues = isDbTracked && dbSnapshots.length > 0
    ? dbSnapshots.map((s) => s.cheapest)
    : localHistory.map((s) => s.cheapest);

  const prevCheapest = chartValues.length >= 2 ? chartValues[chartValues.length - 2] : null;
  const trend = prevCheapest !== null && cheapest ? cheapest - prevCheapest : null;

  const handleTrack = async () => {
    setIsTracking(true);
    try {
      await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, name: locationName }),
      });
      await refetchTrends();
    } finally {
      setIsTracking(false);
    }
  };

  const handleUntrack = async () => {
    if (!trendsData?.locationId) return;
    setIsTracking(true);
    try {
      await fetch(`/api/locations?id=${trendsData.locationId}`, { method: 'DELETE' });
      await refetchTrends();
    } finally {
      setIsTracking(false);
    }
  };

  if (!sanePrices.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-white/80 px-4 py-3 text-sm backdrop-blur dark:bg-slate-900/80">
      <div className="flex items-center gap-2">
        <span className="text-slate-500 dark:text-slate-400">Cheapest</span>
        <span className="text-lg font-bold text-slate-900 dark:text-white">{cheapest.toFixed(1)}¢</span>
        {trend !== null && (
          <span className={`text-xs font-medium ${trend > 0 ? 'text-rose-500' : trend < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
            {trend > 0 ? '▲' : trend < 0 ? '▼' : '–'} {Math.abs(trend).toFixed(1)}¢
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-500 dark:text-slate-400">Median</span>
        <span className="font-semibold text-slate-700 dark:text-slate-200">{median.toFixed(1)}¢</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-500 dark:text-slate-400">Spread</span>
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {(sanePrices[sanePrices.length - 1] - sanePrices[0]).toFixed(1)}¢
        </span>
      </div>
      {chartValues.length >= 2 && (
        <div className="flex items-center gap-2 text-sky-500">
          <span className="text-xs text-slate-400 dark:text-slate-500">Trend</span>
          <MiniSparkline values={chartValues} />
        </div>
      )}
      <div className="ml-auto">
        {isDbTracked ? (
          <button
            className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
            onClick={handleUntrack}
            disabled={isTracking}
          >
            ✓ Tracking
          </button>
        ) : (
          <button
            className="rounded-full border px-3 py-1 text-xs font-medium text-slate-500 hover:border-sky-400 hover:text-sky-600 dark:text-slate-400"
            onClick={handleTrack}
            disabled={isTracking}
          >
            {isTracking ? 'Saving…' : '📍 Track history'}
          </button>
        )}
      </div>
    </div>
  );
}
