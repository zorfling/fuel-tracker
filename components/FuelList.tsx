'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { ChangeEventHandler, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { FuelEntry } from '../types/fuel';
import { useLocalStorageState } from '../utils';
import { FuelEntryCard } from './FuelEntry';
import { Map } from './Map';
import { FUEL_TYPES, DEFAULT_FUEL_ID } from '../config/fuelTypes';
import type { FuelTypeId } from '../config/fuelTypes';
import { TrendBar } from './TrendBar';
const distanceFilterKeys = [
  '250km',
  '100km',
  '50km',
  '20km',
  '15km',
  '10km',
  '5km',
  '1km'
] as const;

type DistanceFilter = (typeof distanceFilterKeys)[number];
type SortField = 'price' | 'distance';

type LocationState = {
  lat: number;
  lng: number;
  name: string;
};

const formatLocationName = (location: LocationState | null) => {
  if (!location) return 'Finding your location…';
  return location.name || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
};

const buildShareUrl = (origin: string, pathname: string, location: LocationState) => {
  const params = new URLSearchParams({
    lat: location.lat.toString(),
    lng: location.lng.toString(),
    name: location.name
  });
  return `${origin}${pathname}?${params.toString()}`;
};

const geocodeWithGoogle = async (query: string, apiKey: string) => {
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`
  );
  const data = await response.json();
  if (!data.results || data.results.length === 0) {
    throw new Error('No results found');
  }
  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    name: result.formatted_address
  };
};

function shortLocationName(result: { display_name: string; address?: Record<string, string> }): string {
  const addr = result.address;
  if (addr) {
    const place = addr.suburb || addr.town || addr.city || addr.village || addr.hamlet || addr.county || '';
    if (place) return place;
  }
  // Fallback: take first two comma-separated parts
  const parts = result.display_name.split(',').map(s => s.trim());
  return parts.slice(0, 2).join(', ');
}

const geocodeWithNominatim = async (query: string) => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`
  );
  const data = await response.json();
  if (!data || data.length === 0) {
    throw new Error('No results found');
  }
  return {
    lat: Number.parseFloat(data[0].lat),
    lng: Number.parseFloat(data[0].lon),
    name: shortLocationName(data[0])
  };
};

const FuelList = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [location, setLocation] = useState<LocationState | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  const [filter, setFilter] = useLocalStorageState('filter', '');
  const [sort, setSort] = useLocalStorageState<SortField>('sort', 'price');
  const [distanceFilter, setDistanceFilter] = useLocalStorageState<DistanceFilter>(
    'distanceFilter',
    '10km'
  );
  const [sevenElevenOnly, setSevenElevenOnly] = useLocalStorageState('sevenElevenOnly', false);
  const [priceLockInput, setPriceLockInput] = useLocalStorageState('priceLock', '');
  const priceLock = priceLockInput ? Number.parseFloat(priceLockInput) : null;
  const [fuelTypeId, setFuelTypeId] = useLocalStorageState<FuelTypeId>('fuelType', DEFAULT_FUEL_ID);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setShowMap(true);
    }
  }, []);

  useEffect(() => {
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const nameParam = searchParams.get('name');

    if (latParam && lngParam) {
      const parsedLat = Number.parseFloat(latParam);
      const parsedLng = Number.parseFloat(lngParam);
      if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
        setLocation({
          lat: parsedLat,
          lng: parsedLng,
          name: nameParam ? decodeURIComponent(nameParam) : ''
        });
        return;
      }
    }

    if (!navigator.geolocation) {
      setLocationError('Geolocation not available');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        let name = '';
        try {
          // Use Nominatim (free, no API key needed, works from browser)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14`,
            { headers: { 'Accept': 'application/json' } }
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address;
            name = addr?.suburb || addr?.town || addr?.city || addr?.village || '';
            if (name && addr?.state) {
              name = `${name}, ${addr.state}`;
            }
          }
        } catch {
          // Reverse geocode failed — that's fine, just show coords
        }
        setLocation({ lat: latitude, lng: longitude, name: name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });
      },
      (error) => {
        setLocationError(error.message || 'Location permission denied');
      }
    );
  }, [searchParams]);

  const { isLoading, data } = useQuery<FuelEntry[]>({
    queryKey: ['GET_FUEL_LIST', location?.lat, location?.lng, fuelTypeId],
    queryFn: async () => {
      if (!location) {
        return [];
      }
      const res = await fetch(`/api/fuel/${location.lat}/${location.lng}?fuelId=${fuelTypeId}`);
      return res.json();
    },
    enabled: Boolean(location)
  });

  const onChangeFilter = useCallback<ChangeEventHandler<HTMLInputElement>>(
    (evt) => {
      setFilter(evt.target.value);
    },
    [setFilter]
  );

  const onChangeSort = useCallback<ChangeEventHandler<HTMLSelectElement>>(
    (evt) => {
      const field = evt.target.value as SortField;
      if (field === 'distance' || field === 'price') {
        setSort(field);
      }
    },
    [setSort]
  );

  const onChangeDistanceFilter = useCallback<ChangeEventHandler<HTMLSelectElement>>(
    (evt) => {
      const field = evt.target.value as DistanceFilter;
      if (distanceFilterKeys.includes(field)) {
        setDistanceFilter(field);
      }
    },
    [setDistanceFilter]
  );

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    return data
      .filter((entry) => entry.name.toLowerCase().includes(filter.toLowerCase()))
      .filter((entry) => !sevenElevenOnly || entry.brandId === 113)
      .filter(
        (entry) => entry.distance <= Number.parseFloat(distanceFilter.split('km')[0])
      )
      .sort((a, b) => {
        switch (sort) {
          case 'distance':
            return a.distance - b.distance;
          case 'price':
          default: {
            // When price lock is active, sort by effective price for 7-Eleven
            const aPrice = (priceLock && sevenElevenOnly && a.brandId === 113)
              ? Math.max(Math.min(priceLock, a.price), a.price - 25)
              : a.price;
            const bPrice = (priceLock && sevenElevenOnly && b.brandId === 113)
              ? Math.max(Math.min(priceLock, b.price), b.price - 25)
              : b.price;
            return aPrice - bPrice;
          }
        }
      });
  }, [data, distanceFilter, filter, priceLock, sevenElevenOnly, sort]);

  const priceTierFor = useCallback(
    (price: number) => {
      if (!filteredData.length) return 'mid' as const;
      // Filter out outliers for color calc: ignore prices below 50c or above 500c
      const sane = filteredData
        .map((entry) => entry.price)
        .filter((p) => p >= 50 && p < 500);
      if (!sane.length) return 'mid' as const;
      const min = Math.min(...sane);
      const max = Math.max(...sane);
      const range = max - min || 1;
      const cheapThreshold = min + range / 3;
      const midThreshold = min + (2 * range) / 3;
      if (price <= cheapThreshold) return 'cheap' as const;
      if (price <= midThreshold) return 'mid' as const;
      return 'expensive' as const;
    },
    [filteredData]
  );

  const getEffectivePrice = useCallback(
    (entry: FuelEntry) => {
      // Price lock only applies when 7-Eleven filter is active
      if (!priceLock || !sevenElevenOnly || entry.brandId !== 113) return undefined;
      // You pay the lower of: your lock price, or pump price minus 25c (max discount)
      const maxDiscount = entry.price - 25;
      const effective = Math.max(Math.min(priceLock, entry.price), maxDiscount);
      // If effective equals pump price (lock is worse), don't show it
      return effective < entry.price ? effective : undefined;
    },
    [priceLock]
  );

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 6
  });

  const handleShare = async () => {
    if (!location || typeof window === 'undefined') return;
    const shareUrl = buildShareUrl(window.location.origin, pathname, location);
    try {
      setIsSharing(true);
      await navigator.clipboard.writeText(shareUrl);
    } finally {
      setIsSharing(false);
    }
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!searchInput.trim()) return;

    setIsGeocoding(true);
    setLocationError(null);

    try {
      const result = await geocodeWithNominatim(searchInput);

      setLocation(result);
      const params = new URLSearchParams({
        lat: result.lat.toString(),
        lng: result.lng.toString(),
        name: result.name
      });
      router.replace(`${pathname}?${params.toString()}`);
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : 'Unable to find that location'
      );
    } finally {
      setIsGeocoding(false);
    }
  };

  if (locationError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm dark:bg-slate-900">
          <div className="text-lg font-semibold">Location error</div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{locationError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Fuel Tracker</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-white">
              {formatLocationName(location)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-full border px-3 py-1 text-sm font-medium text-slate-600 hover:border-slate-400 dark:text-slate-300"
              onClick={() => setShowMap((prev) => !prev)}
            >
              {showMap ? 'Hide map' : 'Show map'}
            </button>
            <button
              className="rounded-full bg-brand-500 px-3 py-1 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-70"
              onClick={handleShare}
              disabled={!location || isSharing}
            >
              {isSharing ? 'Copied!' : 'Share this location'}
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-4">
          <form className="flex flex-col gap-3 md:flex-row md:items-center" onSubmit={handleSearch}>
            <div className="flex flex-1 items-center gap-2 rounded-2xl border bg-white px-3 py-2 dark:bg-slate-900">
              <input
                className="flex-1 bg-transparent text-sm outline-none"
                placeholder="Search a suburb, postcode, or address"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <button
                className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-900"
                type="submit"
                disabled={isGeocoding}
              >
                {isGeocoding ? 'Searching…' : 'Search'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-2xl border bg-white px-3 py-2 text-sm dark:bg-slate-900">
                <input
                  className="w-32 bg-transparent text-sm outline-none"
                  placeholder="Filter brand"
                  value={filter}
                  onChange={onChangeFilter}
                />
              </div>
              <select
                className="rounded-2xl border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                onChange={onChangeSort}
                value={sort}
              >
                <option value="price">Cheapest</option>
                <option value="distance">Closest</option>
              </select>
              <select
                className="rounded-2xl border bg-white px-3 py-2 text-sm dark:bg-slate-900"
                onChange={onChangeDistanceFilter}
                value={distanceFilter}
              >
                {distanceFilterKeys.map((option) => (
                  <option key={option} value={option}>
                    Within {option}
                  </option>
                ))}
              </select>
              <select
                className="rounded-2xl border bg-white px-3 py-2 text-sm font-medium dark:bg-slate-900"
                value={fuelTypeId}
                onChange={(e) => setFuelTypeId(Number.parseInt(e.target.value, 10) as FuelTypeId)}
              >
                {FUEL_TYPES.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.short}
                  </option>
                ))}
              </select>
              <button
                className={`rounded-2xl border px-3 py-2 text-sm font-medium transition ${
                  sevenElevenOnly
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-white text-slate-600 hover:border-slate-400 dark:bg-slate-900 dark:text-slate-300'
                }`}
                onClick={() => setSevenElevenOnly(!sevenElevenOnly)}
              >
                7-Eleven
              </button>
            </div>
          </form>
          {sevenElevenOnly && (
            <div className="mt-3 flex items-center gap-2">
              <label className="text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">🔒 Price lock</label>
              <div className="flex items-center gap-1 rounded-2xl border bg-white px-3 py-2 dark:bg-slate-900">
                <input
                  className="w-20 bg-transparent text-sm outline-none"
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 165"
                  value={priceLockInput}
                  onChange={(e) => setPriceLockInput(e.target.value)}
                />
                <span className="text-xs text-slate-400">¢/L</span>
              </div>
              {priceLock && (
                <button
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  onClick={() => setPriceLockInput('')}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {filteredData.length > 0 && location && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <TrendBar data={filteredData} fuelTypeId={fuelTypeId} locationName={location.name} lat={location.lat} lng={location.lng} />
        </div>
      )}

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          {showMap && location && (
            <div className="rounded-2xl border bg-white/80 p-2 dark:bg-slate-900/80">
              <Map currentLocation={location} results={filteredData} priceTierFor={priceTierFor} />
            </div>
          )}
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>{filteredData.length} results</span>
            {isLoading && <span>Updating prices…</span>}
          </div>
        </div>

        <div
          ref={parentRef}
          className="h-[70vh] overflow-auto rounded-2xl border bg-white/60 p-4 dark:bg-slate-900/60"
        >
          <div
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            className="relative"
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const entry = filteredData[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                  className="pb-4"
                >
                  {entry ? (
                    <FuelEntryCard fuelEntry={entry} priceTier={priceTierFor(getEffectivePrice(entry) ?? entry.price)} effectivePrice={getEffectivePrice(entry)} />
                  ) : null}
                </div>
              );
            })}
            {!filteredData.length && !isLoading && (
              <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                No stations match your filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FuelList;
