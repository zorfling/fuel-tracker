export const brands = [
  { BrandId: 2, Name: 'Caltex' },
  { BrandId: 5, Name: 'BP' },
  { BrandId: 7, Name: 'Budget' },
  { BrandId: 12, Name: 'Independent' },
  { BrandId: 16, Name: 'Mobil' },
  { BrandId: 20, Name: 'Shell' },
  { BrandId: 23, Name: 'United' },
  { BrandId: 27, Name: 'Unbranded' },
  { BrandId: 39, Name: 'Matilda' },
  { BrandId: 51, Name: 'Apco' },
  { BrandId: 57, Name: 'Metro Fuel' },
  { BrandId: 65, Name: 'Petrogas' },
  { BrandId: 72, Name: 'Gull' },
  { BrandId: 86, Name: 'Liberty' },
  { BrandId: 87, Name: 'AM/PM' },
  { BrandId: 105, Name: 'Better Choice' },
  { BrandId: 108, Name: 'Unigas' },
  { BrandId: 110, Name: 'Freedom Fuels' },
  { BrandId: 111, Name: 'Coles Express' },
  { BrandId: 112, Name: 'Caltex Woolworths' },
  { BrandId: 113, Name: '7 Eleven' },
  { BrandId: 114, Name: 'Astron' },
  { BrandId: 115, Name: 'Prime Petroleum' },
  { BrandId: 116, Name: 'CQP' },
  { BrandId: 167, Name: 'Speedway' },
  { BrandId: 169, Name: 'On the Run' },
  { BrandId: 2301, Name: 'Choice' },
  { BrandId: 4896, Name: 'Mogas' },
  { BrandId: 5094, Name: 'Puma Energy' },
  { BrandId: 2031003, Name: 'IGA' },
  { BrandId: 2031031, Name: 'Costco' },
  { BrandId: 2418945, Name: 'Endeavour BP' },
  { BrandId: 2418946, Name: 'Riordan Fuel' },
  { BrandId: 2418947, Name: 'Riordan Fuels' },
  { BrandId: 2418951, Name: 'Vantage Fuels' },
  { BrandId: 2418994, Name: 'Pacific Petroleum' },
  { BrandId: 2418995, Name: 'Vibe' },
  { BrandId: 2419007, Name: 'Lowes' },
  { BrandId: 2419008, Name: 'Westside' },
  { BrandId: 2419036, Name: 'Tesla' },
  { BrandId: 2419037, Name: 'Enhance' },
  { BrandId: 2459022, Name: 'FuelXpress' },
  { BrandId: 3421028, Name: 'X Convenience' },
  { BrandId: 3421066, Name: 'Ampol' },
  { BrandId: 3421073, Name: 'Euro Garages' },
  { BrandId: 3421074, Name: 'Perrys' }
] as const;

export type BrandId = (typeof brands)[number]['BrandId'];

// Brand colors for the initials fallback
const brandColors: Partial<Record<BrandId, string>> = {
  2: '#e2001a',    // Caltex red
  5: '#009900',    // BP green
  20: '#fbce07',   // Shell yellow
  23: '#1a3d8f',   // United blue
  57: '#003b7c',   // Metro blue
  86: '#003d6b',   // Liberty blue
  111: '#ed1c24',  // Coles red
  113: '#00805a',  // 7-Eleven green
  5094: '#e4002b', // Puma red
  3421066: '#003c8f', // Ampol blue
};

function getInitials(name: string): string {
  if (name === '7 Eleven') return '7E';
  if (name === 'AM/PM') return 'AM';
  return name
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function generateInitialsSvg(name: string, brandId: BrandId): string {
  const initials = getInitials(name);
  const color = brandColors[brandId] || '#475569';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <rect width="80" height="80" rx="16" fill="${color}"/>
    <text x="40" y="42" text-anchor="middle" dominant-baseline="central" font-family="system-ui,-apple-system,sans-serif" font-weight="700" font-size="${initials.length > 2 ? '22' : '28'}" fill="white">${initials}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Build the logo map — all brands get a clean initials-based icon
const brandLogoMap = new Map<BrandId, string>();
for (const brand of brands) {
  brandLogoMap.set(brand.BrandId, generateInitialsSvg(brand.Name, brand.BrandId));
}

export const getBrandLogo = (brandId: BrandId): string => {
  return brandLogoMap.get(brandId) || generateInitialsSvg('?', brandId);
};

export const getBrandName = (brandId: BrandId): string => {
  return brands.find(b => b.BrandId === brandId)?.Name || 'Unknown';
};
