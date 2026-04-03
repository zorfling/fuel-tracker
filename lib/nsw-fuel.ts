import { randomUUID } from 'crypto';

const NSW_TOKEN_URL =
  'https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken?grant_type=client_credentials';
const NSW_NEARBY_URL =
  'https://api.onegov.nsw.gov.au/FuelPriceCheck/v2/fuel/prices/nearby';

let cachedToken: { token: string; expiresAt: number } | null = null;

function formatTimestampUtc(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = pad(date.getUTCDate());
  const month = pad(date.getUTCMonth() + 1);
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  const ampm = hours >= 12 ? 'PM' : 'AM';

  return `${day}/${month}/${year} ${pad(hour12)}:${minutes}:${seconds} ${ampm}`;
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NSW Fuel API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getNswToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const apiKey = process.env.NSW_FUEL_API_KEY;
  const apiSecret = process.env.NSW_FUEL_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Missing NSW_FUEL_API_KEY or NSW_FUEL_API_SECRET');
  }

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const data = await fetchJson<{ access_token: string; expires_in: number }>(
    NSW_TOKEN_URL,
    {
      headers: {
        Authorization: `Basic ${auth}`
      }
    }
  );

  const expiresIn = Number(data.expires_in) || 0;
  const refreshWindowSeconds = 60 * 60; // refresh 1 hour early
  const ttlSeconds = Math.max(0, expiresIn - refreshWindowSeconds);

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + ttlSeconds * 1000
  };

  return data.access_token;
}

export interface NswFuelStation {
  brandid: string;
  stationid: string;
  brand: string;
  code: number;
  name: string;
  address: string;
  location: {
    distance: number;
    latitude: number;
    longitude: number;
  };
  state: string;
}

export interface NswFuelPrice {
  stationcode: number;
  fueltype: string;
  price: number;
  priceunit: string;
  lastupdated: string;
  state: string;
}

export interface NswFuelNearbyResponse {
  stations: NswFuelStation[];
  prices: NswFuelPrice[];
}

export async function getNswFuelNearby(
  lat: number,
  lng: number,
  radiusKm: number,
  fuelType: string
): Promise<NswFuelNearbyResponse> {
  const apiKey = process.env.NSW_FUEL_API_KEY;
  if (!apiKey) {
    throw new Error('Missing NSW_FUEL_API_KEY');
  }

  const token = await getNswToken();
  const body = {
    fueltype: fuelType,
    latitude: lat.toString(),
    longitude: lng.toString(),
    radius: radiusKm.toString(),
    sortby: 'price',
    sortascending: 'true'
  };

  return fetchJson<NswFuelNearbyResponse>(NSW_NEARBY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      apikey: apiKey,
      transactionid: randomUUID(),
      requesttimestamp: formatTimestampUtc(new Date())
    },
    body: JSON.stringify(body)
  });
}
