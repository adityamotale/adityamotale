import type { DateRange } from './types.ts';

export function getSundayToSaturdayWindow(now = new Date()): DateRange {
  const dayOfWeek = now.getUTCDay();
  const daysSinceSaturday = (dayOfWeek + 1) % 7 || 7;

  const lastSaturday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceSaturday
  ));
  const prevSunday = new Date(Date.UTC(
    lastSaturday.getUTCFullYear(),
    lastSaturday.getUTCMonth(),
    lastSaturday.getUTCDate() - 6
  ));

  return {
    from: `${prevSunday.toISOString().slice(0, 10)}T00:00:00Z`,
    to: `${lastSaturday.toISOString().slice(0, 10)}T23:59:59Z`,
  };
}
