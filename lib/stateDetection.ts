export type SupportedState = 'QLD' | 'NSW' | 'unknown';

export function getState(lat: number, lng: number): SupportedState {
  // Queensland bounds
  if (lat <= -10 && lat >= -29 && lng >= 138 && lng <= 154) {
    return 'QLD';
  }

  // New South Wales bounds
  if (lat <= -28 && lat >= -38 && lng >= 141 && lng <= 154) {
    return 'NSW';
  }

  return 'unknown';
}
