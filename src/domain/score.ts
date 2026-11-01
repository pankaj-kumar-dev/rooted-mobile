// Ported verbatim from web: rooted/src/domain/score.ts. Keep in sync; do not change scoring semantics here.
import type { CheckInOutcome, CombinedPoint, DailyCheckIn, Delta, DisplayOutcome, GraphPoint, GrowthSummary } from "./types";

export const MAX_ACTIVE_HABITS = 5;

export function outcomeDelta(outcome: DisplayOutcome): Delta {
  if (outcome === "good") return 1;
  if (outcome === "slip") return -1;
  return 0; // missed + unrecorded are never treated as a slip
}

function applyDays(
  habitId: string,
  days: ReadonlyArray<{ date: string; outcome: DisplayOutcome }>,
  baseline: number,
): GraphPoint[] {
  let rating = baseline;
  return days.map(({ date, outcome }) => {
    const delta = outcomeDelta(outcome);
    const previousRating = rating;
    rating += delta;
    return { habitId, date, outcome, delta, rating, previousRating };
  });
}

/** Cumulative staircase points in chronological order. Does not mutate input. */
export function buildGraphPoints(
  habitId: string,
  checkIns: readonly DailyCheckIn[],
  baseline = 0,
): GraphPoint[] {
  const sorted = [...checkIns].sort((a, b) => a.date.localeCompare(b.date));
  return applyDays(habitId, sorted, baseline);
}

const DAY_MS = 86_400_000;

function parseDate(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Continuous calendar timeline from `startDate` to `endDate` inclusive.
 * Days without a check-in become `unrecorded` (delta 0).
 */
export function buildTimeline(
  habitId: string,
  checkIns: readonly DailyCheckIn[],
  startDate: string,
  endDate: string,
  baseline = 0,
): GraphPoint[] {
  const byDate = new Map<string, CheckInOutcome>();
  for (const c of checkIns) byDate.set(c.date, c.outcome);

  const days: Array<{ date: string; outcome: DisplayOutcome }> = [];
  for (let t = parseDate(startDate); t <= parseDate(endDate); t += DAY_MS) {
    const date = formatDate(t);
    days.push({ date, outcome: byDate.get(date) ?? "unrecorded" });
  }
  return applyDays(habitId, days, baseline);
}

export function currentRating(points: readonly GraphPoint[], baseline = 0): number {
  return points.length ? points[points.length - 1]!.rating : baseline;
}

export const OUTCOME_LABEL: Record<DisplayOutcome, string> = {
  good: "Good day",
  slip: "Slip-up",
  missed: "Missed check-in",
  unrecorded: "No check-in",
};

export function describeOutcome(outcome: DisplayOutcome): string {
  switch (outcome) {
    case "good":
      return "Good day — score up by 1.";
    case "slip":
      return "Slip-up — score down by 1; earlier history stays.";
    case "missed":
      return "Missed check-in — score unchanged.";
    case "unrecorded":
      return "No check-in recorded — score unchanged.";
  }
}

export function summarizePoints(points: readonly GraphPoint[]): string {
  if (!points.length) return "No check-ins yet.";
  const count = (o: DisplayOutcome) => points.filter((p) => p.outcome === o).length;
  const ratings = points.map((p) => p.rating);
  const flat = count("missed") + count("unrecorded");
  return (
    `${points.length} days from ${points[0]!.date} to ${points[points.length - 1]!.date}: ` +
    `${count("good")} good, ${count("slip")} slip-ups, ${flat} unchanged. ` +
    `Ends at rating ${currentRating(points)} (low ${Math.min(...ratings)}, high ${Math.max(...ratings)}).`
  );
}

/** Toggle selection while enforcing the five-habit cap. */
export function toggleHabit(selected: readonly string[], id: string, max = MAX_ACTIVE_HABITS): string[] {
  if (selected.includes(id)) return selected.filter((s) => s !== id);
  return selected.length >= max ? [...selected] : [...selected, id];
}

function netOutcome(net: number, recorded: boolean): DisplayOutcome {
  if (net > 0) return "good";
  if (net < 0) return "slip";
  return recorded ? "missed" : "unrecorded";
}

/**
 * Aggregate several habits into one cumulative staircase.
 * Each habit keeps its own history; this only reads their points.
 * combined[t] = combined[t-1] + sum of every habit's delta on day t.
 */
export function buildCombinedPoints(
  pointsByHabit: ReadonlyArray<readonly GraphPoint[]>,
  baseline = 0,
): CombinedPoint[] {
  const length = Math.max(0, ...pointsByHabit.map((p) => p.length));
  let rating = baseline;
  const out: CombinedPoint[] = [];
  for (let i = 0; i < length; i++) {
    const perHabit: Record<string, number> = {};
    let net = 0;
    let good = 0;
    let slip = 0;
    let flat = 0;
    let recorded = false;
    let date = "";
    for (const points of pointsByHabit) {
      const p = points[i];
      if (!p) continue;
      date = p.date;
      perHabit[p.habitId] = p.delta;
      net += p.delta;
      if (p.outcome === "good") good++;
      else if (p.outcome === "slip") slip++;
      else flat++;
      if (p.outcome !== "unrecorded") recorded = true;
    }
    const previousRating = rating;
    rating += net;
    out.push({
      habitId: "combined",
      date,
      outcome: netOutcome(net, recorded),
      delta: net,
      rating,
      previousRating,
      good,
      slip,
      flat,
      perHabit,
    });
  }
  return out;
}

export function summarizeGrowth(
  combined: readonly CombinedPoint[],
  pointsByHabit: ReadonlyArray<readonly GraphPoint[]>,
): GrowthSummary {
  return {
    habitCount: pointsByHabit.length,
    totalNet: currentRating(combined),
    daysUp: combined.filter((p) => p.delta > 0).length,
    daysDown: combined.filter((p) => p.delta < 0).length,
    daysLevel: combined.filter((p) => p.delta === 0).length,
    peak: combined.length ? Math.max(...combined.map((p) => p.rating)) : 0,
    perHabit: pointsByHabit.map((points) => ({
      habitId: points[0]?.habitId ?? "",
      net: currentRating(points),
      good: points.filter((p) => p.outcome === "good").length,
      slip: points.filter((p) => p.outcome === "slip").length,
    })),
  };
}

/** "+4" / "−2" / "0" with a true minus sign. */
export function formatSigned(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}
