export type SupportedState = 'QLD' | 'NSW' | 'unknown';

export function getState(lat: number, lng: number): SupportedState {
  // QLD/NSW border is roughly at -28.15 latitude (at the coast)
  // Tweed Heads/Coolangatta area

  // Queensland: north of -28.15
  if (lat <= -10 && lat >= -28.15 && lng >= 138 && lng <= 154) {
    return 'QLD';
  }

  // New South Wales + Tasmania: south of -28.15
  if (lat < -28.15 && lat >= -44 && lng >= 141 && lng <= 154) {
    return 'NSW';
  }

  return 'unknown';
}
