import { OUTCOME_LABEL } from "./domain/score";
import type { DisplayOutcome } from "./domain/types";

function parts(key: string): [number, number, number] {
  const [y, m, d] = key.split("-").map(Number);
  return [y ?? 1970, (m ?? 1) - 1, d ?? 1];
}

/** Local-calendar formatting only: date keys are never routed through UTC. */
export function longDate(key: string): string {
  const [y, m, d] = parts(key);
  return new Date(y, m, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

export function shortDate(key: string): string {
  const [y, m, d] = parts(key);
  return new Date(y, m, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function weekdayDate(key: string): string {
  const [y, m, d] = parts(key);
  return new Date(y, m, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** "+2" / "−1" / "0", with a true minus sign. */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

export const outcomeLabel = (o: DisplayOutcome): string => OUTCOME_LABEL[o];
