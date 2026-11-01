import { MAX_ACTIVE_HABITS } from "./score";
import { isValidDateKey } from "./dateKeys";
import { isHabitIcon } from "./presets";
import { LIMITS, SCHEMA_VERSION, type CheckInRecord, type HabitRecord, type RootedState } from "./state";

export type ParseResult =
  | { ok: true; state: RootedState; duplicatesRemoved: number }
  | { ok: false; reason: string; /** The data was written by a newer app version. */ newer: boolean };

const fail = (reason: string, newer = false): ParseResult => ({ ok: false, reason, newer });

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

/**
 * Strictly validates a decoded v2 payload. Structural problems are reported, never "repaired" into an
 * empty state. The only tolerated defect is a duplicate (habitId, date) pair, which collapses to the
 * most recently updated record (the invariant is one outcome per habit per day).
 */
export function parseStateV2(raw: unknown): ParseResult {
  if (!isObject(raw)) return fail("State is not an object.");
  const version = raw.schemaVersion;
  if (typeof version === "number" && version > SCHEMA_VERSION) {
    return fail(`Data was saved by a newer version of ROOTED (schema ${version}).`, true);
  }
  if (version !== SCHEMA_VERSION) return fail("Unknown schema version.");
  if (!Array.isArray(raw.habits)) return fail("habits is not a list.");
  if (!Array.isArray(raw.checkIns)) return fail("checkIns is not a list.");

  const habits: HabitRecord[] = [];
  const ids = new Set<string>();
  for (const h of raw.habits) {
    if (!isObject(h)) return fail("A habit is malformed.");
    if (typeof h.id !== "string" || !h.id) return fail("A habit has no id.");
    if (ids.has(h.id)) return fail("Two habits share an id.");
    if (typeof h.name !== "string" || h.name.trim().length < 1 || h.name.length > LIMITS.name) {
      return fail("A habit has an invalid name.");
    }
    for (const key of ["description", "goodDay", "slipDay"] as const) {
      if (typeof h[key] !== "string") return fail(`A habit has an invalid ${key}.`);
    }
    if (typeof h.active !== "boolean") return fail("A habit has an invalid active flag.");
    if (!isIso(h.createdAt)) return fail("A habit has an invalid createdAt.");
    if (h.presetKey !== null && typeof h.presetKey !== "string") return fail("A habit has an invalid presetKey.");
    ids.add(h.id);
    habits.push({
      id: h.id,
      presetKey: h.presetKey,
      name: h.name,
      icon: isHabitIcon(h.icon) ? h.icon : "spark",
      description: h.description as string,
      goodDay: h.goodDay as string,
      slipDay: h.slipDay as string,
      active: h.active,
      createdAt: h.createdAt,
    });
  }
  if (habits.filter((h) => h.active).length > MAX_ACTIVE_HABITS) return fail("More than five active habits.");

  const byKey = new Map<string, CheckInRecord>();
  let duplicatesRemoved = 0;
  for (const c of raw.checkIns) {
    if (!isObject(c)) return fail("A check-in is malformed.");
    if (typeof c.habitId !== "string" || !ids.has(c.habitId)) return fail("A check-in refers to an unknown habit.");
    if (!isValidDateKey(c.date)) return fail("A check-in has an invalid date.");
    if (c.outcome !== "good" && c.outcome !== "slip" && c.outcome !== "missed") {
      return fail("A check-in has an invalid outcome.");
    }
    if (!isIso(c.updatedAt)) return fail("A check-in has an invalid updatedAt.");
    const rec: CheckInRecord = { habitId: c.habitId, date: c.date, outcome: c.outcome, updatedAt: c.updatedAt };
    const key = `${rec.habitId}|${rec.date}`;
    const existing = byKey.get(key);
    if (existing) {
      duplicatesRemoved++;
      if (rec.updatedAt >= existing.updatedAt) byKey.set(key, rec);
    } else {
      byKey.set(key, rec);
    }
  }

  return {
    ok: true,
    duplicatesRemoved,
    state: { schemaVersion: SCHEMA_VERSION, habits, checkIns: [...byKey.values()], settings: {} },
  };
}
