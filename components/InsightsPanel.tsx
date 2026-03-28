'use client';

import { useQuery } from '@tanstack/react-query';

interface DayStats {
  day: string;
  avg: number | null;
  samples: number;
}

interface InsightsData {
  tracked: boolean;
  insufficient?: boolean;
  totalSnapshots?: number;
  daysSinceFirst?: number;
  dayOfWeek?: DayStats[];
  cheapestDay?: { day: string; avg: number } | null;
  overallAvg?: number;
  overallMin?: number;
  overallMax?: number;
  weekTrend?: number | null;
}

interface Props {
  lat: number;
  lng: number;
  fuelTypeId: number;
}

export function InsightsPanel({ lat, lng, fuelTypeId }: Props) {
  const { data, isLoading } = useQuery<InsightsData>({
    queryKey: ['insights', lat, lng, fuelTypeId],
    queryFn: async () => {
      const res = await fetch(`/api/insights?lat=${lat}&lng=${lng}&fuelTypeId=${fuelTypeId}`);
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading || !data || !data.tracked) return null;

  if (data.insufficient || !data.totalSnapshots || data.totalSnapshots < 4) {
    return (
      <div className="rounded-2xl border bg-white/80 px-4 py-3 text-sm text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
        📊 Collecting data... insights will appear after a few days of tracking.
        <span className="ml-1 text-xs">({data.totalSnapshots ?? 0} snapshots so far)</span>
      </div>
    );
  }

  const { dayOfWeek, cheapestDay, overallAvg, overallMin, overallMax, weekTrend, daysSinceFirst } = data;

  return (
    <div className="rounded-2xl border bg-white/80 dark:bg-slate-900/80 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          📊 Insights
        </span>
        <span className="ml-2 text-xs text-slate-400">
          {daysSinceFirst} days of data
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Best day to fill up */}
        {cheapestDay && (
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Best day to fill up: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{cheapestDay.day}</span>
              </span>
              <span className="ml-1 text-xs text-slate-400">avg {cheapestDay.avg}¢</span>
            </div>
          </div>
        )}

        {/* Week trend */}
        {weekTrend !== null && weekTrend !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-lg">{weekTrend > 0 ? '📈' : weekTrend < 0 ? '📉' : '➡️'}</span>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              This week vs last:{' '}
              <span className={weekTrend > 0 ? 'text-rose-500 font-medium' : weekTrend < 0 ? 'text-emerald-500 font-medium' : 'text-slate-400'}>
                {weekTrend > 0 ? '+' : ''}{weekTrend}¢
              </span>
            </span>
          </div>
        )}

        {/* Price range */}
        {overallMin !== undefined && overallMax !== undefined && overallAvg !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-lg">📏</span>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Range: {overallMin.toFixed(1)}¢ – {overallMax.toFixed(1)}¢
              <span className="ml-1 text-xs text-slate-400">(avg {overallAvg}¢)</span>
            </span>
          </div>
        )}

        {/* Day-of-week bars */}
        {dayOfWeek && dayOfWeek.some(d => d.avg !== null) && (
          <div className="pt-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Average cheapest by day
            </div>
            <div className="grid grid-cols-7 gap-1">
              {dayOfWeek.map((d) => {
                const allAvgs = dayOfWeek.filter(x => x.avg !== null).map(x => x.avg!);
                const min = Math.min(...allAvgs);
                const max = Math.max(...allAvgs);
                const range = max - min || 1;
                const pct = d.avg !== null ? ((d.avg - min) / range) : 0;
                const isCheapest = cheapestDay && d.day === cheapestDay.day;

                return (
                  <div key={d.day} className="flex flex-col items-center gap-0.5">
                    <div className="h-12 w-full flex items-end justify-center">
                      {d.avg !== null ? (
                        <div
                          className={`w-full rounded-t ${isCheapest ? 'bg-emerald-500' : 'bg-sky-400 dark:bg-sky-600'}`}
                          style={{ height: `${20 + pct * 80}%` }}
                          title={`${d.day}: ${d.avg}¢ (${d.samples} samples)`}
                        />
                      ) : (
                        <div className="w-full h-1 rounded bg-slate-200 dark:bg-slate-700" />
                      )}
                    </div>
                    <span className={`text-[10px] ${isCheapest ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      {d.day.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
