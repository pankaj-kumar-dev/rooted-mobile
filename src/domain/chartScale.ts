// Ported verbatim from web: rooted/src/components/graph/chartScale.ts (pure, used by 2D charts).
export interface YAxis {
  min: number;
  max: number;
  ticks: number[];
}

const MAX_Y_TICKS = 6;

/**
 * Integer-only Y axis that always contains every rating and the zero line,
 * with one level of headroom so markers never touch the frame. Tick step grows
 * with the range, so a +30 overall total and a ±3 single habit both stay legible.
 */
export function computeYAxis(ratings: readonly number[]): YAxis {
  const lo = Math.min(0, ...ratings);
  const hi = Math.max(0, ...ratings);
  const step = Math.max(1, Math.ceil((hi - lo + 2) / (MAX_Y_TICKS - 1)));
  const min = Math.floor((lo - 1) / step) * step;
  const max = Math.ceil((hi + 1) / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(v);
  return { min, max, ticks };
}

const DAY_STEPS = [1, 2, 5, 10, 20, 50];

/** 1-based day numbers to label: day 1 plus multiples of a step that fits the width. */
export function computeDayTicks(count: number, plotWidth: number, minGap = 34): number[] {
  const maxLabels = Math.max(2, Math.floor(plotWidth / minGap));
  const step = DAY_STEPS.find((s) => Math.ceil(count / s) + 1 <= maxLabels) ?? DAY_STEPS[DAY_STEPS.length - 1]!;
  const ticks: number[] = [];
  for (let d = 1; d <= count; d++) {
    if (d === 1 || d % step === 0) ticks.push(d);
  }
  // Drop day 1 when it would sit right next to the first step label.
  if (ticks.length > 1 && ticks[1]! - ticks[0]! < step / 2 + 0.5 && step > 1) ticks.shift();
  return ticks;
}
