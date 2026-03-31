'use client';

import type { FuelEntry } from '../types/fuel';
import { getBrandLogo } from '../config/brandLogos';
import type { BrandId } from '../config/brandLogos';

interface Props {
  fuelEntry: FuelEntry;
  priceTier: 'cheap' | 'mid' | 'expensive';
}

const priceStyles: Record<Props['priceTier'], string> = {
  cheap: 'text-emerald-600',
  mid: 'text-amber-600',
  expensive: 'text-rose-600',
};

export function MapInfoCard({ fuelEntry, priceTier }: Props) {
  const { name, address, postcode, distanceString, price, brandId, lastUpdated } = fuelEntry;
  const logoSrc = getBrandLogo(brandId as BrandId);

  return (
    <div className="flex items-center gap-3 min-w-[200px] max-w-[260px] p-1">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={32} height={32} alt={name} className="object-contain" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-slate-900 truncate">{name}</div>
        <div className="text-xs text-slate-500 truncate">{address} {postcode}</div>
        <div className="text-xs text-slate-400">{distanceString} • {lastUpdated}</div>
      </div>
      <div className={`text-xl font-bold flex-shrink-0 ${priceStyles[priceTier]}`}>
        {price.toFixed(1)}
      </div>
    </div>
  );
}
