import type { FuelEntry } from '../types/fuel';

const SEVEN_ELEVEN_BRAND_ID = 113;

export interface FilterOptions {
  filter: string;           // station name filter
  sort: 'price' | 'distance';
  distanceFilter: string;   // e.g. '10km'
  sevenElevenOnly: boolean;
  priceLock: number | null;  // in cents, e.g. 165
}

/**
 * Calculate effective price for a 7-Eleven station with price lock.
 * Returns undefined if price lock doesn't apply or doesn't save money.
 */
export function getEffectivePrice(
  entry: FuelEntry,
  priceLock: number | null,
  sevenElevenOnly: boolean
): number | undefined {
  if (!priceLock || !sevenElevenOnly || entry.brandId !== SEVEN_ELEVEN_BRAND_ID) {
    return undefined;
  }
  const maxDiscount = entry.price - 25;
  const effective = Math.max(Math.min(priceLock, entry.price), maxDiscount);
  return effective < entry.price ? effective : undefined;
}

/**
 * Get the price used for sorting (effective if applicable, otherwise pump price).
 */
export function getSortPrice(
  entry: FuelEntry,
  priceLock: number | null,
  sevenElevenOnly: boolean
): number {
  if (!priceLock || !sevenElevenOnly || entry.brandId !== SEVEN_ELEVEN_BRAND_ID) {
    return entry.price;
  }
  return Math.max(Math.min(priceLock, entry.price), entry.price - 25);
}

/**
 * Filter and sort fuel entries based on options.
 * Returns a new array (never mutates input).
 */
export function filterAndSort(
  data: FuelEntry[],
  options: FilterOptions
): FuelEntry[] {
  const { filter, sort, distanceFilter, sevenElevenOnly, priceLock } = options;
  const maxDistance = Number.parseFloat(distanceFilter.split('km')[0]);

  return data
    .filter((entry) => entry.name.toLowerCase().includes(filter.toLowerCase()))
    .filter((entry) => !sevenElevenOnly || entry.brandId === SEVEN_ELEVEN_BRAND_ID)
    .filter((entry) => entry.distance <= maxDistance)
    .slice()
    .sort((a, b) => {
      if (sort === 'distance') {
        return a.distance - b.distance;
      }
      const aPrice = getSortPrice(a, priceLock, sevenElevenOnly);
      const bPrice = getSortPrice(b, priceLock, sevenElevenOnly);
      return aPrice - bPrice;
    });
}

/**
 * Determine price tier for color coding.
 * Filters out outliers (<50c, >500c) before calculating thresholds.
 */
export function getPriceTier(
  price: number,
  allEntries: FuelEntry[]
): 'cheap' | 'mid' | 'expensive' {
  if (!allEntries.length) return 'mid';

  const sane = allEntries
    .map((e) => e.price)
    .filter((p) => p >= 50 && p < 500);

  if (!sane.length) return 'mid';

  const sorted = [...sane].sort((a, b) => a - b);
  const cheapThreshold = sorted[Math.floor(sorted.length * 0.33)];
  const expensiveThreshold = sorted[Math.floor(sorted.length * 0.66)];

  if (price <= cheapThreshold) return 'cheap';
  if (price >= expensiveThreshold) return 'expensive';
  return 'mid';
}
