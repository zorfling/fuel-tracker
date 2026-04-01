'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';

type LocationState = {
  lat: number;
  lng: number;
  name: string;
};

type SavedLocation = {
  id: string;
  latQ: string | number;
  lngQ: string | number;
  name: string;
  _count?: {
    snapshots: number;
  };
};

type SavedLocationsProps = {
  currentLocation: LocationState | null;
  onSelectLocation: (location: LocationState) => void;
};

const formatLocation = (location: LocationState) => {
  return location.name || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
};

const toNumber = (value: string | number) => (typeof value === 'number' ? value : Number.parseFloat(value));

export function SavedLocations({ currentLocation, onSelectLocation }: SavedLocationsProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SavedLocation[]>({
    queryKey: ['savedLocations'],
    queryFn: async () => {
      const res = await fetch('/api/locations');
      if (!res.ok) throw new Error('Failed to load locations');
      return res.json();
    }
  });

  const locations = useMemo(() => data ?? [], [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentLocation) {
        throw new Error('No current location');
      }
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: currentLocation.lat,
          lng: currentLocation.lng,
          name: currentLocation.name
        })
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedLocations'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/locations?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savedLocations'] });
    }
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

  const handleSelect = (location: SavedLocation) => {
    const nextLocation: LocationState = {
      lat: toNumber(location.latQ),
      lng: toNumber(location.lngQ),
      name: location.name
    };
    onSelectLocation(nextLocation);
    const params = new URLSearchParams({
      lat: nextLocation.lat.toString(),
      lng: nextLocation.lng.toString(),
      name: nextLocation.name
    });
    router.replace(`${pathname}?${params.toString()}`);
    setOpen(false);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium text-slate-600 hover:border-slate-400 dark:text-slate-300"
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
          <path d="M7 3h10a2 2 0 0 1 2 2v16l-7-4-7 4V5a2 2 0 0 1 2-2z" />
        </svg>
        Saved
      </button>

      {open && (
        <div className="fixed inset-x-3 top-auto mt-2 sm:absolute sm:inset-x-auto sm:right-0 w-auto sm:w-80 rounded-2xl border bg-white p-3 shadow-lg dark:bg-slate-900 z-50">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-400 px-2 pb-2">
            Saved locations
          </div>
          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {isLoading && (
              <div className="rounded-2xl border border-dashed px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                Loading saved locations…
              </div>
            )}
            {!isLoading && locations.length === 0 && (
              <div className="rounded-2xl border border-dashed px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
                No saved locations yet.
              </div>
            )}
            {locations.map((location) => (
              <div
                key={location.id}
                className="rounded-2xl border bg-white px-3 py-3 text-sm shadow-sm dark:bg-slate-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {location.name || `${toNumber(location.latQ).toFixed(4)}, ${toNumber(location.lngQ).toFixed(4)}`}
                    </div>
                    <div className="text-xs text-slate-400">
                      {location._count?.snapshots ?? 0} snapshots
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-full border px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-400 dark:text-slate-300"
                      onClick={() => handleSelect(location)}
                    >
                      View
                    </button>
                    <button
                      className="rounded-full border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:border-rose-300 dark:border-rose-500/40 dark:text-rose-300"
                      onClick={() => deleteMutation.mutate(location.id)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t pt-3">
            <button
              className="w-full rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900"
              onClick={() => saveMutation.mutate()}
              disabled={!currentLocation || saveMutation.isPending}
            >
              {saveMutation.isPending
                ? 'Saving…'
                : currentLocation
                  ? `Save ${formatLocation(currentLocation)}`
                  : 'Save current location'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
