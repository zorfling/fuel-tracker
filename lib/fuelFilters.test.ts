import { describe, it, expect } from 'vitest';
import {
  getEffectivePrice,
  getSortPrice,
  filterAndSort,
  getPriceTier,
  type FilterOptions,
} from './fuelFilters';
import type { FuelEntry } from '../types/fuel';

// Helper to create a fuel entry
function entry(overrides: Partial<FuelEntry> = {}): FuelEntry {
  return {
    id: 1,
    name: 'Test Station',
    address: '123 Test St',
    postcode: '4000',
    distance: 5,
    distanceString: '5.00 km',
    price: 180,
    brandId: 1,
    brandLogo: '',
    lastUpdated: '2026-03-28',
    lat: -27.5,
    lng: 153.0,
    ...overrides,
  };
}

function sevenElevenEntry(overrides: Partial<FuelEntry> = {}): FuelEntry {
  return entry({ name: '7 Eleven Test', brandId: 113, ...overrides });
}

const defaultOptions: FilterOptions = {
  filter: '',
  sort: 'price',
  distanceFilter: '10km',
  sevenElevenOnly: false,
  priceLock: null,
};

// ─── getEffectivePrice ───

describe('getEffectivePrice', () => {
  it('returns undefined when no price lock', () => {
    expect(getEffectivePrice(sevenElevenEntry({ price: 180 }), null, true)).toBeUndefined();
  });

  it('returns undefined when 7-Eleven filter is off', () => {
    expect(getEffectivePrice(sevenElevenEntry({ price: 180 }), 165, false)).toBeUndefined();
  });

  it('returns undefined for non-7-Eleven station', () => {
    expect(getEffectivePrice(entry({ price: 180, brandId: 1 }), 165, true)).toBeUndefined();
  });

  it('applies lock price when cheaper than pump', () => {
    // Lock at 165, pump at 180 → effective = max(min(165, 180), 180-25) = max(165, 155) = 165
    expect(getEffectivePrice(sevenElevenEntry({ price: 180 }), 165, true)).toBe(165);
  });

  it('caps discount at 25c below pump price', () => {
    // Lock at 140, pump at 180 → effective = max(min(140, 180), 180-25) = max(140, 155) = 155
    expect(getEffectivePrice(sevenElevenEntry({ price: 180 }), 140, true)).toBe(155);
  });

  it('returns undefined when lock is worse than pump price', () => {
    // Lock at 190, pump at 180 → effective = max(min(190, 180), 180-25) = max(180, 155) = 180
    // 180 is not < 180, so undefined
    expect(getEffectivePrice(sevenElevenEntry({ price: 180 }), 190, true)).toBeUndefined();
  });

  it('returns lock price when exactly 25c below pump', () => {
    // Lock at 155, pump at 180 → effective = max(min(155, 180), 155) = max(155, 155) = 155
    expect(getEffectivePrice(sevenElevenEntry({ price: 180 }), 155, true)).toBe(155);
  });

  it('handles pump price lower than lock', () => {
    // Lock at 170, pump at 160 → effective = max(min(170, 160), 160-25) = max(160, 135) = 160
    // 160 is not < 160, so undefined (lock doesn't help)
    expect(getEffectivePrice(sevenElevenEntry({ price: 160 }), 170, true)).toBeUndefined();
  });
});

// ─── getSortPrice ───

describe('getSortPrice', () => {
  it('returns pump price when no lock', () => {
    expect(getSortPrice(sevenElevenEntry({ price: 180 }), null, true)).toBe(180);
  });

  it('returns pump price when 7-Eleven filter off', () => {
    expect(getSortPrice(sevenElevenEntry({ price: 180 }), 165, false)).toBe(180);
  });

  it('returns pump price for non-7-Eleven', () => {
    expect(getSortPrice(entry({ price: 180 }), 165, true)).toBe(180);
  });

  it('returns effective price for 7-Eleven with lock', () => {
    // Lock 165, pump 180 → max(min(165,180), 155) = 165
    expect(getSortPrice(sevenElevenEntry({ price: 180 }), 165, true)).toBe(165);
  });

  it('caps at 25c discount', () => {
    // Lock 140, pump 180 → max(min(140,180), 155) = 155
    expect(getSortPrice(sevenElevenEntry({ price: 180 }), 140, true)).toBe(155);
  });

  it('returns pump price when lock is worse', () => {
    // Lock 190, pump 180 → max(min(190,180), 155) = 180
    expect(getSortPrice(sevenElevenEntry({ price: 180 }), 190, true)).toBe(180);
  });
});

// ─── filterAndSort ───

describe('filterAndSort', () => {
  const stations = [
    entry({ id: 1, name: 'BP Milton', price: 185, distance: 2, brandId: 1 }),
    sevenElevenEntry({ id: 2, name: '7 Eleven Darra', price: 180, distance: 5 }),
    entry({ id: 3, name: 'Shell Indro', price: 175, distance: 8, brandId: 2 }),
    sevenElevenEntry({ id: 4, name: '7 Eleven Oxley', price: 190, distance: 3 }),
    entry({ id: 5, name: 'Ampol Forest Lake', price: 170, distance: 12, brandId: 3 }),
  ];

  it('sorts by price (cheapest first) by default', () => {
    const result = filterAndSort(stations, { ...defaultOptions, distanceFilter: '50km' });
    const prices = result.map((e) => e.price);
    expect(prices).toEqual([170, 175, 180, 185, 190]);
  });

  it('sorts by distance when selected', () => {
    const result = filterAndSort(stations, { ...defaultOptions, sort: 'distance', distanceFilter: '50km' });
    const distances = result.map((e) => e.distance);
    expect(distances).toEqual([2, 3, 5, 8, 12]);
  });

  it('filters by station name', () => {
    const result = filterAndSort(stations, { ...defaultOptions, filter: '7 eleven', distanceFilter: '50km' });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.brandId === 113)).toBe(true);
  });

  it('filters to 7-Eleven only', () => {
    const result = filterAndSort(stations, { ...defaultOptions, sevenElevenOnly: true, distanceFilter: '50km' });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.brandId === 113)).toBe(true);
  });

  it('filters by distance', () => {
    const result = filterAndSort(stations, { ...defaultOptions, distanceFilter: '5km' });
    expect(result).toHaveLength(3); // 2km, 3km, 5km
  });

  it('does NOT apply price lock when 7-Eleven filter is off', () => {
    const result = filterAndSort(stations, {
      ...defaultOptions,
      sevenElevenOnly: false,
      priceLock: 165,
      distanceFilter: '50km',
    });
    // Should sort by raw pump price, not effective
    const prices = result.map((e) => e.price);
    expect(prices).toEqual([170, 175, 180, 185, 190]);
  });

  it('applies price lock sort when 7-Eleven filter is on', () => {
    const result = filterAndSort(stations, {
      ...defaultOptions,
      sevenElevenOnly: true,
      priceLock: 165,
      distanceFilter: '50km',
    });
    // 7E Darra: pump 180, lock 165 → effective = max(min(165,180), 155) = 165
    // 7E Oxley: pump 190, lock 165 → effective = max(min(165,190), 165) = 165
    // Both 165, so stable order (Darra first by original position since equal)
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual([2, 4]);
  });

  it('never mutates the input array', () => {
    const original = [...stations];
    filterAndSort(stations, { ...defaultOptions, sort: 'price', distanceFilter: '50km' });
    expect(stations.map((e) => e.id)).toEqual(original.map((e) => e.id));
  });

  it('returns empty array for no data', () => {
    expect(filterAndSort([], defaultOptions)).toEqual([]);
  });

  it('combines filters correctly', () => {
    const result = filterAndSort(stations, {
      filter: '',
      sort: 'price',
      distanceFilter: '5km',
      sevenElevenOnly: true,
      priceLock: null,
    });
    // Only 7E within 5km: Oxley (3km), Darra (5km)
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(2); // Darra 180 < Oxley 190
    expect(result[1].id).toBe(4);
  });
});

// ─── getPriceTier ───

describe('getPriceTier', () => {
  const stations = [
    entry({ price: 160 }),
    entry({ price: 170 }),
    entry({ price: 180 }),
    entry({ price: 190 }),
    entry({ price: 200 }),
    entry({ price: 210 }),
  ];

  it('returns cheap for low prices', () => {
    expect(getPriceTier(160, stations)).toBe('cheap');
  });

  it('returns expensive for high prices', () => {
    expect(getPriceTier(210, stations)).toBe('expensive');
  });

  it('returns mid for middle prices', () => {
    expect(getPriceTier(185, stations)).toBe('mid');
  });

  it('returns mid for empty array', () => {
    expect(getPriceTier(180, [])).toBe('mid');
  });

  it('ignores outliers below 50c', () => {
    const withOutlier = [entry({ price: 25 }), ...stations];
    // 25c should be filtered out, not skew the tiers
    expect(getPriceTier(160, withOutlier)).toBe('cheap');
  });

  it('ignores outliers above 500c', () => {
    const withOutlier = [...stations, entry({ price: 999 })];
    expect(getPriceTier(210, withOutlier)).toBe('expensive');
  });
});
