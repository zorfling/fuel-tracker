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
import { FuelListSkeleton } from './FuelCardSkeleton';
import { InsightsPanel } from './InsightsPanel';
import { filterAndSort, getEffectivePrice, getPriceTier } from '../lib/fuelFilters';
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
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const lastScrollY = useRef(0);
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

  // Collapse header on scroll down, expand on scroll up
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      if (y > lastScrollY.current && y > 80) {
        setHeaderCollapsed(true);
      } else if (y < lastScrollY.current) {
        setHeaderCollapsed(false);
      }
      lastScrollY.current = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
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

  const { isLoading, data, dataUpdatedAt } = useQuery<FuelEntry[]>({
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
    if (!data || data.length === 0) return [];
    return filterAndSort(data, {
      filter,
      sort,
      distanceFilter,
      sevenElevenOnly,
      priceLock,
    });
  }, [data, distanceFilter, filter, priceLock, sevenElevenOnly, sort]);

  const priceTierFor = useCallback(
    (price: number) => getPriceTier(price, filteredData),
    [filteredData]
  );

  const getEffectivePriceForEntry = useCallback(
    (entry: FuelEntry) => getEffectivePrice(entry, priceLock, sevenElevenOnly),
    [priceLock, sevenElevenOnly]
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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur dark:bg-slate-950/80 transition-all duration-300">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Fuel Tracker</div>
              <div className="text-xl font-semibold text-slate-900 dark:text-white">
                {formatLocationName(location)}
              </div>
            </div>
            {headerCollapsed && filteredData.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>·</span>
                <span>{filteredData.length} stations</span>
                {filteredData[0] && sort === 'price' && (
                  <>
                    <span>·</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      from {filteredData[0].price.toFixed(1)}¢
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {headerCollapsed && (
              <button
                className="rounded-full border px-3 py-1 text-sm font-medium text-slate-600 hover:border-slate-400 dark:text-slate-300"
                onClick={() => { setHeaderCollapsed(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              >
                ▼ Filters
              </button>
            )}
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
        <div className={`mx-auto max-w-5xl px-4 pb-4 overflow-hidden transition-all duration-300 ${headerCollapsed ? 'max-h-0 pb-0 opacity-0' : 'max-h-96 opacity-100'}`}>
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

      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{ height: 'calc(100vh - 1px)' }}
      >
        {filteredData.length > 0 && location && (
          <div className="mx-auto max-w-5xl px-4 pt-4 space-y-2">
            <TrendBar data={filteredData} fuelTypeId={fuelTypeId} locationName={location.name} lat={location.lat} lng={location.lng} />
            <InsightsPanel lat={location.lat} lng={location.lng} fuelTypeId={fuelTypeId} />
          </div>
        )}

        <div className="mx-auto max-w-5xl px-4 py-4">
          {showMap && location && (
            <div className="rounded-2xl border bg-white/80 p-2 dark:bg-slate-900/80 mb-4">
              <Map currentLocation={location} results={filteredData} priceTierFor={priceTierFor} />
            </div>
          )}
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 mb-3">
            <span>{filteredData.length} results</span>
            {isLoading && <span>Updating prices…</span>}
            {!isLoading && dataUpdatedAt > 0 && (
              <span>Updated {new Date(dataUpdatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>

          {isLoading && !filteredData.length ? (
            <FuelListSkeleton />
          ) : (
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
                    <FuelEntryCard fuelEntry={entry} priceTier={priceTierFor(getEffectivePriceForEntry(entry) ?? entry.price)} effectivePrice={getEffectivePriceForEntry(entry)} />
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
          )}
        </div>
      </div>
    </div>
  );
};

export default FuelList;
