import type { Config } from '@netlify/functions';

export default async function handler() {
  // URL is injected by Netlify even in standalone functions
  const siteUrl = process.env.URL || 'https://zorfling-fuel-tracker.netlify.app';
  const cronKey = 'fuel_cron_Xk9mP2wR7vNj';

  // 1. Collect prices
  const collectRes = await fetch(`${siteUrl}/api/cron/collect-prices?key=${cronKey}`);
  const collectData = await collectRes.text();
  console.log(`Collect prices: ${collectRes.status} ${collectData}`);

  // 2. Check alerts after collection
  const alertRes = await fetch(`${siteUrl}/api/cron/check-alerts?key=${cronKey}`);
  const alertData = await alertRes.text();
  console.log(`Check alerts: ${alertRes.status} ${alertData}`);

  return new Response(JSON.stringify({
    collect: JSON.parse(collectData),
    alerts: JSON.parse(alertData),
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

// Run every 6 hours
export const config: Config = {
  schedule: '0 */6 * * *',
};
