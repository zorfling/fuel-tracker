export const FUEL_TYPES = [
  { id: 2, name: 'Unleaded 91', short: 'U91', nswCode: 'E10-U91' },
  { id: 12, name: 'E10', short: 'E10', nswCode: 'E10-U91' },
  { id: 5, name: 'Premium 95', short: 'P95', nswCode: 'P95-P98' },
  { id: 8, name: 'Premium 98', short: 'P98', nswCode: 'P95-P98' },
  { id: 3, name: 'Diesel', short: 'DSL', nswCode: 'DL-PDL' },
  { id: 14, name: 'Premium Diesel', short: 'PDSL', nswCode: 'DL-PDL' },
  { id: 4, name: 'LPG', short: 'LPG', nswCode: 'LPG' },
] as const;

export type FuelTypeId = (typeof FUEL_TYPES)[number]['id'];
export const DEFAULT_FUEL_ID: FuelTypeId = 2;
