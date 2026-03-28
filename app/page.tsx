import { Suspense } from 'react';
import FuelList from '../components/FuelList';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading Fuel Tracker…</div>}>
        <FuelList />
      </Suspense>
    </main>
  );
}
