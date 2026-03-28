'use client';

import { useEffect, useMemo } from 'react';
import type { FuelEntry } from '../types/fuel';

type PriceSnapshot = {
  timestamp: number;
  cheapest: number;
  median: number;
  fuelTypeId: number;
  location: string;
};

const STORAGE_KEY = 'fuelTrends';
const MAX_SNAPSHOTS = 90; // ~3 months of daily checks

function getSnapshots(): PriceSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSnapshot(snapshot: PriceSnapshot) {
  const existing = getSnapshots();
  // Only save one snapshot per day per fuel type per location
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
      {/* Latest point dot */}
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
}

export function TrendBar({ data, fuelTypeId, locationName }: TrendBarProps) {
  const sanePrices = useMemo(
    () => data.map((e) => e.price).filter((p) => p >= 50 && p < 500).sort((a, b) => a - b),
    [data]
  );

  const cheapest = sanePrices[0];
  const median = sanePrices[Math.floor(sanePrices.length / 2)];

  // Record today's snapshot
  useEffect(() => {
    if (cheapest && median && locationName) {
      saveSnapshot({
        timestamp: Date.now(),
        cheapest,
        median,
        fuelTypeId,
        location: locationName,
      });
    }
  }, [cheapest, median, fuelTypeId, locationName]);

  // Get historical data for this fuel type + location
  const history = useMemo(() => {
    const all = getSnapshots();
    return all
      .filter((s) => s.fuelTypeId === fuelTypeId && s.location === locationName)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [fuelTypeId, locationName]);

  if (!sanePrices.length) return null;

  const cheapestValues = history.map((s) => s.cheapest);
  const prevCheapest = history.length >= 2 ? history[history.length - 2].cheapest : null;
  const trend = prevCheapest !== null ? cheapest - prevCheapest : null;

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
      {cheapestValues.length >= 2 && (
        <div className="flex items-center gap-2 text-sky-500">
          <span className="text-xs text-slate-400 dark:text-slate-500">Trend</span>
          <MiniSparkline values={cheapestValues} />
        </div>
      )}
    </div>
  );
}
