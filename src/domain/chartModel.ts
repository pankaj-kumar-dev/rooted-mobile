import { formatSigned } from "./score";
import type { CombinedPoint, GraphPoint } from "./types";

/** Pure helpers behind the 2D charts. No React, no layout coordinates beyond the explicit inputs. */

export type Tone = "up" | "down" | "flat";
export const toneOf = (delta: number): Tone => (delta > 0 ? "up" : delta < 0 ? "down" : "flat");

export type RangeKey = 7 | 30 | 90 | "all";
export const RANGE_LABEL: Record<RangeKey, string> = { 7: "7 days", 30: "30 days", 90: "90 days", all: "All" };
export const DEFAULT_RANGE: RangeKey = 30;

/** Ranges worth offering: a fixed range is hidden when it would show the same days as a larger one. "All" is always offered. */
export function availableRanges(count: number): RangeKey[] {
  const fixed = ([7, 30, 90] as const).filter((r) => r < count);
  return [...fixed, "all"];
}

/** Resolve a stored selection against what's available (e.g. 90 days is gone when only 40 days exist). */
export function effectiveRange(range: RangeKey, count: number): RangeKey {
  return availableRanges(count).includes(range) ? range : "all";
}

/** Last N days of a timeline. Each point keeps its own previousRating, so the window starts at the right level. */
export function sliceRange<T extends GraphPoint>(points: readonly T[], range: RangeKey): T[] {
  return range === "all" ? [...points] : points.slice(-range);
}

/**
 * Map a horizontal touch position to the nearest day.
 * Day i sits at x = left + ((i + 1) / count) * plotWidth (day 0 is the starting level).
 * Returns null when there is nothing to select.
 */
export function indexFromX(x: number, left: number, plotWidth: number, count: number): number | null {
  if (count <= 0 || plotWidth <= 0) return null;
  const raw = Math.round(((x - left) / plotWidth) * count) - 1;
  return Math.max(0, Math.min(count - 1, raw));
}

export interface PointText {
  head: string;
  body?: string;
}

export function describeHabitPoint(p: GraphPoint): PointText {
  switch (p.outcome) {
    case "good":
      return { head: "Good day", body: "Rating up by 1." };
    case "slip":
      return { head: "Slip-up", body: "Rating down by 1. Earlier days stay on the record." };
    case "missed":
      return { head: "Missed check-in", body: "Rating unchanged." };
    case "unrecorded":
      return { head: "No check-in recorded", body: "Rating unchanged." };
  }
}

/** Mirrors the web's overall tooltip: net for the day plus which habits moved. */
export function describeCombinedPoint(p: CombinedPoint, nameById: Readonly<Record<string, string>>): PointText {
  const parts = [
    p.good ? `${p.good} good` : "",
    p.slip ? `${p.slip} slip-up${p.slip > 1 ? "s" : ""}` : "",
    p.flat ? `${p.flat} unchanged` : "",
  ].filter(Boolean);
  const moved = Object.entries(p.perHabit)
    .filter(([, d]) => d !== 0)
    .map(([id, d]) => `${nameById[id] ?? "Habit"} ${formatSigned(d)}`)
    .join(", ");
  return {
    head: `Net ${formatSigned(p.delta)}`,
    body: `${parts.join(", ")}${moved ? ` (${moved})` : ""}. Each habit's own rating is unchanged.`,
  };
}
