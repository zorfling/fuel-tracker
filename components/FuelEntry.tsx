'use client';

import type { FuelEntry } from '../types/fuel';
import { getBrandLogo } from '../config/brandLogos';
import type { BrandId } from '../config/brandLogos';

interface Props {
  fuelEntry: FuelEntry;
  priceTier: 'cheap' | 'mid' | 'expensive';
  effectivePrice?: number;
}

const priceStyles: Record<Props['priceTier'], string> = {
  cheap: 'text-emerald-500',
  mid: 'text-amber-500',
  expensive: 'text-rose-500',
};

export const FuelEntryCard = ({ fuelEntry, priceTier, effectivePrice }: Props) => {
  const { name, address, postcode, distanceString, price, brandId, lastUpdated } =
    fuelEntry;

  const logoSrc = getBrandLogo(brandId as BrandId);
  const showLock = effectivePrice != null && effectivePrice !== price;
  const displayPrice = effectivePrice ?? price;

  return (
    <div className="rounded-2xl border bg-white/80 p-4 shadow-sm backdrop-blur transition hover:shadow-md dark:bg-slate-900/80">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            {name}
          </h3>
          <a
            className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            href={`https://www.google.com.au/maps/search/${name}+${address}+${postcode}`}
            target="_blank"
            rel="noreferrer"
          >
            {address} {postcode}
          </a>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {distanceString} • Updated {lastUpdated}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className={`text-3xl font-bold ${priceStyles[priceTier]}`}>
              {displayPrice.toFixed(1)}
            </div>
            {showLock && (
              <div className="text-xs text-slate-400 dark:text-slate-500 line-through">
                {price.toFixed(1)}¢ pump
              </div>
            )}
          </div>
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc}
              width={56}
              height={56}
              alt={name}
              className="object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
