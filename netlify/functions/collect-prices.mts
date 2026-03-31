import type { Config } from '@netlify/functions';

export default async function handler() {
  // URL is injected by Netlify even in standalone functions
  const siteUrl = process.env.URL || 'https://zorfling-fuel-tracker.netlify.app';

  // Call the Next.js API route which has access to all env vars
  // Use a static key since env vars aren't available in standalone functions
  const res = await fetch(`${siteUrl}/api/cron/collect-prices?key=fuel_cron_Xk9mP2wR7vNj`);
  const data = await res.text();

  console.log(`Collect prices response: ${res.status} ${data}`);

  return new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json' } });
}

// Run every 6 hours
export const config: Config = {
  schedule: '0 */6 * * *',
};
