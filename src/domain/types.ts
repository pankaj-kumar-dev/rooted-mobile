// Ported verbatim from web: rooted/src/domain/types.ts. Keep in sync; do not change scoring semantics here.
export type CheckInOutcome = "good" | "slip" | "missed";

/** Display-only: `unrecorded` = no check-in exists for that calendar day. */
export type DisplayOutcome = CheckInOutcome | "unrecorded";

export type Delta = -1 | 0 | 1;

export interface Habit {
  id: string;
  name: string;
  category?: string;
  description?: string;
  createdAt: string;
  active: boolean;
}

export interface DailyCheckIn {
  habitId: string;
  date: string; // local calendar date YYYY-MM-DD
  outcome: CheckInOutcome;
  note?: string;
}

export interface GraphPoint {
  habitId: string;
  date: string;
  outcome: DisplayOutcome;
  /** -1/0/+1 for a single habit; the summed daily net for a combined point. */
  delta: number;
  /** Rating after applying this day's delta. */
  rating: number;
  /** Rating before applying this day's delta. */
  previousRating: number;
}

/** One day of the aggregate across several habits. `delta` is the sum of each habit's delta that day. */
export interface CombinedPoint extends GraphPoint {
  good: number;
  slip: number;
  /** Habits that were missed or unrecorded (no change). */
  flat: number;
  /** Per-habit delta for the day, keyed by habit id. */
  perHabit: Record<string, number>;
}

export interface HabitGrowth {
  habitId: string;
  /** Final rating minus starting rating. */
  net: number;
  good: number;
  slip: number;
}

export interface GrowthSummary {
  habitCount: number;
  totalNet: number;
  daysUp: number;
  daysDown: number;
  daysLevel: number;
  /** Highest day-end combined rating reached. */
  peak: number;
  perHabit: HabitGrowth[];
}
