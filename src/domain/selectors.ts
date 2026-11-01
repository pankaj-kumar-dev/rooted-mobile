import { shiftDate } from "./dates";
import { buildCombinedPoints, buildTimeline, summarizeGrowth } from "./score";
import type { CombinedPoint, GraphPoint, GrowthSummary } from "./types";
import { activeHabits, type HabitRecord, type RootedState } from "./state";

/** Default window: at least this many days back from today (matches web). */
export const MIN_TIMELINE_DAYS = 30;

/**
 * One continuous calendar timeline per habit over a shared date range, so habits stay aligned
 * for the combined view. Range: at least `minDays` back from `today`, or earlier if a check-in is older.
 * Each habit's points use only its own check-ins. Mirrors web `buildUserTimelines`.
 */
export function timelinesFor(
  state: RootedState,
  habitIds: readonly string[],
  today: string,
  minDays = MIN_TIMELINE_DAYS,
): Record<string, GraphPoint[]> {
  const ids = new Set(habitIds);
  const mine = state.checkIns.filter((c) => ids.has(c.habitId) && c.date <= today);
  let start = shiftDate(today, -(minDays - 1));
  for (const c of mine) if (c.date < start) start = c.date;

  const out: Record<string, GraphPoint[]> = {};
  for (const id of habitIds) {
    out[id] = buildTimeline(id, mine.filter((c) => c.habitId === id), start, today);
  }
  return out;
}

/** Derived rating of one habit as of `today`. Baseline 0, no floor or ceiling. */
export function ratingOf(state: RootedState, habitId: string, today: string): number {
  const points = timelinesFor(state, [habitId], today)[habitId] ?? [];
  return points.length ? points[points.length - 1]!.rating : 0;
}

export interface OverallGrowthView {
  habits: HabitRecord[];
  pointsById: Record<string, GraphPoint[]>;
  combined: CombinedPoint[];
  summary: GrowthSummary;
}

/**
 * Combined growth across ACTIVE habits only, using the same timelines and the same
 * `buildCombinedPoints` / `summarizeGrowth` as the web app. Archived habits are excluded
 * but their history is untouched, so reactivating restores their contribution.
 */
export function overallGrowth(state: RootedState, today: string, minDays = MIN_TIMELINE_DAYS): OverallGrowthView {
  const habits = activeHabits(state);
  const pointsById = timelinesFor(state, habits.map((h) => h.id), today, minDays);
  const series = habits.map((h) => pointsById[h.id] ?? []).filter((p) => p.length > 0);
  const combined = buildCombinedPoints(series);
  return { habits, pointsById, combined, summary: summarizeGrowth(combined, series) };
}
