import { MAX_ACTIVE_HABITS } from "./score";
import { isValidDateKey } from "./dateKeys";
import { HABIT_PRESETS } from "./presets";
import { LIMITS, SCHEMA_VERSION, type CheckInRecord, type HabitRecord, type RootedState } from "./state";

/**
 * v1 -> v2.
 *
 * v1 stored a derived `rating` on each habit and `ratingAfter`/`delta` on each check-in, with a rating
 * floor of 1 and a starting rating of 1. v2 stores only habits and outcomes; ratings are always derived
 * with baseline 0 and no floor (the web rules). Consequently a migrated habit's displayed rating can differ
 * from its v1 rating (start 1 -> 0, and any floored slip now counts). That is intended: it is the only way
 * every chart and total can be reproduced from the outcomes.
 *
 * Nothing is silently lost: every dropped or altered record is counted in the report, and the caller keeps a
 * raw backup of the v1 payload.
 */
export interface MigrationReport {
  from: 1;
  to: typeof SCHEMA_VERSION;
  habits: number;
  checkIns: number;
  /** v1 "skip" outcomes converted to "missed". */
  skipsConvertedToMissed: number;
  /** Check-ins dropped because their habit, date or outcome was invalid. */
  checkInsDropped: number;
  /** Same habit+date appeared more than once; the latest was kept. */
  duplicatesCollapsed: number;
  /** Habits deactivated because v1 data held more than five active habits. */
  habitsDeactivatedForCap: number;
}

export type MigrationResult =
  | { ok: true; state: RootedState; report: MigrationReport }
  | { ok: false; reason: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isIso = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));

const presetKeyByName = new Map(HABIT_PRESETS.map((p) => [p.name, p]));

export function migrateV1ToV2(raw: unknown): MigrationResult {
  if (!isObject(raw)) return { ok: false, reason: "v1 payload is not an object." };
  if (raw.version !== 1) return { ok: false, reason: "v1 payload has an unexpected version." };
  if (!Array.isArray(raw.habits) || !Array.isArray(raw.checkIns)) {
    return { ok: false, reason: "v1 payload is missing habits or check-ins." };
  }

  const report: MigrationReport = {
    from: 1,
    to: SCHEMA_VERSION,
    habits: 0,
    checkIns: 0,
    skipsConvertedToMissed: 0,
    checkInsDropped: 0,
    duplicatesCollapsed: 0,
    habitsDeactivatedForCap: 0,
  };

  const habits: HabitRecord[] = [];
  const ids = new Set<string>();
  for (const h of raw.habits) {
    if (!isObject(h) || typeof h.id !== "string" || !h.id || ids.has(h.id)) {
      return { ok: false, reason: "v1 payload has a malformed or duplicate habit." };
    }
    const name = str(h.name).trim().replace(/\s+/g, " ");
    if (!name) return { ok: false, reason: "v1 payload has a habit without a name." };
    const preset = presetKeyByName.get(name);
    ids.add(h.id);
    habits.push({
      id: h.id,
      presetKey: preset && !habits.some((x) => x.presetKey === preset.key) ? preset.key : null,
      name: name.slice(0, LIMITS.name),
      icon: preset?.icon ?? "spark",
      description: str(h.description).trim().slice(0, LIMITS.description),
      goodDay: str(h.goodDayDefinition).trim().slice(0, LIMITS.definition),
      slipDay: str(h.slipDefinition).trim().slice(0, LIMITS.definition),
      active: !h.archivedAt,
      createdAt: isIso(h.createdAt) ? h.createdAt : new Date(0).toISOString(),
    });
  }

  // v1 capped active habits at five; if the data disagrees, keep the oldest five active.
  const active = habits.filter((h) => h.active).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const h of active.slice(MAX_ACTIVE_HABITS)) {
    h.active = false;
    report.habitsDeactivatedForCap++;
  }

  const byKey = new Map<string, CheckInRecord>();
  for (const c of raw.checkIns) {
    if (!isObject(c)) {
      report.checkInsDropped++;
      continue;
    }
    const outcome = c.outcome === "good" ? "good" : c.outcome === "slip" ? "slip" : c.outcome === "skip" ? "missed" : null;
    if (typeof c.habitId !== "string" || !ids.has(c.habitId) || !isValidDateKey(c.date) || !outcome) {
      report.checkInsDropped++;
      continue;
    }
    const rec: CheckInRecord = {
      habitId: c.habitId,
      date: c.date,
      outcome,
      updatedAt: isIso(c.createdAt) ? c.createdAt : new Date(0).toISOString(),
    };
    const key = `${rec.habitId}|${rec.date}`;
    const existing = byKey.get(key);
    if (existing) {
      report.duplicatesCollapsed++;
      if (rec.updatedAt >= existing.updatedAt) byKey.set(key, rec);
    } else {
      byKey.set(key, rec);
    }
    if (c.outcome === "skip") report.skipsConvertedToMissed++;
  }

  const checkIns = [...byKey.values()];
  report.habits = habits.length;
  report.checkIns = checkIns.length;
  return { ok: true, report, state: { schemaVersion: SCHEMA_VERSION, habits, checkIns, settings: {} } };
}
