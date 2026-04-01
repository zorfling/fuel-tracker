'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FUEL_TYPES, DEFAULT_FUEL_ID, type FuelTypeId } from '../config/fuelTypes';

type Alert = {
  id: string;
  locationId: string;
  fuelTypeId: number;
  threshold: number;
  enabled: boolean;
  lastTriggered?: string | null;
  location: {
    name: string;
  };
  currentPrice: number | null;
};

type SavedLocation = {
  id: string;
  name: string;
};

const fuelTypeLabel = (fuelTypeId: number) => {
  return FUEL_TYPES.find((ft) => ft.id === fuelTypeId)?.name ?? `Fuel ${fuelTypeId}`;
};

export function PriceAlerts() {
  const [open, setOpen] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [fuelTypeId, setFuelTypeId] = useState<FuelTypeId>(DEFAULT_FUEL_ID);
  const [threshold, setThreshold] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: alerts, isLoading } = useQuery<Alert[]>({
    queryKey: ['priceAlerts'],
    queryFn: async () => {
      const res = await fetch('/api/alerts');
      if (!res.ok) throw new Error('Failed to load alerts');
      return res.json();
    },
  });

  const { data: locations } = useQuery<SavedLocation[]>({
    queryKey: ['savedLocations'],
    queryFn: async () => {
      const res = await fetch('/api/locations');
      if (!res.ok) throw new Error('Failed to load locations');
      return res.json();
    },
  });

  const alertList = useMemo(() => alerts ?? [], [alerts]);
  const locationList = useMemo(() => locations ?? [], [locations]);
  const activeCount = useMemo(() => alertList.filter((alert) => alert.enabled).length, [alertList]);

  // Show badge only when an alert was recently triggered (last 6 hours)
  const recentlyTriggered = useMemo(() => {
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    return alertList.filter(
      (alert) =>
        alert.enabled &&
        alert.lastTriggered &&
        new Date(alert.lastTriggered).getTime() > sixHoursAgo &&
        alert.currentPrice != null &&
        alert.currentPrice <= alert.threshold
    ).length;
  }, [alertList]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const parsedThreshold = Number(threshold);
      if (!locationId || !Number.isFinite(parsedThreshold) || parsedThreshold <= 0) {
        throw new Error('Invalid alert');
      }
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          fuelTypeId,
          threshold: parsedThreshold,
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to create alert');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceAlerts'] });
      setThreshold('');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      });
      if (!res.ok) throw new Error('Failed to update alert');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceAlerts'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/alerts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete alert');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['priceAlerts'] });
    },
  });

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!locationId && locationList.length > 0) {
      setLocationId(locationList[0].id);
    }
  }, [locationId, locationList]);

  const isFormValid = locationId && Number.isFinite(Number(threshold)) && Number(threshold) > 0;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        className="relative flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium text-slate-600 hover:border-slate-400 dark:text-slate-300"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        Alerts
        {recentlyTriggered > 0 && (
          <span className="absolute -top-1 -right-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
            {recentlyTriggered}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-auto mt-2 sm:absolute sm:inset-x-auto sm:right-0 w-auto sm:w-96 rounded-2xl border bg-white p-3 shadow-lg dark:bg-slate-900 z-50">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 px-2 pb-2">
            Price alerts
          </div>
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {isLoading && (
              <div className="rounded-2xl border border-dashed px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                Loading alerts…
              </div>
            )}
            {!isLoading && alertList.length === 0 && (
              <div className="rounded-2xl border border-dashed px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                No alerts yet. Add one below.
              </div>
            )}
            {alertList.map((alert) => {
              const isBelow = alert.currentPrice !== null && alert.currentPrice <= alert.threshold;
              return (
                <div
                  key={alert.id}
                  className="rounded-2xl border bg-white px-3 py-3 text-sm shadow-sm dark:bg-slate-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">
                        {alert.location.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {fuelTypeLabel(alert.fuelTypeId)}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Threshold {alert.threshold.toFixed(1)}¢</span>
                        <span className={`font-semibold ${
                          alert.currentPrice === null
                            ? 'text-slate-400'
                            : isBelow
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {alert.currentPrice === null ? 'No data' : `Now ${alert.currentPrice.toFixed(1)}¢`}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        className={`rounded-full border px-2 py-1 text-xs font-medium transition ${
                          alert.enabled
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-white text-slate-500 hover:border-slate-400 dark:bg-slate-900 dark:text-slate-400'
                        }`}
                        onClick={() => toggleMutation.mutate({ id: alert.id, enabled: !alert.enabled })}
                        disabled={toggleMutation.isPending}
                      >
                        {alert.enabled ? 'Enabled' : 'Paused'}
                      </button>
                      <button
                        className="rounded-full border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:border-rose-300 dark:border-rose-500/40 dark:text-rose-300"
                        onClick={() => deleteMutation.mutate(alert.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 border-t pt-3 space-y-2">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400 px-2">
              Add alert
            </div>
            <div className="rounded-2xl border bg-white px-3 py-3 text-sm shadow-sm dark:bg-slate-950 space-y-2">
              <select
                className="w-full rounded-2xl border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
              >
                {locationList.length === 0 && (
                  <option value="">No saved locations</option>
                )}
                {locationList.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 rounded-2xl border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                  value={fuelTypeId}
                  onChange={(event) => setFuelTypeId(Number.parseInt(event.target.value, 10) as FuelTypeId)}
                >
                  {FUEL_TYPES.map((ft) => (
                    <option key={ft.id} value={ft.id}>
                      {ft.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 dark:bg-slate-900">
                  <input
                    className="w-20 bg-transparent text-sm outline-none"
                    type="number"
                    inputMode="decimal"
                    placeholder="165"
                    value={threshold}
                    onChange={(event) => setThreshold(event.target.value)}
                  />
                  <span className="text-xs text-slate-400">¢/L</span>
                </div>
              </div>
              <button
                className="w-full rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900"
                onClick={() => createMutation.mutate()}
                disabled={!isFormValid || createMutation.isPending}
              >
                {createMutation.isPending ? 'Saving…' : 'Create alert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
